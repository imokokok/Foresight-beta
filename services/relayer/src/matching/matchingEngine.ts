/**
 * 核心订单撮合引擎
 * 实现价格-时间优先撮合算法
 */

import { ethers } from "ethers";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { OrderBookManager, OrderBook } from "./orderBook.js";
import type {
  Order,
  Match,
  MatchResult,
  Trade,
  MarketEvent,
  MatchingEngineConfig,
  OrderErrorCode,
} from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";
import { supabaseAdmin } from "../supabase.js";
import {
  BatchSettler,
  type SettlementEvent,
  type SettlementFill,
  type SettlementOrder,
} from "../settlement/index.js";
import { getRedisClient } from "../redis/client.js";
import { getOrderbookSnapshotService } from "../redis/orderbookSnapshot.js";
import {
  orderbookLockBusyTotal,
  orderbookSnapshotLoadLatency,
  orderbookSnapshotLoadTotal,
  orderbookSnapshotQueueThrottledTotal,
} from "../monitoring/metrics.js";

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

function pickFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}

function getConfiguredRpcUrl(chainId: number): string {
  const generic = pickFirstNonEmptyString(process.env.RPC_URL, process.env.NEXT_PUBLIC_RPC_URL);
  if (generic) return generic;

  if (chainId === 80002) {
    return (
      pickFirstNonEmptyString(
        process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
        "https://rpc-amoy.polygon.technology/"
      ) || "https://rpc-amoy.polygon.technology/"
    );
  }
  if (chainId === 137) {
    return (
      pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_POLYGON, "https://polygon-rpc.com") ||
      "https://polygon-rpc.com"
    );
  }
  if (chainId === 11155111) {
    return (
      pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_SEPOLIA, "https://rpc.sepolia.org") ||
      "https://rpc.sepolia.org"
    );
  }

  return "http://127.0.0.1:8545";
}

function getConfiguredUsdcAddress(): string | undefined {
  return pickFirstNonEmptyString(
    process.env.COLLATERAL_TOKEN_ADDRESS,
    process.env.USDC_ADDRESS,
    process.env.NEXT_PUBLIC_USDC_ADDRESS,
    process.env.NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS
  );
}

const providerByChainId = new Map<number, ethers.JsonRpcProvider>();

function getRpcProvider(chainId: number): ethers.JsonRpcProvider {
  const cached = providerByChainId.get(chainId);
  if (cached) return cached;
  const provider = new ethers.JsonRpcProvider(getConfiguredRpcUrl(chainId));
  providerByChainId.set(chainId, provider);
  return provider;
}

async function isValidErc1271Signature(args: {
  maker: string;
  digest: string;
  signature: string;
  chainId: number;
}) {
  const maker = args.maker.toLowerCase();
  const provider = getRpcProvider(args.chainId);
  const erc1271 = new ethers.Contract(
    maker,
    ["function isValidSignature(bytes32,bytes) view returns (bytes4)"],
    provider
  );
  const magic = await erc1271.isValidSignature(args.digest, args.signature);
  return String(magic).toLowerCase() === "0x1626ba7e";
}

/**
 * 订单撮合引擎
 */
export class MatchingEngine extends EventEmitter {
  private bookManager: OrderBookManager;
  private config: MatchingEngineConfig;
  private sequenceCounter: bigint = 0n;
  private redisSnapshotLoadAttempts: Set<string> = new Set();
  private snapshotQueueLastAtMs: Map<string, number> = new Map();
  private snapshotFullLastAtMs: Map<string, number> = new Map();
  private clientOrderIdCache: Map<string, { expiresAtMs: number; result: MatchResult }> = new Map();
  private expirySweepTimer: ReturnType<typeof setInterval> | null = null;
  private expirySweepRunning = false;

  // 🚀 批量结算器 (Polymarket 模式)
  private batchSettlers: Map<string, BatchSettler> = new Map();
  private bookLocks: Map<string, Promise<void>> = new Map();

  constructor(config: Partial<MatchingEngineConfig> = {}) {
    super();
    this.bookManager = new OrderBookManager();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startExpirySweep();
    this.on("settlement_event", (event) => {
      void this.handleSettlementEvent(event as SettlementEvent);
    });
  }

  private async handleSettlementEvent(event: SettlementEvent): Promise<void> {
    if (event.type !== "fill_settled" && event.type !== "fill_failed") return;
    const fill = (event as any).fill as SettlementFill | undefined;
    if (!fill) return;
    const isBuy = Boolean(fill.order?.isBuy);
    const buyer = (isBuy ? fill.order?.maker : fill.taker || "").toLowerCase();
    if (!ethers.isAddress(buyer)) return;
    const amountMicro = this.orderNotionalUsdc(fill.fillAmount, fill.matchedPrice);
    if (amountMicro <= 0n) return;
    await this.releaseUsdcReservation(buyer, amountMicro);
  }

  private startExpirySweep(): void {
    const raw = process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS;
    const sweepMs = raw === undefined ? 5000 : Number(raw);
    if (!Number.isFinite(sweepMs) || sweepMs <= 0) return;
    this.expirySweepTimer = setInterval(() => {
      void this.runExpirySweepOnce();
    }, sweepMs);
    (this.expirySweepTimer as any)?.unref?.();
  }

  private async runExpirySweepOnce(): Promise<number> {
    if (this.expirySweepRunning) return 0;
    this.expirySweepRunning = true;
    try {
      const books = this.bookManager.getAllBooks();
      if (books.length === 0) return 0;

      let expiredTotal = 0;
      for (const book of books) {
        if (book.getOrderCount() === 0) continue;
        try {
          expiredTotal += await this.withBookLockNoWarmup(
            book.marketKey,
            book.outcomeIndex,
            async () => await this.expireOrdersInBook(book.marketKey, book.outcomeIndex)
          );
        } catch (error: any) {
          const message = String(error?.message || "");
          if (message.includes("Orderbook busy")) continue;
        }
      }
      return expiredTotal;
    } finally {
      this.expirySweepRunning = false;
    }
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
        orderbookLockBusyTotal.inc({
          market_key: marketKey,
          outcome_index: String(outcomeIndex),
          operation: "book_lock",
        });
        throw new Error("Orderbook busy");
      }
      await this.loadSnapshotIfNeeded(marketKey, outcomeIndex);
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

