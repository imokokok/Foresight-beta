/**
 * 核心订单撮合引擎
 * 实现价格-时间优先撮合算法
 */

import { ethers } from "ethers";
import { EventEmitter } from "events";
import { OrderBookManager, OrderBook } from "./orderBook.js";
import type {
  Order,
  Match,
  MatchResult,
  Trade,
  MarketEvent,
  MatchingEngineConfig,
} from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";
import { supabaseAdmin } from "../supabase.js";
import { BatchSettler, type SettlementFill, type SettlementOrder } from "../settlement/index.js";
import { getRedisClient } from "../redis/client.js";

// EIP-712 类型定义
const ORDER_TYPES = {
  Order: [
    { name: "maker", type: "address" },
    { name: "outcomeIndex", type: "uint256" },
    { name: "isBuy", type: "bool" },
    { name: "price", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "salt", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
};

const CANCEL_TYPES = {
  CancelSaltRequest: [
    { name: "maker", type: "address" },
    { name: "salt", type: "uint256" },
  ],
};

/**
 * 订单撮合引擎
 */
export class MatchingEngine extends EventEmitter {
  private bookManager: OrderBookManager;
  private config: MatchingEngineConfig;
  private sequenceCounter: bigint = 0n;

  // 🚀 批量结算器 (Polymarket 模式)
  private batchSettlers: Map<string, BatchSettler> = new Map();
  private bookLocks: Map<string, Promise<void>> = new Map();

  constructor(config: Partial<MatchingEngineConfig> = {}) {
    super();
    this.bookManager = new OrderBookManager();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async withBookLock<T>(
    marketKey: string,
    outcomeIndex: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const lockKey = `${marketKey}:${outcomeIndex}`;
    const previous = this.bookLocks.get(lockKey) || Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.bookLocks.set(lockKey, current);
    await previous;

    const redis = getRedisClient();
    const distributedLockKey = `orderbook:lock:${marketKey}:${outcomeIndex}`;
    const distributedLockToken = redis.isReady()
      ? await redis.acquireLock(distributedLockKey, 30000, 200, 50)
      : null;

    try {
      if (redis.isReady() && !distributedLockToken) {
        throw new Error("Orderbook busy");
      }
      return await fn();
    } finally {
      if (distributedLockToken) {
        await redis.releaseLock(distributedLockKey, distributedLockToken);
      }
      release();
      if (this.bookLocks.get(lockKey) === current) {
        this.bookLocks.delete(lockKey);
      }
    }
  }

  /**
   * 🚀 注册市场的批量结算器
   */
  registerSettler(
    marketKey: string,
    chainId: number,
    marketAddress: string,
    operatorPrivateKey: string,
    rpcUrl: string
  ): BatchSettler {
    const settler = new BatchSettler(chainId, marketAddress, operatorPrivateKey, rpcUrl, {
      maxBatchSize: 50,
      minBatchSize: this.config.batchSettlementThreshold,
      maxBatchWaitMs: this.config.batchSettlementInterval,
    });

    // 转发结算事件
    settler.on("settlement_event", (event) => {
      this.emit("settlement_event", event);
    });

    settler.start();
    this.batchSettlers.set(marketKey, settler);

    console.log(`[MatchingEngine] Registered settler for market ${marketKey}`);
    return settler;
  }

  /**
   * 🚀 获取市场的结算器
   */
  getSettler(marketKey: string): BatchSettler | undefined {
    return this.batchSettlers.get(marketKey);
  }

  /**
   * 提交新订单并尝试撮合
   */
  async submitOrder(orderInput: OrderInput): Promise<MatchResult> {
    try {
      return await this.withBookLock(orderInput.marketKey, orderInput.outcomeIndex, async () => {
        // 1. 验证订单
        const validationResult = await this.validateOrder(orderInput);
        if (!validationResult.valid) {
          return {
            success: false,
            matches: [],
            remainingOrder: null,
            error: validationResult.error,
          };
        }

        // 2. 创建内部订单对象
        const order = this.createOrder(orderInput);

        if (order.postOnly) {
          const book = this.bookManager.getOrCreateBook(order.marketKey, order.outcomeIndex);
          while (true) {
            const counterOrder = book.getBestCounterOrder(order.isBuy);
            if (!counterOrder) break;
            if (this.isExpired(counterOrder)) {
              book.removeOrder(counterOrder.id);
              await this.updateOrderStatus(counterOrder, "expired");
              continue;
            }
            if (this.pricesMatch(order, counterOrder)) {
              return {
                success: false,
                matches: [],
                remainingOrder: null,
                error: "Post-only order would be immediately executed",
              };
            }
            break;
          }
          await this.addToOrderBook(order);
          return {
            success: true,
            matches: [],
            remainingOrder: order,
          };
        }

        // 3. 尝试撮合
        const matchResult = await this.matchOrder(order);

        // 4. 如果有剩余,加入订单簿
        if (matchResult.remainingOrder && matchResult.remainingOrder.remainingAmount > 0n) {
          await this.addToOrderBook(matchResult.remainingOrder);
        }

        // 5. 广播事件
        if (matchResult.matches.length > 0) {
          for (const match of matchResult.matches) {
            const trade = this.matchToTrade(match);
            this.emit("trade", trade);
            this.emitEvent({ type: "trade", trade });
          }
        }

        return matchResult;
      });
    } catch (error: any) {
      console.error("[MatchingEngine] submitOrder error:", error);
      return {
        success: false,
        matches: [],
        remainingOrder: null,
        error: error?.message || "Unknown error",
      };
    }
  }

  /**
   * 核心撮合逻辑 - 价格时间优先
   */
  private async matchOrder(incomingOrder: Order): Promise<MatchResult> {
    const matches: Match[] = [];
    const book = this.bookManager.getOrCreateBook(
      incomingOrder.marketKey,
      incomingOrder.outcomeIndex
    );

    let order = { ...incomingOrder };

    if (order.tif === "FOK") {
      const depth = book.getDepthSnapshot(1000);
      let required = order.amount;
      if (order.isBuy) {
        for (const level of depth.asks) {
          if (order.price < level.price) break;
          required -= level.totalQuantity;
          if (required <= 0n) break;
        }
      } else {
        for (const level of depth.bids) {
          if (order.price > level.price) break;
          required -= level.totalQuantity;
          if (required <= 0n) break;
        }
      }
      if (required > 0n) {
        order.status = "canceled";
        return {
          success: true,
          matches,
          remainingOrder: null,
        };
      }
    }

    while (order.remainingAmount > 0n) {
      // 获取对手盘最优订单
      const counterOrder = book.getBestCounterOrder(order.isBuy);

      if (!counterOrder) {
        // 没有对手盘,停止撮合
        break;
      }

      // 检查价格是否匹配
      if (!this.pricesMatch(order, counterOrder)) {
        break;
      }

      // 检查订单是否过期
      if (this.isExpired(counterOrder)) {
        book.removeOrder(counterOrder.id);
        await this.updateOrderStatus(counterOrder, "expired");
        continue;
      }

      // 计算成交量 (取两者剩余量的较小值)
      const matchAmount =
        order.remainingAmount < counterOrder.remainingAmount
          ? order.remainingAmount
          : counterOrder.remainingAmount;

      // 成交价格使用 Maker 价格 (挂单方价格)
      const matchPrice = counterOrder.price;

      // 计算手续费
      const { makerFee, takerFee } = this.calculateFees(matchAmount, matchPrice);

      // 创建撮合记录
      const match: Match = {
        id: this.generateMatchId(),
        makerOrder: counterOrder,
        takerOrder: order,
        matchedAmount: matchAmount,
        matchedPrice: matchPrice,
        makerFee,
        takerFee,
        timestamp: Date.now(),
      };

      matches.push(match);

      // 🚀 发送到批量结算器
      const settler = this.batchSettlers.get(order.marketKey);
      if (settler) {
        const settlementFill: SettlementFill = {
          id: match.id,
          order: {
            maker: counterOrder.maker,
            outcomeIndex: counterOrder.outcomeIndex,
            isBuy: counterOrder.isBuy,
            price: counterOrder.price,
            amount: counterOrder.amount,
            salt: BigInt(counterOrder.salt),
            expiry: BigInt(counterOrder.expiry),
          },
          signature: counterOrder.signature,
          fillAmount: matchAmount,
          taker: order.maker, // Taker 是 incoming order 的 maker
          matchedPrice: matchPrice,
          makerFee,
          takerFee,
          timestamp: Date.now(),
        };
        settler.addFill(settlementFill);
      }

      // 更新订单剩余量
      order.remainingAmount -= matchAmount;
      counterOrder.remainingAmount -= matchAmount;

      // 更新订单簿中的对手订单
      if (counterOrder.remainingAmount === 0n) {
        book.removeOrder(counterOrder.id);
        counterOrder.status = "filled";
      } else {
        book.updateOrder(counterOrder);
        counterOrder.status = "partially_filled";
      }

      // 记录成交
      book.recordTrade(matchPrice, matchAmount);

      // 持久化订单状态
      await this.updateOrderInDb(counterOrder);

      // 广播订单簿更新
      this.emitDepthUpdate(book);
    }

    if (order.tif === "IOC" || order.tif === "FOK") {
      if (order.remainingAmount === 0n) {
        order.status = "filled";
      } else if (matches.length === 0) {
        order.status = "canceled";
      } else {
        order.status = "partially_filled";
      }
      return {
        success: true,
        matches,
        remainingOrder: null,
      };
    } else {
      if (order.remainingAmount === 0n) {
        order.status = "filled";
      } else if (order.remainingAmount < incomingOrder.amount) {
        order.status = "partially_filled";
      } else {
        order.status = "open";
      }
      return {
        success: true,
        matches,
        remainingOrder: order.remainingAmount > 0n ? order : null,
      };
    }
  }

  /**
   * 检查价格是否匹配
   */
  private pricesMatch(takerOrder: Order, makerOrder: Order): boolean {
    if (takerOrder.isBuy) {
      // Taker 买入: Taker价格 >= Maker价格 (愿意付更高价)
      return takerOrder.price >= makerOrder.price;
    } else {
      // Taker 卖出: Taker价格 <= Maker价格 (愿意接受更低价)
      return takerOrder.price <= makerOrder.price;
    }
  }

  /**
   * 检查订单是否过期
   */
  private isExpired(order: Order): boolean {
    if (order.expiry === 0) return false;
    return Math.floor(Date.now() / 1000) >= order.expiry;
  }

  /**
   * 计算手续费
   */
  private calculateFees(amount: bigint, price: bigint): { makerFee: bigint; takerFee: bigint } {
    // 计算成交金额 (USDC, 6 decimals)
    // cost = amount * price / 1e18
    const cost = (amount * price) / BigInt(1e18);

    // 手续费 = cost * feeBps / 10000
    const makerFee = (cost * BigInt(this.config.makerFeeBps)) / 10000n;
    const takerFee = (cost * BigInt(this.config.takerFeeBps)) / 10000n;

    return { makerFee, takerFee };
  }

  /**
   * 添加订单到订单簿
   */
  private async addToOrderBook(order: Order): Promise<void> {
    const book = this.bookManager.getOrCreateBook(order.marketKey, order.outcomeIndex);
    book.addOrder(order);

    // 持久化到数据库
    await this.saveOrderToDb(order);

    // 广播事件
    this.emitEvent({ type: "order_placed", order });
    this.emitDepthUpdate(book);
  }

  /**
   * 取消订单
   */
  async cancelOrder(
    marketKey: string,
    outcomeIndex: number,
    chainId: number,
    verifyingContract: string,
    maker: string,
    salt: string,
    signature: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.withBookLock(marketKey, outcomeIndex, async () => {
        if (!ethers.isAddress(maker)) {
          return { success: false, error: "Invalid maker address" };
        }
        if (!ethers.isAddress(verifyingContract)) {
          return { success: false, error: "Invalid verifying contract address" };
        }

        const recovered = ethers.verifyTypedData(
          {
            name: "Foresight Market",
            version: "1",
            chainId,
            verifyingContract: verifyingContract.toLowerCase(),
          },
          CANCEL_TYPES,
          { maker: maker.toLowerCase(), salt: BigInt(salt) },
          signature
        );
        if (recovered.toLowerCase() !== maker.toLowerCase()) {
          return { success: false, error: "Invalid signature" };
        }

        const orderId = `${maker.toLowerCase()}-${salt}`;
        const book = this.bookManager.getBook(marketKey, outcomeIndex);
        const removed = book ? book.removeOrder(orderId) : null;

        if (supabaseAdmin) {
          await supabaseAdmin
            .from("orders")
            .update({ status: "canceled", remaining: "0" })
            .eq("chain_id", chainId)
            .eq("verifying_contract", verifyingContract.toLowerCase())
            .eq("maker_address", maker.toLowerCase())
            .eq("maker_salt", salt)
            .in("status", ["open", "partially_filled"]);
        }

        if (book && removed) {
          this.emitEvent({ type: "order_canceled", orderId, marketKey });
          this.emitDepthUpdate(book);
        }

        return { success: true };
      });
    } catch (error: any) {
      return { success: false, error: error?.message };
    }
  }

  /**
   * 验证订单
   */
  private async validateOrder(input: OrderInput): Promise<{ valid: boolean; error?: string }> {
    // 1. 验证基本参数
    if (!ethers.isAddress(input.maker)) {
      return { valid: false, error: "Invalid maker address" };
    }

    if (input.price < this.config.minPrice || input.price > this.config.maxPrice) {
      return { valid: false, error: "Price out of range" };
    }

    const tickOffset = input.price - this.config.minPrice;
    if (tickOffset % this.config.priceTickSize !== 0n) {
      return { valid: false, error: "Price not aligned to tick size" };
    }

    if (input.amount < this.config.minOrderAmount) {
      return { valid: false, error: "Amount below minimum" };
    }

    if (input.amount > this.config.maxOrderAmount) {
      return { valid: false, error: "Amount exceeds maximum" };
    }

    if (input.tif && input.tif !== "IOC" && input.tif !== "FOK") {
      return { valid: false, error: "Invalid time in force" };
    }

    if (input.postOnly && input.tif && (input.tif === "IOC" || input.tif === "FOK")) {
      return { valid: false, error: "Post-only cannot be combined with IOC/FOK" };
    }

    if (input.expiry !== 0 && Math.floor(Date.now() / 1000) >= input.expiry) {
      return { valid: false, error: "Order expired" };
    }

    // 2. 验证签名
    const signatureValid = await this.verifySignature(input);
    if (!signatureValid) {
      return { valid: false, error: "Invalid signature" };
    }

    // 3. 检查订单是否已存在 (防止重放)
    const exists = await this.checkOrderExists(
      input.chainId,
      input.verifyingContract.toLowerCase(),
      input.maker,
      input.salt
    );
    if (exists) {
      return { valid: false, error: "Order with this salt already exists" };
    }

    const riskCheck = await this.checkBalanceAndRisk(input);
    if (!riskCheck.valid) {
      return riskCheck;
    }

    return { valid: true };
  }

  private async checkBalanceAndRisk(
    input: OrderInput
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const makerAddress = input.maker.toLowerCase();

      const book = this.bookManager.getBook(input.marketKey, input.outcomeIndex);
      let marketLongUsdc = 0n;
      let marketShortUsdc = 0n;

      if (book) {
        const snapshot = book.getDepthSnapshot(1000);
        for (const level of snapshot.bids) {
          for (const order of level.orders) {
            if (order.maker === makerAddress) {
              const notional = (order.remainingAmount * order.price) / BigInt(1e18);
              marketLongUsdc += notional;
            }
          }
        }
        for (const level of snapshot.asks) {
          for (const order of level.orders) {
            if (order.maker === makerAddress) {
              const notional = (order.remainingAmount * order.price) / BigInt(1e18);
              marketShortUsdc += notional;
            }
          }
        }
      }

      const orderCostUsdc = (input.amount * input.price) / BigInt(1e18);

      if (this.config.maxMarketLongExposureUsdc && this.config.maxMarketLongExposureUsdc > 0) {
        const limitUsdc = BigInt(Math.floor(this.config.maxMarketLongExposureUsdc * 1e6));
        const newLongExposure = marketLongUsdc + (input.isBuy ? orderCostUsdc : 0n);
        if (newLongExposure > limitUsdc) {
          return { valid: false, error: "Market long exposure limit exceeded" };
        }
      }

      if (this.config.maxMarketShortExposureUsdc && this.config.maxMarketShortExposureUsdc > 0) {
        const limitUsdc = BigInt(Math.floor(this.config.maxMarketShortExposureUsdc * 1e6));
        const newShortExposure = marketShortUsdc + (!input.isBuy ? orderCostUsdc : 0n);
        if (newShortExposure > limitUsdc) {
          return { valid: false, error: "Market short exposure limit exceeded" };
        }
      }

      if (!supabaseAdmin) {
        return { valid: true };
      }

      if (!input.isBuy) {
        return { valid: true };
      }

      const { data: balanceRow } = await supabaseAdmin
        .from("user_balances")
        .select("balance")
        .eq("user_address", makerAddress)
        .maybeSingle();

      let offchainBalanceUsdc = 0n;
      if (balanceRow) {
        const raw = (balanceRow as any).balance;
        let numeric = 0;
        if (typeof raw === "number") {
          numeric = raw;
        } else if (typeof raw === "string") {
          const parsed = parseFloat(raw);
          if (Number.isFinite(parsed)) {
            numeric = parsed;
          }
        }
        offchainBalanceUsdc = BigInt(Math.floor(numeric * 1e6));
      }

      const { data: openOrders } = await supabaseAdmin
        .from("orders")
        .select("price, remaining")
        .eq("maker_address", makerAddress)
        .in("status", ["open", "partially_filled"]);

      let reservedUsdc = 0n;
      for (const row of openOrders || []) {
        const price = BigInt((row as any).price);
        const remaining = BigInt((row as any).remaining);
        reservedUsdc += (remaining * price) / BigInt(1e18);
      }

      const totalRequiredUsdc = reservedUsdc + orderCostUsdc;

      if (totalRequiredUsdc > offchainBalanceUsdc) {
        return { valid: false, error: "Insufficient balance" };
      }

      return { valid: true };
    } catch (error: any) {
      console.error("[MatchingEngine] Balance check failed", error);
      return { valid: false, error: "Balance check failed" };
    }
  }

  /**
   * 验证 EIP-712 签名
   */
  private async verifySignature(input: OrderInput): Promise<boolean> {
    try {
      const domain = {
        name: "Foresight Market",
        version: "1",
        chainId: input.chainId,
        verifyingContract: input.verifyingContract.toLowerCase(),
      };

      const orderData = {
        maker: input.maker.toLowerCase(),
        outcomeIndex: input.outcomeIndex,
        isBuy: input.isBuy,
        price: input.price,
        amount: input.amount,
        salt: BigInt(input.salt),
        expiry: BigInt(input.expiry),
      };

      const recovered = ethers.verifyTypedData(domain, ORDER_TYPES, orderData, input.signature);
      return recovered.toLowerCase() === input.maker.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * 检查订单是否已存在
   */
  private async checkOrderExists(
    chainId: number,
    verifyingContract: string,
    maker: string,
    salt: string
  ): Promise<boolean> {
    if (!supabaseAdmin) return false;

    const { data } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("chain_id", chainId)
      .eq("verifying_contract", verifyingContract)
      .eq("maker_address", maker.toLowerCase())
      .eq("maker_salt", salt)
      .maybeSingle();

    return !!data;
  }

  /**
   * 创建内部订单对象
   */
  private createOrder(input: OrderInput): Order {
    const sequence = this.sequenceCounter++;

    return {
      id: `${input.maker.toLowerCase()}-${input.salt}`,
      marketKey: input.marketKey,
      maker: input.maker.toLowerCase(),
      outcomeIndex: input.outcomeIndex,
      isBuy: input.isBuy,
      price: input.price,
      amount: input.amount,
      remainingAmount: input.amount,
      salt: input.salt,
      expiry: input.expiry,
      signature: input.signature,
      chainId: input.chainId,
      verifyingContract: input.verifyingContract.toLowerCase(),
      sequence,
      status: "open",
      createdAt: Date.now(),
      tif: input.tif,
      postOnly: input.postOnly,
    };
  }

  /**
   * 保存订单到数据库
   */
  private async saveOrderToDb(order: Order): Promise<void> {
    if (!supabaseAdmin) return;

    await supabaseAdmin.from("orders").upsert(
      {
        verifying_contract: order.verifyingContract,
        chain_id: order.chainId,
        market_key: order.marketKey,
        maker_address: order.maker,
        maker_salt: order.salt,
        outcome_index: order.outcomeIndex,
        is_buy: order.isBuy,
        price: order.price.toString(),
        amount: order.amount.toString(),
        remaining: order.remainingAmount.toString(),
        expiry: order.expiry === 0 ? null : new Date(order.expiry * 1000).toISOString(),
        signature: order.signature,
        status: order.status,
        sequence: order.sequence.toString(),
      },
      {
        onConflict: "verifying_contract,chain_id,maker_address,maker_salt",
      }
    );
  }

  /**
   * 更新订单状态
   */
  private async updateOrderStatus(
    order: Pick<Order, "chainId" | "verifyingContract" | "maker" | "salt">,
    status: Order["status"]
  ): Promise<void> {
    if (!supabaseAdmin) return;

    await supabaseAdmin
      .from("orders")
      .update({ status })
      .eq("chain_id", order.chainId)
      .eq("verifying_contract", order.verifyingContract)
      .eq("maker_address", order.maker.toLowerCase())
      .eq("maker_salt", order.salt);
  }

  /**
   * 更新订单到数据库
   */
  private async updateOrderInDb(order: Order): Promise<void> {
    if (!supabaseAdmin) return;

    await supabaseAdmin
      .from("orders")
      .update({
        remaining: order.remainingAmount.toString(),
        status: order.status,
      })
      .eq("chain_id", order.chainId)
      .eq("verifying_contract", order.verifyingContract)
      .eq("maker_address", order.maker)
      .eq("maker_salt", order.salt);
  }

  /**
   * 将撮合记录转换为交易记录
   */
  private matchToTrade(match: Match): Trade {
    return {
      id: match.id,
      matchId: match.id,
      marketKey: match.makerOrder.marketKey,
      outcomeIndex: match.makerOrder.outcomeIndex,
      maker: match.makerOrder.maker,
      taker: match.takerOrder.maker,
      isBuyerMaker: match.makerOrder.isBuy,
      price: match.matchedPrice,
      amount: match.matchedAmount,
      makerFee: match.makerFee,
      takerFee: match.takerFee,
      timestamp: match.timestamp,
    };
  }

  /**
   * 生成撮合 ID
   */
  private generateMatchId(): string {
    return `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 广播事件
   */
  private emitEvent(event: MarketEvent): void {
    this.emit("market_event", event);
  }

  /**
   * 广播深度更新
   */
  private emitDepthUpdate(book: OrderBook): void {
    const depth = book.getDepthSnapshot(20);
    this.emitEvent({ type: "depth_update", depth });
  }

  /**
   * 保存交易记录
   */
  private async saveTradeToDb(match: Match): Promise<void> {
    if (!supabaseAdmin) return;

    await supabaseAdmin.from("trades").upsert(
      {
        network_id: match.makerOrder.chainId,
        market_address: match.makerOrder.verifyingContract,
        outcome_index: match.makerOrder.outcomeIndex,
        price: match.matchedPrice.toString(),
        amount: match.matchedAmount.toString(),
        taker_address: match.takerOrder.maker,
        maker_address: match.makerOrder.maker,
        is_buy: match.takerOrder.isBuy,
        tx_hash: `pending-${match.id}`, // 待链上确认后更新
        log_index: 0,
        fee: (match.makerFee + match.takerFee).toString(),
        salt: match.makerOrder.salt,
        block_number: 0,
        block_timestamp: new Date(match.timestamp).toISOString(),
      },
      {
        onConflict: "tx_hash,log_index",
      }
    );
  }

  /**
   * 获取订单簿快照
   */
  getOrderBookSnapshot(marketKey: string, outcomeIndex: number, maxLevels: number = 20) {
    const book = this.bookManager.getBook(marketKey, outcomeIndex);
    if (!book) return null;
    return book.getDepthSnapshot(maxLevels);
  }

  /**
   * 获取订单簿统计
   */
  getOrderBookStats(marketKey: string, outcomeIndex: number) {
    const book = this.bookManager.getBook(marketKey, outcomeIndex);
    if (!book) return null;
    return book.getStats();
  }

  /**
   * 从数据库恢复订单簿
   */
  async recoverFromDb(marketKey?: string): Promise<void> {
    if (!supabaseAdmin) return;

    let query = supabaseAdmin.from("orders").select("*").in("status", ["open", "partially_filled"]);

    if (marketKey) {
      query = query.eq("market_key", marketKey);
    }

    const { data: orders, error } = await query;
    if (error || !orders) {
      console.error("[MatchingEngine] Failed to recover orders:", error);
      return;
    }

    for (const row of orders) {
      const order: Order = {
        id: `${String(row.maker_address).toLowerCase()}-${row.maker_salt}`,
        marketKey: row.market_key || `${row.chain_id}:unknown`,
        maker: String(row.maker_address).toLowerCase(),
        outcomeIndex: row.outcome_index,
        isBuy: row.is_buy,
        price: BigInt(row.price),
        amount: BigInt(row.amount),
        remainingAmount: BigInt(row.remaining),
        salt: row.maker_salt,
        expiry: row.expiry ? Math.floor(new Date(row.expiry).getTime() / 1000) : 0,
        signature: row.signature,
        chainId: row.chain_id,
        verifyingContract: String(row.verifying_contract).toLowerCase(),
        sequence: BigInt(row.sequence || "0"),
        status: row.status as any,
        createdAt: new Date(row.created_at).getTime(),
      };

      // 检查过期
      if (!this.isExpired(order)) {
        const book = this.bookManager.getOrCreateBook(order.marketKey, order.outcomeIndex);
        book.addOrder(order);
      }
    }

    console.log(`[MatchingEngine] Recovered orders for ${marketKey || "all markets"}`);
  }

  /**
   * 停止引擎
   */
  async shutdown(): Promise<void> {
    console.log("[MatchingEngine] Shutting down...");

    // 🚀 关闭所有结算器
    const shutdownPromises: Promise<void>[] = [];
    for (const [marketKey, settler] of this.batchSettlers.entries()) {
      console.log(`[MatchingEngine] Shutting down settler for ${marketKey}`);
      shutdownPromises.push(settler.shutdown());
    }
    await Promise.all(shutdownPromises);
    this.batchSettlers.clear();

    this.bookManager.clear();
    console.log("[MatchingEngine] Shutdown complete");
  }

  /**
   * 🚀 获取结算统计
   */
  getSettlementStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [marketKey, settler] of this.batchSettlers.entries()) {
      stats[marketKey] = settler.getStats();
    }
    return stats;
  }
}

/**
 * 订单输入类型
 */
export interface OrderInput {
  marketKey: string;
  maker: string;
  outcomeIndex: number;
  isBuy: boolean;
  price: bigint;
  amount: bigint;
  salt: string;
  expiry: number;
  signature: string;
  chainId: number;
  verifyingContract: string;
  tif?: "IOC" | "FOK";
  postOnly?: boolean;
}
