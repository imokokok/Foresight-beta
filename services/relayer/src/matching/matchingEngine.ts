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

// 导入拆分后的模块
import {
  checkBalanceAndRisk,
  reserveUsdcForOrder,
  releaseUsdcReservation,
  finalizeUsdcReservationAfterSubmit,
} from "./riskManagement.js";
import { validateOrder } from "./orderValidation.js";
import {
  addToOrderBook,
  expireOrdersInBook,
  updateOrderStatus,
  saveOrderToDb,
  updateOrderInDb,
  isExpired,
} from "./orderManagement.js";
import {
  matchOrder,
  matchToTrade,
  pricesMatch,
  calculateFees,
  generateMatchId,
} from "./matchingLogic.js";
import {
  pickFirstNonEmptyString,
  orderNotionalUsdc,
  formatUsdcUnitsFromMicro,
  parseUsdcUnitsToMicro,
  getConfiguredOutcomeTokenAddress,
  getConfiguredUsdcAddress,
} from "./utils.js";
import { isValidErc1271Signature, getRpcProvider } from "./orderValidation.js";

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
  Cancel: [
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
    const amountMicro = orderNotionalUsdc(fill.fillAmount, fill.matchedPrice);
    if (amountMicro <= 0n) return;
    await releaseUsdcReservation(buyer, amountMicro);
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
            async () =>
              await expireOrdersInBook(
                book.marketKey,
                book.outcomeIndex,
                this.bookManager,
                this.emitDepthUpdate.bind(this)
              )
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
      .filter((o) => !isExpired(o))
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
            // 1. 验证订单基本参数
            const basicValidation = await validateOrder(orderInput, this.config);
            if (!basicValidation.valid) {
              result = {
                success: false,
                matches: [],
                remainingOrder: null,
                error: basicValidation.error,
                errorCode: basicValidation.errorCode as OrderErrorCode,
              };
              return result;
            }

            // 2. 验证签名
            const signatureValid = await this.verifySignature(orderInput);
            if (!signatureValid) {
              result = {
                success: false,
                matches: [],
                remainingOrder: null,
                error: "Invalid signature",
                errorCode: "INVALID_SIGNATURE",
              };
              return result;
            }

            // 3. 检查订单是否已存在
            const localOrderId = `${orderInput.maker.toLowerCase()}-${orderInput.salt}`;
            const localBook = this.bookManager.getBook(
              orderInput.marketKey,
              orderInput.outcomeIndex
            );
            if (localBook?.hasOrder(localOrderId)) {
              result = {
                success: false,
                matches: [],
                remainingOrder: null,
                error: "Order with this salt already exists",
                errorCode: "DUPLICATE_ORDER",
              };
              return result;
            }
            const exists = await this.checkOrderExists(
              orderInput.chainId,
              orderInput.verifyingContract.toLowerCase(),
              orderInput.maker,
              orderInput.salt
            );
            if (exists) {
              result = {
                success: false,
                matches: [],
                remainingOrder: null,
                error: "Order with this salt already exists",
                errorCode: "DUPLICATE_ORDER",
              };
              return result;
            }

            // 4. 检查余额和风险
            let marketLongUsdc = 0n;
            let marketShortUsdc = 0n;
            if (
              (this.config.maxMarketLongExposureUsdc &&
                this.config.maxMarketLongExposureUsdc > 0) ||
              (this.config.maxMarketShortExposureUsdc && this.config.maxMarketShortExposureUsdc > 0)
            ) {
              const makerAddress = orderInput.maker.toLowerCase();
              const exposureBook = this.bookManager.getBook(
                orderInput.marketKey,
                orderInput.outcomeIndex
              );
              if (exposureBook) {
                const snapshot = exposureBook.getDepthSnapshot(1000);
                for (const level of snapshot.bids) {
                  for (const existing of level.orders) {
                    if (existing.maker !== makerAddress) continue;
                    marketLongUsdc += orderNotionalUsdc(existing.remainingAmount, existing.price);
                  }
                }
                for (const level of snapshot.asks) {
                  for (const existing of level.orders) {
                    if (existing.maker !== makerAddress) continue;
                    marketShortUsdc += orderNotionalUsdc(existing.remainingAmount, existing.price);
                  }
                }
              }
            }

            const riskCheck = await checkBalanceAndRisk(orderInput, this.config, {
              marketLongUsdc,
              marketShortUsdc,
            });
            if (!riskCheck.valid) {
              result = {
                success: false,
                matches: [],
                remainingOrder: null,
                error: riskCheck.error,
                errorCode: riskCheck.errorCode as OrderErrorCode,
              };
              return result;
            }

            order = this.createOrder(orderInput);
            await expireOrdersInBook(
              order.marketKey,
              order.outcomeIndex,
              this.bookManager,
              this.emitDepthUpdate.bind(this)
            );
            reservedAtStartUsdc = await reserveUsdcForOrder(order);
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

                // 检查订单是否过期
                const nowSeconds = Math.floor(Date.now() / 1000);
                if (counterOrder.expiry !== 0 && nowSeconds >= counterOrder.expiry) {
                  if (counterOrder.isBuy) {
                    await releaseUsdcReservation(
                      counterOrder.maker,
                      orderNotionalUsdc(counterOrder.remainingAmount, counterOrder.price)
                    );
                  }
                  book.removeOrder(counterOrder.id);
                  await updateOrderStatus(counterOrder, "expired");
                  this.emitDepthUpdate(book);
                  continue;
                }

                // 检查价格是否匹配
                const pricesMatch = order.isBuy
                  ? order.price >= counterOrder.price
                  : order.price <= counterOrder.price;

                if (pricesMatch) {
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
              await addToOrderBook(
                order,
                this.bookManager,
                this.emitEvent.bind(this),
                this.emitDepthUpdate.bind(this)
              );
              result = {
                success: true,
                matches: [],
                remainingOrder: order,
              };
              return result;
            }

            // 核心撮合逻辑
            const book = this.bookManager.getOrCreateBook(order.marketKey, order.outcomeIndex);
            const matchResult = await matchOrder(
              order,
              book,
              this.batchSettlers,
              this.config,
              this.emitEvent.bind(this),
              this.emitDepthUpdate.bind(this)
            );

            if (matchResult.remainingOrder && matchResult.remainingOrder.remainingAmount > 0n) {
              await addToOrderBook(
                matchResult.remainingOrder,
                this.bookManager,
                this.emitEvent.bind(this),
                this.emitDepthUpdate.bind(this)
              );
            }

            if (matchResult.matches.length > 0) {
              for (const match of matchResult.matches) {
                await this.saveTradeToDb(match);
                const trade = matchToTrade(match);
                this.emit("trade", trade);
                this.emitEvent({ type: "trade", trade });
              }
            }

            result = matchResult;
            return result;
          } finally {
            if (order && reservedAtStartUsdc > 0n) {
              await finalizeUsdcReservationAfterSubmit(order, reservedAtStartUsdc, result);
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
            releaseMicro = orderNotionalUsdc(removed.remainingAmount, removed.price);
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
                releaseMicro = orderNotionalUsdc(remaining, price);
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
            await releaseUsdcReservation(maker.toLowerCase(), releaseMicro);
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
      return await isValidErc1271Signature({
        maker: input.maker,
        digest,
        signature: input.signature,
        chainId: input.chainId,
      });
    } catch {
      return false;
    }
  }

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
          if (isExpired(order)) {
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
        market_address: match.makerOrder.verifyingContract.toLowerCase(),
        outcome_index: match.makerOrder.outcomeIndex,
        price: match.matchedPrice.toString(),
        amount: match.matchedAmount.toString(),
        taker_address: match.takerOrder.maker.toLowerCase(),
        maker_address: match.makerOrder.maker.toLowerCase(),
        is_buy: match.makerOrder.isBuy,
        tx_hash: `pending-${match.id}`,
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
              const micro = orderNotionalUsdc(remaining, price);
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
            const micro = orderNotionalUsdc(o.remainingAmount, o.price);
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
          releaseUsdcReservation(maker, micro)
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

      if (isExpired(order)) {
        if (order.isBuy) {
          const releaseMicro = orderNotionalUsdc(order.remainingAmount, order.price);
          await releaseUsdcReservation(order.maker, releaseMicro);
        }
        await updateOrderStatus(order, "expired");
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