  private async withBookLockNoWarmup<T>(
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
        orderbookLockBusyTotal.inc({
          market_key: marketKey,
          outcome_index: String(outcomeIndex),
          operation: "book_lock",
        });
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

  async warmupOrderBook(marketKey: string, outcomeIndex: number): Promise<void> {
    await this.withBookLock(marketKey, outcomeIndex, async () => {});
  }

  private async loadSnapshotIfNeeded(marketKey: string, outcomeIndex: number): Promise<void> {
    const attemptKey = `${marketKey}:${outcomeIndex}`;
    if (this.redisSnapshotLoadAttempts.has(attemptKey)) return;
    this.redisSnapshotLoadAttempts.add(attemptKey);

    const redis = getRedisClient();
    if (!redis.isReady()) return;

    const existing = this.bookManager.getBook(marketKey, outcomeIndex);
    if (existing && existing.getOrderCount() > 0) return;

    const snapshotService = getOrderbookSnapshotService();
    const startedAt = Date.now();
    let loaded: Awaited<ReturnType<typeof snapshotService.loadSnapshot>> | null = null;
    try {
      loaded = await snapshotService.loadSnapshot(marketKey, outcomeIndex);
    } catch {
      const elapsed = Date.now() - startedAt;
      orderbookSnapshotLoadTotal.inc({ result: "error" });
      orderbookSnapshotLoadLatency.observe({ result: "error" }, elapsed);
      return;
    }
    const elapsed = Date.now() - startedAt;
    if (!loaded) {
      orderbookSnapshotLoadTotal.inc({ result: "miss" });
      orderbookSnapshotLoadLatency.observe({ result: "miss" }, elapsed);
      return;
    }
    orderbookSnapshotLoadTotal.inc({ result: "hit" });
    orderbookSnapshotLoadLatency.observe({ result: "hit" }, elapsed);

    const book = this.bookManager.getOrCreateBook(marketKey, outcomeIndex);
    if (book.getOrderCount() > 0) return;

    const orders = loaded.orders
      .filter((o) => !this.isExpired(o))
      .filter((o) => o.status === "open" || o.status === "partially_filled")
      .sort((a, b) => (a.sequence < b.sequence ? -1 : a.sequence > b.sequence ? 1 : 0));

    let maxSeq = -1n;
    for (const order of orders) {
      book.addOrder(order);
      if (order.sequence > maxSeq) maxSeq = order.sequence;
    }

    const lastTradePrice =
      typeof loaded.stats.lastTradePrice === "bigint" ? loaded.stats.lastTradePrice : null;
    const volume24h = typeof loaded.stats.volume24h === "bigint" ? loaded.stats.volume24h : 0n;
    book.restoreStats(lastTradePrice, volume24h);

    const nextSeq = maxSeq + 1n;
    if (nextSeq > this.sequenceCounter) {
      this.sequenceCounter = nextSeq;
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
    const existing = this.batchSettlers.get(marketKey);
    if (existing) return existing;

    if (!marketKey || marketKey.trim().length === 0) {
      throw new Error("Invalid marketKey");
    }
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new Error("Invalid chainId");
    }
    if (!ethers.isAddress(marketAddress)) {
      throw new Error("Invalid marketAddress");
    }
    if (!ethers.isHexString(operatorPrivateKey, 32)) {
      throw new Error("Invalid operatorPrivateKey");
    }
    if (!rpcUrl || String(rpcUrl).trim().length === 0) {
      throw new Error("Invalid rpcUrl");
    }

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
    let riskLockToken: string | null = null;
    let inflightAcquired = false;
    try {
      if (!orderInput.marketKey || orderInput.marketKey.trim().length === 0) {
        return {
          success: false,
          matches: [],
          remainingOrder: null,
          error: "Invalid marketKey",
          errorCode: "INVALID_MARKET_KEY",
        };
      }
      if (!Number.isInteger(orderInput.outcomeIndex) || orderInput.outcomeIndex < 0) {
        return {
          success: false,
          matches: [],
          remainingOrder: null,
          error: "Invalid outcomeIndex",
          errorCode: "INVALID_OUTCOME_INDEX",
        };
      }
      const cached = this.getClientOrderIdCachedResult(orderInput);
      if (cached) return cached;

      const cachedRemote = await this.getClientOrderIdCachedResultRemote(orderInput);
      if (cachedRemote) {
        this.setClientOrderIdCachedResult(orderInput, cachedRemote);
        return cachedRemote;
      }

      const redis = getRedisClient();
      const idempotencyKey = this.getClientOrderIdCacheKey(orderInput);
      const ttlMs = Math.max(1000, Number(process.env.RELAYER_CLIENT_ORDER_ID_TTL_MS || "60000"));
      const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
      const inflightKey = idempotencyKey ? `client_order_inflight:${idempotencyKey}` : null;
      const resultKey = idempotencyKey ? `client_order_result:${idempotencyKey}` : null;
      const inflight =
        inflightKey && redis.isReady()
          ? await redis.setNx(inflightKey, String(Date.now()), Math.min(60, ttlSeconds))
          : false;
      inflightAcquired = inflight;
      if (inflightKey && redis.isReady() && !inflightAcquired) {
        const waited = await this.waitForRemoteClientOrderIdResult(resultKey!, 2000);
        if (waited) {
          this.setClientOrderIdCachedResult(orderInput, waited);
          return waited;
        }
        const failure: MatchResult = {
          success: false,
          matches: [],
          remainingOrder: null,
          error: "Orderbook busy",
          errorCode: "ORDERBOOK_BUSY",
        };
        await this.setClientOrderIdCachedResultRemote(orderInput, failure);
        this.setClientOrderIdCachedResult(orderInput, failure);
        return failure;
      }

      const riskLockEnabled =
        String(process.env.RELAYER_RISK_LOCK_ENABLED || "true").toLowerCase() !== "false";
      if (riskLockEnabled && redis.isReady() && supabaseAdmin && orderInput.isBuy) {
        const maker = orderInput.maker.toLowerCase();
        const lockKey = `risk:balance:${maker}`;
        riskLockToken = await redis.acquireLock(lockKey, 30000, 50, 100);
        if (!riskLockToken) {
          const failure: MatchResult = {
            success: false,
            matches: [],
            remainingOrder: null,
            error: "Orderbook busy",
            errorCode: "ORDERBOOK_BUSY",
          };
          await this.setClientOrderIdCachedResultRemote(orderInput, failure);
          this.setClientOrderIdCachedResult(orderInput, failure);
          return failure;
        }
      }

      const result = await this.withBookLock(
        orderInput.marketKey,
        orderInput.outcomeIndex,
        async () => {
          let order: Order | null = null;
          let reservedAtStartUsdc = 0n;
          let result: MatchResult = {
            success: false,
            matches: [],
            remainingOrder: null,
            error: "Unknown error",
          };

          try {
            const validationResult = await this.validateOrder(orderInput);
            if (!validationResult.valid) {
              result = {
                success: false,
                matches: [],
                remainingOrder: null,
                error: validationResult.error,
                errorCode: validationResult.errorCode,
              };
              return result;
            }

            order = this.createOrder(orderInput);
            await this.expireOrdersInBook(order.marketKey, order.outcomeIndex);
            reservedAtStartUsdc = await this.reserveUsdcForOrder(order);
            if (reservedAtStartUsdc < 0n) {
              result = {
                success: false,
                matches: [],
                remainingOrder: null,
                error: "Insufficient balance",
                errorCode: "INSUFFICIENT_BALANCE",
              };
              return result;
            }

            if (order.postOnly) {
              const book = this.bookManager.getOrCreateBook(order.marketKey, order.outcomeIndex);
              while (true) {
                const counterOrder = this.config.enableSelfTradeProtection
                  ? book.getBestCounterOrder(order.isBuy, order.maker)
                  : book.getBestCounterOrder(order.isBuy);
                if (!counterOrder) break;
                if (this.isExpired(counterOrder)) {
                  if (counterOrder.isBuy) {
                    await this.releaseUsdcReservation(
                      counterOrder.maker,
                      this.orderNotionalUsdc(counterOrder.remainingAmount, counterOrder.price)
                    );
                  }
                  book.removeOrder(counterOrder.id);
                  await this.updateOrderStatus(counterOrder, "expired");
                  this.emitDepthUpdate(book);
                  continue;
                }
                if (this.pricesMatch(order, counterOrder)) {
                  result = {
                    success: false,
                    matches: [],
                    remainingOrder: null,
                    error: "Post-only order would be immediately executed",
                    errorCode: "INVALID_POST_ONLY",
                  };
                  return result;
                }
                break;
              }
              await this.addToOrderBook(order);
              result = {
                success: true,
                matches: [],
                remainingOrder: order,
              };
              return result;
            }

            const matchResult = await this.matchOrder(order);

            if (matchResult.remainingOrder && matchResult.remainingOrder.remainingAmount > 0n) {
              await this.addToOrderBook(matchResult.remainingOrder);
            }

            if (matchResult.matches.length > 0) {
              for (const match of matchResult.matches) {
                const trade = this.matchToTrade(match);
                this.emit("trade", trade);
                this.emitEvent({ type: "trade", trade });
              }
            }

            result = matchResult;
            return result;
          } finally {
            if (order && reservedAtStartUsdc > 0n) {
              await this.finalizeUsdcReservationAfterSubmit(order, reservedAtStartUsdc, result);
            }
            this.setClientOrderIdCachedResult(orderInput, result);
            await this.setClientOrderIdCachedResultRemote(orderInput, result);
          }
        }
      );
      this.setClientOrderIdCachedResult(orderInput, result);
      await this.setClientOrderIdCachedResultRemote(orderInput, result);
      return result;
    } catch (error: any) {
      console.error("[MatchingEngine] submitOrder error:", error);
      const isBusy = String(error?.message || "").includes("Orderbook busy");
      return {
        success: false,
        matches: [],
        remainingOrder: null,
        error: error?.message || "Unknown error",
        errorCode: isBusy ? "ORDERBOOK_BUSY" : undefined,
      };
    } finally {
      const redis = getRedisClient();
      const idempotencyKey = this.getClientOrderIdCacheKey(orderInput);
      const inflightKey = idempotencyKey ? `client_order_inflight:${idempotencyKey}` : null;
      if (inflightAcquired && inflightKey && redis.isReady()) {
        await redis.del(inflightKey);
      }
      if (riskLockToken) {
        const maker = orderInput.maker.toLowerCase();
        await redis.releaseLock(`risk:balance:${maker}`, riskLockToken);
      }
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
          let available = level.totalQuantity;
          if (this.config.enableSelfTradeProtection) {
            const excluded = order.maker;
            available = 0n;
            for (const o of level.orders) {
              if (o.remainingAmount <= 0n) continue;
              if (o.maker === excluded) continue;
              available += o.remainingAmount;
            }
          }
          required -= available;
          if (required <= 0n) break;
        }
      } else {
        for (const level of depth.bids) {
          if (order.price > level.price) break;
          let available = level.totalQuantity;
          if (this.config.enableSelfTradeProtection) {
            const excluded = order.maker;
            available = 0n;
            for (const o of level.orders) {
              if (o.remainingAmount <= 0n) continue;
              if (o.maker === excluded) continue;
              available += o.remainingAmount;
            }
          }
          required -= available;
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
      const counterOrder = this.config.enableSelfTradeProtection
        ? book.getBestCounterOrder(order.isBuy, order.maker)
        : book.getBestCounterOrder(order.isBuy);

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
        if (counterOrder.isBuy) {
          await this.releaseUsdcReservation(
            counterOrder.maker,
            this.orderNotionalUsdc(counterOrder.remainingAmount, counterOrder.price)
          );
        }
        book.removeOrder(counterOrder.id);
        await this.updateOrderStatus(counterOrder, "expired");
        this.emitDepthUpdate(book);
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

      this.emitEvent({ type: "order_updated", order: counterOrder });

      // 广播订单簿更新
      this.emitDepthUpdate(book);
    }

    if (order.tif === "IOC" || order.tif === "FOK" || order.tif === "FAK") {
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

  private async expireOrdersInBook(marketKey: string, outcomeIndex: number): Promise<number> {
    const book = this.bookManager.getBook(marketKey, outcomeIndex);
    if (!book) return 0;

    const { bidOrders, askOrders } = book.getAllOrders();
    const allOrders = [...bidOrders, ...askOrders];
    if (allOrders.length === 0) return 0;

    let expiredCount = 0;
    const releaseByMaker = new Map<string, bigint>();
    const updates: Array<Pick<Order, "chainId" | "verifyingContract" | "maker" | "salt">> = [];

    for (const o of allOrders) {
      if (!this.isExpired(o)) continue;
      const removed = book.removeOrder(o.id);
      if (!removed) continue;
      expiredCount += 1;
      updates.push(removed);
      if (removed.isBuy) {
        const micro = this.orderNotionalUsdc(removed.remainingAmount, removed.price);
        if (micro > 0n) {
          const maker = removed.maker.toLowerCase();
          releaseByMaker.set(maker, (releaseByMaker.get(maker) || 0n) + micro);
        }
      }
    }

    if (expiredCount === 0) return 0;

    if (supabaseAdmin) {
      for (const o of updates) {
        await this.updateOrderStatus(o, "expired");
      }
    }

    if (supabaseAdmin && releaseByMaker.size > 0) {
      await Promise.all(
        Array.from(releaseByMaker.entries()).map(([maker, micro]) =>
          this.releaseUsdcReservation(maker, micro)
        )
      );
    }

    this.emitDepthUpdate(book);
    return expiredCount;
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

  private orderNotionalUsdc(amount: bigint, price: bigint): bigint {
    if (amount <= 0n || price <= 0n) return 0n;
    return (amount * price) / 1_000_000_000_000_000_000n;
  }

  private formatUsdcUnitsFromMicro(usdcMicro: bigint): string {
    return ethers.formatUnits(usdcMicro, 6);
  }

  private parseUsdcUnitsToMicro(raw: unknown): bigint {
    let numeric = 0;
    if (typeof raw === "number") {
      numeric = raw;
    } else if (typeof raw === "string") {
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed)) numeric = parsed;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) return 0n;
    return BigInt(Math.floor(numeric * 1e6));
  }

  private async reserveUsdcForOrder(order: Order): Promise<bigint> {
    if (!supabaseAdmin) return 0n;
    if (!order.isBuy) return 0n;
    const reserveMicro = this.orderNotionalUsdc(order.remainingAmount, order.price);
    if (reserveMicro <= 0n) return 0n;

    try {
      const { data, error } = await supabaseAdmin.rpc("reserve_user_balance", {
        p_user_address: order.maker,
        p_amount: this.formatUsdcUnitsFromMicro(reserveMicro),
      });
      if (error) {
        const code = String((error as any).code || "");
        if (code === "42883") return 0n;
        return -1n;
      }
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      const ok = row && (row.success === true || row.success === "true");
      return ok ? reserveMicro : -1n;
    } catch {
      return 0n;
    }
  }

  private async releaseUsdcReservation(maker: string, amountMicro: bigint): Promise<void> {
    if (!supabaseAdmin) return;
    if (amountMicro <= 0n) return;
    try {
      const { error } = await supabaseAdmin.rpc("release_user_balance", {
        p_user_address: maker,
        p_amount: this.formatUsdcUnitsFromMicro(amountMicro),
      });
      if (error) {
        const code = String((error as any).code || "");
        if (code === "42883") return;
      }
    } catch {}
  }

  private async finalizeUsdcReservationAfterSubmit(
    order: Order,
    reservedAtStartUsdc: bigint,
    result: MatchResult
  ): Promise<void> {
    if (!order.isBuy) return;
    if (reservedAtStartUsdc <= 0n) return;
    if (!result.success) {
      await this.releaseUsdcReservation(order.maker, reservedAtStartUsdc);
      return;
    }

    let matchedAmount = 0n;
    for (const m of result.matches || []) {
      matchedAmount += m.matchedAmount;
    }

    const matchedMicro =
      matchedAmount > 0n
        ? (() => {
            let total = 0n;
            for (const m of result.matches || []) {
              total += this.orderNotionalUsdc(m.matchedAmount, m.matchedPrice);
            }
            return total;
          })()
        : 0n;

    const remaining = result.remainingOrder?.remainingAmount ?? 0n;
    const remainingMicro = remaining > 0n ? this.orderNotionalUsdc(remaining, order.price) : 0n;
    const keepMicro = matchedMicro + remainingMicro;
    const releaseMicro = reservedAtStartUsdc - keepMicro;
    if (releaseMicro > 0n) {
      await this.releaseUsdcReservation(order.maker, releaseMicro);
    }
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
    signature: string,
    ownerEoa?: string
  ): Promise<{ success: boolean; error?: string; errorCode?: OrderErrorCode }> {
    try {
      if (!marketKey || marketKey.trim().length === 0) {
        return { success: false, error: "Invalid marketKey", errorCode: "INVALID_MARKET_KEY" };
      }
      if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0) {
        return {
          success: false,
          error: "Invalid outcomeIndex",
          errorCode: "INVALID_OUTCOME_INDEX",
        };
      }
      if (!Number.isInteger(chainId) || chainId <= 0) {
        return { success: false, error: "Invalid chainId", errorCode: "INVALID_CHAIN_ID" };
      }
      if (!ethers.isAddress(verifyingContract)) {
        return {
          success: false,
          error: "Invalid verifying contract address",
          errorCode: "INVALID_VERIFYING_CONTRACT",
        };
      }
      if (!ethers.isAddress(maker)) {
        return { success: false, error: "Invalid maker address", errorCode: "INVALID_MAKER" };
      }
      try {
        BigInt(salt);
      } catch {
        return { success: false, error: "Invalid salt", errorCode: "INVALID_SALT" };
      }
      return await this.withBookLock(marketKey, outcomeIndex, async () => {
        const domain = {
          name: "Foresight Market",
          version: "1",
          chainId,
          verifyingContract: verifyingContract.toLowerCase(),
        };
        const value = { maker: maker.toLowerCase(), salt: BigInt(salt) };
        let recovered: string;
        try {
          recovered = ethers.verifyTypedData(domain, CANCEL_TYPES, value, signature);
        } catch {
          return { success: false, error: "Invalid signature", errorCode: "INVALID_SIGNATURE" };
        }
        const expected = [ownerEoa, maker]
          .filter((v): v is string => !!v)
          .map((v) => v.toLowerCase());
        if (!expected.includes(recovered.toLowerCase())) {
          const digest = ethers.TypedDataEncoder.hash(domain, CANCEL_TYPES, value);
          try {
            const ok = await isValidErc1271Signature({ maker, digest, signature, chainId });
            if (!ok) {
              return { success: false, error: "Invalid signature", errorCode: "INVALID_SIGNATURE" };
            }
          } catch {
            return { success: false, error: "Invalid signature", errorCode: "INVALID_SIGNATURE" };
          }
        }

        const orderId = `${maker.toLowerCase()}-${salt}`;
        const book = this.bookManager.getBook(marketKey, outcomeIndex);
        const removed = book ? book.removeOrder(orderId) : null;
        let releaseMicro = 0n;

        if (supabaseAdmin) {
          if (removed && removed.isBuy) {
            releaseMicro = this.orderNotionalUsdc(removed.remainingAmount, removed.price);
          } else if (!removed) {
            const { data } = await supabaseAdmin
              .from("orders")
              .select("price, remaining, is_buy")
              .eq("chain_id", chainId)
              .eq("verifying_contract", verifyingContract.toLowerCase())
              .eq("maker_address", maker.toLowerCase())
              .eq("maker_salt", salt)
              .in("status", ["open", "partially_filled"])
              .maybeSingle();
            if (data && (data as any).is_buy) {
              try {
                const price = BigInt((data as any).price);
                const remaining = BigInt((data as any).remaining);
                releaseMicro = this.orderNotionalUsdc(remaining, price);
              } catch {}
            }
          }

          await supabaseAdmin
            .from("orders")
            .update({ status: "canceled", remaining: "0" })
            .eq("chain_id", chainId)
            .eq("verifying_contract", verifyingContract.toLowerCase())
            .eq("maker_address", maker.toLowerCase())
            .eq("maker_salt", salt)
            .in("status", ["open", "partially_filled"]);

          if (releaseMicro > 0n) {
            await this.releaseUsdcReservation(maker.toLowerCase(), releaseMicro);
          }
        }

        if (book && removed) {
          this.emitEvent({
            type: "order_canceled",
            orderId,
            marketKey,
            outcomeIndex,
            releasedUsdcMicro: releaseMicro > 0n ? releaseMicro.toString() : undefined,
          });
          this.emitDepthUpdate(book);
        } else {
          this.emitEvent({
            type: "order_canceled",
            orderId,
            marketKey,
            outcomeIndex,
            releasedUsdcMicro: releaseMicro > 0n ? releaseMicro.toString() : undefined,
          });
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
  private async validateOrder(input: OrderInput): Promise<{
    valid: boolean;
    error?: string;
    errorCode?: OrderErrorCode;
  }> {
    // 1. 验证基本参数
    if (!input.marketKey || input.marketKey.trim().length === 0) {
      return { valid: false, error: "Invalid marketKey", errorCode: "INVALID_MARKET_KEY" };
    }
    if (!Number.isInteger(input.outcomeIndex) || input.outcomeIndex < 0) {
      return { valid: false, error: "Invalid outcomeIndex", errorCode: "INVALID_OUTCOME_INDEX" };
    }
    if (!Number.isInteger(input.chainId) || input.chainId <= 0) {
      return { valid: false, error: "Invalid chainId", errorCode: "INVALID_CHAIN_ID" };
    }
    if (!ethers.isAddress(input.verifyingContract)) {
      return {
        valid: false,
        error: "Invalid verifying contract address",
        errorCode: "INVALID_VERIFYING_CONTRACT",
      };
    }
    if (!Number.isInteger(input.expiry) || input.expiry < 0) {
      return { valid: false, error: "Invalid expiry", errorCode: "INVALID_EXPIRY" };
    }
    try {
      BigInt(input.salt);
    } catch {
      return { valid: false, error: "Invalid salt", errorCode: "INVALID_SALT" };
    }

    if (!ethers.isAddress(input.maker)) {
      return { valid: false, error: "Invalid maker address", errorCode: "INVALID_MAKER" };
    }

    if (input.price < this.config.minPrice || input.price > this.config.maxPrice) {
      return { valid: false, error: "Price out of range", errorCode: "INVALID_PRICE" };
    }

    const tickOffset = input.price - this.config.minPrice;
    if (tickOffset % this.config.priceTickSize !== 0n) {
      return {
        valid: false,
        error: "Price not aligned to tick size",
        errorCode: "INVALID_TICK_SIZE",
      };
    }

    if (input.amount < this.config.minOrderAmount) {
      return { valid: false, error: "Amount below minimum", errorCode: "INVALID_AMOUNT" };
    }

    if (input.amount > this.config.maxOrderAmount) {
      return { valid: false, error: "Amount exceeds maximum", errorCode: "INVALID_AMOUNT" };
    }

    if (
      input.tif &&
      input.tif !== "IOC" &&
      input.tif !== "FOK" &&
      input.tif !== "FAK" &&
      input.tif !== "GTC" &&
      input.tif !== "GTD"
    ) {
      return { valid: false, error: "Invalid time in force", errorCode: "INVALID_TIME_IN_FORCE" };
    }

    if (
      input.postOnly &&
      input.tif &&
      (input.tif === "IOC" || input.tif === "FOK" || input.tif === "FAK")
    ) {
      return {
        valid: false,
        error: "Post-only cannot be combined with IOC/FAK/FOK",
        errorCode: "INVALID_POST_ONLY",
      };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (input.tif === "GTD") {
      if (input.expiry === 0) {
        return { valid: false, error: "GTD requires expiry", errorCode: "INVALID_EXPIRY" };
      }
      if (nowSeconds >= input.expiry) {
        return { valid: false, error: "Order expired", errorCode: "ORDER_EXPIRED" };
      }
      if (this.config.gtdMaxExpiryDays && this.config.gtdMaxExpiryDays > 0) {
        const maxExpiry = nowSeconds + Math.floor(this.config.gtdMaxExpiryDays * 86400);
        if (input.expiry > maxExpiry) {
          return { valid: false, error: "Expiry too far in future", errorCode: "INVALID_EXPIRY" };
        }
      }
    } else if (input.expiry !== 0 && nowSeconds >= input.expiry) {
      return { valid: false, error: "Order expired", errorCode: "ORDER_EXPIRED" };
    }

    // 2. 验证签名
    const signatureValid = await this.verifySignature(input);
    if (!signatureValid) {
      return { valid: false, error: "Invalid signature", errorCode: "INVALID_SIGNATURE" };
    }

    // 3. 检查订单是否已存在 (防止重放)
    const localOrderId = `${input.maker.toLowerCase()}-${input.salt}`;
    const localBook = this.bookManager.getBook(input.marketKey, input.outcomeIndex);
    if (localBook?.hasOrder(localOrderId)) {
      return {
        valid: false,
        error: "Order with this salt already exists",
        errorCode: "DUPLICATE_ORDER",
      };
    }
    const exists = await this.checkOrderExists(
      input.chainId,
      input.verifyingContract.toLowerCase(),
      input.maker,
      input.salt
    );
    if (exists) {
      return {
        valid: false,
        error: "Order with this salt already exists",
        errorCode: "DUPLICATE_ORDER",
      };
    }

    const riskCheck = await this.checkBalanceAndRisk(input);
    if (!riskCheck.valid) {
      return riskCheck;
    }

    return { valid: true };
  }

  private async checkBalanceAndRisk(
    input: OrderInput
  ): Promise<{ valid: boolean; error?: string; errorCode?: OrderErrorCode }> {
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
          return {
            valid: false,
            error: "Market long exposure limit exceeded",
            errorCode: "MARKET_LONG_EXPOSURE_LIMIT",
          };
        }
      }

      if (this.config.maxMarketShortExposureUsdc && this.config.maxMarketShortExposureUsdc > 0) {
        const limitUsdc = BigInt(Math.floor(this.config.maxMarketShortExposureUsdc * 1e6));
        const newShortExposure = marketShortUsdc + (!input.isBuy ? orderCostUsdc : 0n);
        if (newShortExposure > limitUsdc) {
          return {
            valid: false,
            error: "Market short exposure limit exceeded",
            errorCode: "MARKET_SHORT_EXPOSURE_LIMIT",
          };
        }
      }

      if (!supabaseAdmin) {
        return { valid: true };
      }

      if (!input.isBuy) {
        return { valid: true };
      }

      let balanceRow: any = null;
      try {
        const res = await supabaseAdmin
          .from("user_balances")
          .select("balance,reserved")
          .eq("user_address", makerAddress)
          .maybeSingle();
        if (!res.error) balanceRow = res.data;
      } catch {}

      if (!balanceRow) {
        try {
          const res = await supabaseAdmin
            .from("user_balances")
            .select("balance")
            .eq("user_address", makerAddress)
            .maybeSingle();
          if (!res.error) balanceRow = res.data;
        } catch {}
      }

      const offchainBalanceUsdc = balanceRow ? this.parseUsdcUnitsToMicro(balanceRow.balance) : 0n;
      const ledgerReservedUsdc =
        balanceRow && "reserved" in balanceRow
          ? this.parseUsdcUnitsToMicro(balanceRow.reserved)
          : null;

      let reservedUsdc = 0n;
      if (ledgerReservedUsdc !== null) {
        reservedUsdc = ledgerReservedUsdc;
        const reconcileEnabled =
          String(process.env.RELAYER_RESERVED_RECONCILE_ENABLED || "true").toLowerCase() !==
          "false";
        if (reconcileEnabled) {
          const { data: openOrders } = await supabaseAdmin
            .from("orders")
            .select("price, remaining")
            .eq("maker_address", makerAddress)
            .eq("is_buy", true)
            .in("status", ["open", "partially_filled"]);

          let computed = 0n;
          for (const row of openOrders || []) {
            const price = BigInt((row as any).price);
            const remaining = BigInt((row as any).remaining);
            computed += this.orderNotionalUsdc(remaining, price);
          }

          if (computed > reservedUsdc) reservedUsdc = computed;
        }
      } else {
        const { data: openOrders } = await supabaseAdmin
          .from("orders")
          .select("price, remaining")
          .eq("maker_address", makerAddress)
          .eq("is_buy", true)
          .in("status", ["open", "partially_filled"]);

        for (const row of openOrders || []) {
          const price = BigInt((row as any).price);
          const remaining = BigInt((row as any).remaining);
          reservedUsdc += this.orderNotionalUsdc(remaining, price);
        }
      }

      const totalRequiredUsdc = reservedUsdc + orderCostUsdc;

      if (totalRequiredUsdc > offchainBalanceUsdc) {
        const usdcAddress = getConfiguredUsdcAddress();
        if (!usdcAddress || !ethers.isAddress(usdcAddress)) {
          return {
            valid: false,
            error: "Insufficient balance",
            errorCode: "INSUFFICIENT_BALANCE",
          };
        }

        try {
          const provider = getRpcProvider(input.chainId);
          const usdc = new ethers.Contract(
            usdcAddress,
            ["function balanceOf(address account) view returns (uint256)"],
            provider
          );
          const onchainBalanceUsdc = BigInt(await usdc.balanceOf(makerAddress));

          if (totalRequiredUsdc <= onchainBalanceUsdc) {
            try {
              await supabaseAdmin.from("user_balances").upsert(
                {
                  user_address: makerAddress,
                  balance: ethers.formatUnits(onchainBalanceUsdc, 6),
                },
                { onConflict: "user_address" }
              );
            } catch {}

            return { valid: true };
          }
        } catch {}

        return { valid: false, error: "Insufficient balance", errorCode: "INSUFFICIENT_BALANCE" };
      }

      return { valid: true };
    } catch (error: any) {
      console.error("[MatchingEngine] Balance check failed", error);
      return { valid: false, error: "Balance check failed", errorCode: "BALANCE_CHECK_FAILED" };
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
      const expected = [input.ownerEoa, input.maker]
        .filter((v): v is string => !!v)
        .map((v) => v.toLowerCase());
      if (expected.includes(recovered.toLowerCase())) return true;

      const digest = ethers.TypedDataEncoder.hash(domain, ORDER_TYPES, orderData);
      try {
        return await isValidErc1271Signature({
          maker: input.maker,
          digest,
          signature: input.signature,
          chainId: input.chainId,
        });
      } catch {
        return false;
      }
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
      makerOrderId: match.makerOrder.id,
      takerOrderId: match.takerOrder.id,
      makerSalt: match.makerOrder.salt,
      takerSalt: match.takerOrder.salt,
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
    return `match-${Date.now()}-${randomUUID()}`;
  }

  /**
   * 广播事件
   */
  private emitEvent(event: MarketEvent): void {
    this.emit("market_event", event);
    this.persistMarketEvent(event);
  }

  private toBigInt(value: unknown): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(Math.trunc(value));
    if (typeof value === "string") return BigInt(value);
    throw new Error("Invalid bigint");
  }

  private normalizeRecoveredOrder(order: any): Order {
    return {
      id: String(order.id),
      marketKey: String(order.marketKey),
      maker: String(order.maker),
      outcomeIndex: Number(order.outcomeIndex),
      isBuy: Boolean(order.isBuy),
      price: this.toBigInt(order.price),
      amount: this.toBigInt(order.amount),
      remainingAmount: this.toBigInt(order.remainingAmount),
      salt: String(order.salt),
      expiry: Number(order.expiry),
      signature: String(order.signature),
      chainId: Number(order.chainId),
      verifyingContract: String(order.verifyingContract),
      sequence: this.toBigInt(order.sequence),
      status: order.status as any,
      createdAt: Number(order.createdAt),
      tif: order.tif,
      postOnly: order.postOnly,
    };
  }

  private normalizeRecoveredTrade(trade: any): Trade {
    return {
      id: String(trade.id),
      matchId: String(trade.matchId),
      marketKey: String(trade.marketKey),
      outcomeIndex: Number(trade.outcomeIndex),
      maker: String(trade.maker),
      taker: String(trade.taker),
      makerOrderId: trade.makerOrderId ? String(trade.makerOrderId) : undefined,
      takerOrderId: trade.takerOrderId ? String(trade.takerOrderId) : undefined,
      makerSalt: trade.makerSalt ? String(trade.makerSalt) : undefined,
      takerSalt: trade.takerSalt ? String(trade.takerSalt) : undefined,
      isBuyerMaker: Boolean(trade.isBuyerMaker),
      price: this.toBigInt(trade.price),
      amount: this.toBigInt(trade.amount),
      makerFee: this.toBigInt(trade.makerFee),
      takerFee: this.toBigInt(trade.takerFee),
      txHash: trade.txHash ? String(trade.txHash) : undefined,
      blockNumber: typeof trade.blockNumber === "number" ? trade.blockNumber : undefined,
      timestamp: Number(trade.timestamp),
    };
  }

  async recoverFromEventLog(): Promise<{ replayed: number; skipped: number }> {
    if (process.env.RELAYER_MATCHING_EVENTLOG_ENABLED !== "true") {
      return { replayed: 0, skipped: 0 };
    }

    const redis = getRedisClient();
    if (!redis.isReady()) return { replayed: 0, skipped: 0 };
    const raw = redis.getRawClient();
    if (!raw) return { replayed: 0, skipped: 0 };

    const keyPrefix = process.env.REDIS_KEY_PREFIX || "foresight:";
    const listKey = `${keyPrefix}matching:events`;
    const maxLen = Math.max(1000, Number(process.env.RELAYER_MATCHING_EVENTLOG_MAXLEN || "50000"));

    const envelopes = await raw.lRange(listKey, 0, maxLen - 1);
    if (!envelopes || envelopes.length === 0) return { replayed: 0, skipped: 0 };

    const now = Date.now();
    const volumeWindowStart = now - 24 * 60 * 60 * 1000;
    const statsByBook = new Map<
      string,
      { lastTradePrice: bigint | null; lastTradeAt: number; volume24h: bigint }
    >();

    let replayed = 0;
    let skipped = 0;
    let maxSeq = this.sequenceCounter;

    for (const envelopeRaw of [...envelopes].reverse()) {
      try {
        const envelope = JSON.parse(envelopeRaw || "{}") as any;
        if (!envelope || typeof envelope.payload !== "string") {
          skipped += 1;
          continue;
        }

        const eventParsed = JSON.parse(envelope.payload) as any;
        if (!eventParsed || typeof eventParsed.type !== "string") {
          skipped += 1;
          continue;
        }

        if (eventParsed.type === "order_placed" || eventParsed.type === "order_updated") {
          const order = this.normalizeRecoveredOrder(eventParsed.order);
          if (this.isExpired(order)) {
            const book = this.bookManager.getBook(order.marketKey, order.outcomeIndex);
            if (book) book.removeOrder(order.id);
            replayed += 1;
            continue;
          }
          const book = this.bookManager.getOrCreateBook(order.marketKey, order.outcomeIndex);
          if (eventParsed.type === "order_placed") {
            book.addOrder(order);
          } else {
            book.updateOrder(order);
          }
          if (order.sequence > maxSeq) maxSeq = order.sequence;
          replayed += 1;
          continue;
        }

        if (eventParsed.type === "order_canceled") {
          const orderId = String(eventParsed.orderId || "");
          const marketKey = String(eventParsed.marketKey || "");
          const outcomeIndex =
            typeof eventParsed.outcomeIndex === "number"
              ? eventParsed.outcomeIndex
              : typeof envelope.outcomeIndex === "string" && envelope.outcomeIndex.length > 0
                ? Number(envelope.outcomeIndex)
                : undefined;

          if (!orderId || !marketKey) {
            skipped += 1;
            continue;
          }

          if (typeof outcomeIndex === "number" && Number.isFinite(outcomeIndex)) {
            const book = this.bookManager.getBook(marketKey, outcomeIndex);
            if (book) book.removeOrder(orderId);
          } else {
            for (const book of this.bookManager.getAllBooks()) {
              if (book.marketKey !== marketKey) continue;
              if (book.hasOrder(orderId)) {
                book.removeOrder(orderId);
              }
            }
          }
          replayed += 1;
          continue;
        }

        if (eventParsed.type === "trade") {
          const trade = this.normalizeRecoveredTrade(eventParsed.trade);
          const book = this.bookManager.getOrCreateBook(trade.marketKey, trade.outcomeIndex);
          void book;

          const key = `${trade.marketKey}|${trade.outcomeIndex}`;
          const prev = statsByBook.get(key) || {
            lastTradePrice: null,
            lastTradeAt: -1,
            volume24h: 0n,
          };
          const ts = Number.isFinite(trade.timestamp) ? trade.timestamp : now;
          if (ts >= prev.lastTradeAt) {
            prev.lastTradeAt = ts;
            prev.lastTradePrice = trade.price;
          }
          if (ts >= volumeWindowStart) {
            prev.volume24h += trade.amount;
          }
          statsByBook.set(key, prev);

          replayed += 1;
          continue;
        }

        skipped += 1;
      } catch {
        skipped += 1;
      }
    }

    for (const [key, stats] of statsByBook.entries()) {
      const sep = key.lastIndexOf("|");
      const marketKey = sep >= 0 ? key.slice(0, sep) : "";
      const outcomeIndexRaw = sep >= 0 ? key.slice(sep + 1) : "";
      const outcomeIndex = Number(outcomeIndexRaw);
      if (!marketKey || !Number.isFinite(outcomeIndex)) continue;
      const book = this.bookManager.getBook(marketKey, outcomeIndex);
      if (!book) continue;
      book.restoreStats(stats.lastTradePrice, stats.volume24h);
    }

    const nextSeq = maxSeq + 1n;
    if (nextSeq > this.sequenceCounter) {
      this.sequenceCounter = nextSeq;
    }

    return { replayed, skipped };
  }

  private persistMarketEvent(event: MarketEvent): void {
    if (process.env.RELAYER_MATCHING_EVENTLOG_ENABLED !== "true") return;

    if (event.type === "depth_update" || event.type === "stats_update") {
      return;
    }

    const redis = getRedisClient();
    if (!redis.isReady()) return;
    const raw = redis.getRawClient();
    if (!raw) return;

    const keyPrefix = process.env.REDIS_KEY_PREFIX || "foresight:";
    const listKey = `${keyPrefix}matching:events`;

    const maxLen = Math.max(1000, Number(process.env.RELAYER_MATCHING_EVENTLOG_MAXLEN || "50000"));
    const ttlSeconds = Math.max(
      60,
      Number(process.env.RELAYER_MATCHING_EVENTLOG_TTL_SECONDS || String(3600 * 24))
    );

    const safeJson = JSON.stringify(event, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

    let marketKey = "";
    let outcomeIndex = "";
    if (event.type === "order_placed" || event.type === "order_updated") {
      marketKey = event.order.marketKey;
      outcomeIndex = String(event.order.outcomeIndex);
    } else if (event.type === "order_canceled") {
      marketKey = event.marketKey;
      const oi = (event as any).outcomeIndex;
      if (typeof oi === "number") {
        outcomeIndex = String(oi);
      }
    } else if (event.type === "trade") {
      marketKey = event.trade.marketKey;
      outcomeIndex = String(event.trade.outcomeIndex);
    }

    const envelope = JSON.stringify({
      ts: Date.now(),
      type: event.type,
      marketKey,
      outcomeIndex,
      payload: safeJson,
    });

    void (async () => {
      try {
        await raw.lPush(listKey, envelope);
        await raw.lTrim(listKey, 0, maxLen - 1);
        await raw.expire(listKey, ttlSeconds);
      } catch {}
    })();
  }

  /**
   * 广播深度更新
   */
  private emitDepthUpdate(book: OrderBook): void {
    const depth50 = book.getDepthSnapshot(50);
    const depth20 = {
      ...depth50,
      bids: depth50.bids.slice(0, 20),
      asks: depth50.asks.slice(0, 20),
    };
    this.emitEvent({ type: "depth_update", depth: depth20 });

    const redis = getRedisClient();
    if (!redis.isReady()) return;

    const queueKey = `${book.marketKey}:${book.outcomeIndex}`;
    const now = Date.now();
    const lastAt = this.snapshotQueueLastAtMs.get(queueKey) || 0;
    if (now - lastAt < 1000) {
      orderbookSnapshotQueueThrottledTotal.inc({
        market_key: book.marketKey,
        outcome_index: String(book.outcomeIndex),
      });
      return;
    }
    this.snapshotQueueLastAtMs.set(queueKey, now);

    const snapshotService = getOrderbookSnapshotService();
    const stats = book.getStats();
    snapshotService.queuePublicSnapshot(book.marketKey, book.outcomeIndex, depth50, stats);

    const fullIntervalMs = Math.max(
      1000,
      Number(process.env.RELAYER_ORDERBOOK_FULL_SNAPSHOT_INTERVAL_MS || "30000")
    );
    const lastFullAt = this.snapshotFullLastAtMs.get(queueKey) || 0;
    if (now - lastFullAt < fullIntervalMs) return;
    this.snapshotFullLastAtMs.set(queueKey, now);

    const { bidOrders, askOrders } = book.getAllOrders();
    snapshotService.queueSnapshot(book.marketKey, book.outcomeIndex, bidOrders, askOrders, stats);
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

  async closeMarket(
    marketKey: string,
    options?: { reason?: string }
  ): Promise<{
    marketKey: string;
    outcomes: number[];
    canceledOrders: number;
    clearedBooks: number;
    reason: string | null;
  }> {
    const normalizedMarketKey = String(marketKey || "").trim();
    if (!normalizedMarketKey) {
      throw new Error("Invalid marketKey");
    }

    const outcomeSet = new Set<number>();
    for (const book of this.bookManager.getAllBooks()) {
      if (book.marketKey === normalizedMarketKey) {
        outcomeSet.add(book.outcomeIndex);
      }
    }

    const orderIdsByOutcome = new Map<number, string[]>();
    const releaseByMaker = new Map<string, bigint>();
    const releaseMicroByOrderId = new Map<string, bigint>();
    const releasedOrderIds = new Set<string>();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select("maker_address,maker_salt,outcome_index,status,is_buy,price,remaining")
        .eq("market_key", normalizedMarketKey)
        .in("status", ["open", "partially_filled", "filled_partial"])
        .limit(10000);

      if (!error && data) {
        for (const row of data as any[]) {
          const outcomeIndex = Number(row.outcome_index);
          const maker = String(row.maker_address || "").toLowerCase();
          const salt = String(row.maker_salt || "");
          if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0) continue;
          if (!maker || !salt) continue;
          outcomeSet.add(outcomeIndex);
          const id = `${maker}-${salt}`;
          const arr = orderIdsByOutcome.get(outcomeIndex);
          if (arr) arr.push(id);
          else orderIdsByOutcome.set(outcomeIndex, [id]);

          if (row.is_buy === true && !releasedOrderIds.has(id)) {
            try {
              const price = BigInt(String(row.price || "0"));
              const remaining = BigInt(String(row.remaining || "0"));
              const micro = this.orderNotionalUsdc(remaining, price);
              if (micro > 0n) {
                releasedOrderIds.add(id);
                releaseMicroByOrderId.set(id, micro);
                releaseByMaker.set(maker, (releaseByMaker.get(maker) || 0n) + micro);
              }
            } catch {}
          }
        }
      }

      await supabaseAdmin
        .from("orders")
        .update({ status: "canceled", remaining: "0" })
        .eq("market_key", normalizedMarketKey)
        .in("status", ["open", "partially_filled", "filled_partial"]);
    }

    const outcomes = Array.from(outcomeSet).sort((a, b) => a - b);
    const snapshotService = getOrderbookSnapshotService();
    const emitted = new Set<string>();
    let clearedBooks = 0;
    let canceledOrders = 0;

    for (const outcomeIndex of outcomes) {
      await this.withBookLockNoWarmup(normalizedMarketKey, outcomeIndex, async () => {
        const book = this.bookManager.getBook(normalizedMarketKey, outcomeIndex);

        const ids = new Set<string>();
        const fromDb = orderIdsByOutcome.get(outcomeIndex) || [];
        for (const id of fromDb) ids.add(id);

        if (book) {
          const { bidOrders, askOrders } = book.getAllOrders();
          for (const o of [...bidOrders, ...askOrders]) {
            if (o) ids.add(o.id);
          }

          for (const o of bidOrders) {
            if (!o || !o.isBuy) continue;
            if (releasedOrderIds.has(o.id)) continue;
            const micro = this.orderNotionalUsdc(o.remainingAmount, o.price);
            if (micro <= 0n) continue;
            releasedOrderIds.add(o.id);
            releaseMicroByOrderId.set(o.id, micro);
            releaseByMaker.set(o.maker, (releaseByMaker.get(o.maker) || 0n) + micro);
          }
        }

        for (const id of ids) {
          if (emitted.has(id)) continue;
          emitted.add(id);
          canceledOrders++;
          this.emitEvent({
            type: "order_canceled",
            orderId: id,
            marketKey: normalizedMarketKey,
            outcomeIndex,
            releasedUsdcMicro:
              releaseMicroByOrderId.has(id) && releaseMicroByOrderId.get(id)! > 0n
                ? releaseMicroByOrderId.get(id)!.toString()
                : undefined,
          });
        }

        if (book) {
          book.clear();
          this.emitEvent({ type: "depth_update", depth: book.getDepthSnapshot(20) });
          this.emitEvent({ type: "stats_update", stats: book.getStats() });
          this.bookManager.removeBook(normalizedMarketKey, outcomeIndex);
          clearedBooks++;
        }

        this.snapshotQueueLastAtMs.delete(`${normalizedMarketKey}:${outcomeIndex}`);
        this.snapshotFullLastAtMs.delete(`${normalizedMarketKey}:${outcomeIndex}`);
        this.redisSnapshotLoadAttempts.delete(`${normalizedMarketKey}:${outcomeIndex}`);

        try {
          await snapshotService.deleteOrderbookState(normalizedMarketKey, outcomeIndex);
        } catch {}
      });
    }

    if (supabaseAdmin && releaseByMaker.size > 0) {
      await Promise.all(
        Array.from(releaseByMaker.entries()).map(([maker, micro]) =>
          this.releaseUsdcReservation(maker, micro)
        )
      );
    }

    return {
      marketKey: normalizedMarketKey,
      outcomes,
      canceledOrders,
      clearedBooks,
      reason: typeof options?.reason === "string" ? options.reason : null,
    };
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

      if (this.isExpired(order)) {
        if (order.isBuy) {
          const releaseMicro = this.orderNotionalUsdc(order.remainingAmount, order.price);
          await this.releaseUsdcReservation(order.maker, releaseMicro);
        }
        await this.updateOrderStatus(order, "expired");
        continue;
      }

      const book = this.bookManager.getOrCreateBook(order.marketKey, order.outcomeIndex);
      book.addOrder(order);
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

    if (this.expirySweepTimer) {
      clearInterval(this.expirySweepTimer);
      this.expirySweepTimer = null;
    }

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

  private getClientOrderIdCacheKey(input: OrderInput): string | null {
    const raw = typeof input.clientOrderId === "string" ? input.clientOrderId.trim() : "";
    if (!raw) return null;
    return `${input.maker.toLowerCase()}:${input.marketKey}:${input.outcomeIndex}:${raw}`;
  }

  private async getClientOrderIdCachedResultRemote(input: OrderInput): Promise<MatchResult | null> {
    const redis = getRedisClient();
    if (!redis.isReady()) return null;
    const key = this.getClientOrderIdCacheKey(input);
    if (!key) return null;
    const raw = await redis.get(`client_order_result:${key}`);
    if (!raw) return null;
    return this.deserializeMatchResult(raw);
  }

  private async waitForRemoteClientOrderIdResult(
    resultKey: string,
    timeoutMs: number
  ): Promise<MatchResult | null> {
    const redis = getRedisClient();
    if (!redis.isReady()) return null;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const raw = await redis.get(resultKey);
      if (raw) return this.deserializeMatchResult(raw);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  private async setClientOrderIdCachedResultRemote(
    input: OrderInput,
    result: MatchResult
  ): Promise<void> {
    const redis = getRedisClient();
    if (!redis.isReady()) return;
    const key = this.getClientOrderIdCacheKey(input);
    if (!key) return;
    const ttlMs = Math.max(1000, Number(process.env.RELAYER_CLIENT_ORDER_ID_TTL_MS || "60000"));
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await redis.set(`client_order_result:${key}`, this.serializeMatchResult(result), ttlSeconds);
  }

  private serializeMatchResult(result: MatchResult): string {
    return JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  }

  private deserializeMatchResult(raw: string): MatchResult | null {
    try {
      const bigintKeys = new Set([
        "price",
        "amount",
        "remainingAmount",
        "sequence",
        "matchedAmount",
        "matchedPrice",
        "makerFee",
        "takerFee",
        "volume24h",
        "lastTradePrice",
      ]);
      return JSON.parse(raw, (k, v) => {
        if (typeof v === "string" && bigintKeys.has(k) && /^-?\d+$/.test(v)) {
          try {
            return BigInt(v);
          } catch {
            return v;
          }
        }
        return v;
      });
    } catch {
      return null;
    }
  }

  private getClientOrderIdCachedResult(input: OrderInput): MatchResult | null {
    const key = this.getClientOrderIdCacheKey(input);
    if (!key) return null;
    const cached = this.clientOrderIdCache.get(key);
    if (!cached) return null;
    if (cached.expiresAtMs <= Date.now()) {
      this.clientOrderIdCache.delete(key);
      return null;
    }
    return cached.result;
  }

  private setClientOrderIdCachedResult(input: OrderInput, result: MatchResult): void {
    const key = this.getClientOrderIdCacheKey(input);
    if (!key) return;
    const ttlMs = Math.max(1000, Number(process.env.RELAYER_CLIENT_ORDER_ID_TTL_MS || "60000"));
    this.clientOrderIdCache.set(key, { expiresAtMs: Date.now() + ttlMs, result });
    if (this.clientOrderIdCache.size > 20000) {
      const now = Date.now();
      for (const [k, v] of this.clientOrderIdCache.entries()) {
        if (v.expiresAtMs <= now) this.clientOrderIdCache.delete(k);
      }
    }
  }
}

/**
 * 订单输入类型
 */
export interface OrderInput {
  marketKey: string;
  maker: string;
  ownerEoa?: string;
  outcomeIndex: number;
  isBuy: boolean;
  price: bigint;
  amount: bigint;
  salt: string;
  expiry: number;
  signature: string;
  chainId: number;
  verifyingContract: string;
  tif?: "IOC" | "FOK" | "FAK" | "GTC" | "GTD";
  postOnly?: boolean;
  clientOrderId?: string;
}
