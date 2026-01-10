/**
 * 订单簿 Redis 快照服务
 * 提供订单簿的实时持久化和恢复能力
 */

import { getRedisClient, RedisClient } from "./client.js";
import { redisLogger as logger } from "../monitoring/logger.js";
import type { Order, DepthSnapshot, OrderBookStats } from "../matching/types.js";
import {
  orderbookSnapshotFlushLatency,
  orderbookSnapshotFlushTotal,
} from "../monitoring/metrics.js";

// Key 前缀
const ORDERBOOK_PREFIX = "orderbook:";
const ORDERBOOK_PUBLIC_PREFIX = "orderbook_public:";
const ORDER_PREFIX = "order:";
const STATS_PREFIX = "stats:";
const SNAPSHOT_TTL = 3600 * 24; // 24 小时过期
const PUBLIC_SNAPSHOT_TTL = 60; // 60 秒过期

export interface SerializedOrder {
  id: string;
  marketKey: string;
  maker: string;
  outcomeIndex: number;
  isBuy: boolean;
  price: string;
  amount: string;
  remainingAmount: string;
  salt: string;
  expiry: number;
  signature: string;
  chainId: number;
  verifyingContract: string;
  sequence: string;
  status: string;
  createdAt: number;
}

export interface OrderbookSnapshotData {
  marketKey: string;
  outcomeIndex: number;
  bidOrders: SerializedOrder[];
  askOrders: SerializedOrder[];
  lastTradePrice: string | null;
  volume24h: string;
  updatedAt: number;
}

export interface OrderbookPublicSnapshotData {
  marketKey: string;
  outcomeIndex: number;
  bids: { price: string; qty: string; count: number }[];
  asks: { price: string; qty: string; count: number }[];
  bestBid: string | null;
  bestAsk: string | null;
  spread: string | null;
  bidDepth: string;
  askDepth: string;
  lastTradePrice: string | null;
  volume24h: string;
  updatedAt: number;
}

type QueuedFullSnapshotData = {
  marketKey: string;
  outcomeIndex: number;
  bidOrders: Order[];
  askOrders: Order[];
  stats?: OrderBookStats;
  updatedAt: number;
};

type QueuedPublicSnapshotData = {
  marketKey: string;
  outcomeIndex: number;
  depth: DepthSnapshot;
  stats?: OrderBookStats;
  updatedAt: number;
};

class OrderbookSnapshotService {
  private redis: RedisClient;
  private syncInterval: NodeJS.Timeout | null = null;
  private pendingSnapshots: Map<string, QueuedFullSnapshotData> = new Map();
  private pendingPublicSnapshots: Map<string, QueuedPublicSnapshotData> = new Map();
  private syncInProgress = false;

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * 启动定期同步
   */
  startSync(intervalMs: number = 5000): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      void this.flushPendingSnapshots().catch((error: any) => {
        logger.error("Orderbook snapshot sync tick failed", {}, error);
      });
    }, intervalMs);

    logger.info("Orderbook snapshot sync started", { intervalMs });
  }

  /**
   * 停止同步
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 序列化订单
   */
  private serializeOrder(order: Order): SerializedOrder {
    return {
      id: order.id,
      marketKey: order.marketKey,
      maker: order.maker,
      outcomeIndex: order.outcomeIndex,
      isBuy: order.isBuy,
      price: order.price.toString(),
      amount: order.amount.toString(),
      remainingAmount: order.remainingAmount.toString(),
      salt: order.salt,
      expiry: order.expiry,
      signature: order.signature,
      chainId: order.chainId,
      verifyingContract: order.verifyingContract,
      sequence: order.sequence.toString(),
      status: order.status,
      createdAt: order.createdAt,
    };
  }

  /**
   * 反序列化订单
   */
  private deserializeOrder(data: SerializedOrder): Order {
    return {
      id: data.id,
      marketKey: data.marketKey,
      maker: data.maker,
      outcomeIndex: data.outcomeIndex,
      isBuy: data.isBuy,
      price: BigInt(data.price),
      amount: BigInt(data.amount),
      remainingAmount: BigInt(data.remainingAmount),
      salt: data.salt,
      expiry: data.expiry,
      signature: data.signature,
      chainId: data.chainId,
      verifyingContract: data.verifyingContract,
      sequence: BigInt(data.sequence),
      status: data.status as any,
      createdAt: data.createdAt,
    };
  }

  /**
   * 获取订单簿 key
   */
  private getOrderbookKey(marketKey: string, outcomeIndex: number): string {
    return `${ORDERBOOK_PREFIX}${marketKey}:${outcomeIndex}`;
  }

  private getOrderbookPublicKey(marketKey: string, outcomeIndex: number): string {
    return `${ORDERBOOK_PUBLIC_PREFIX}${marketKey}:${outcomeIndex}`;
  }

  private getStatsKey(marketKey: string, outcomeIndex: number): string {
    return `${STATS_PREFIX}${marketKey}:${outcomeIndex}`;
  }

  /**
   * 获取订单 key
   */
  private getOrderKey(orderId: string): string {
    return `${ORDER_PREFIX}${orderId}`;
  }

  /**
   * 保存单个订单
   */
  async saveOrder(order: Order): Promise<boolean> {
    const key = this.getOrderKey(order.id);
    const data = JSON.stringify(this.serializeOrder(order));
    const success = await this.redis.set(key, data, SNAPSHOT_TTL);

    if (success) {
      logger.debug("Order saved to Redis", { orderId: order.id, marketKey: order.marketKey });
    }

    return success;
  }

  /**
   * 删除订单
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    const key = this.getOrderKey(orderId);
    return this.redis.del(key);
  }

  /**
   * 获取订单
   */
  async getOrder(orderId: string): Promise<Order | null> {
    const key = this.getOrderKey(orderId);
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      const serialized = JSON.parse(data) as SerializedOrder;
      return this.deserializeOrder(serialized);
    } catch (error) {
      logger.error("Failed to parse order from Redis", { orderId });
      return null;
    }
  }

  /**
   * 保存订单簿快照 (延迟写入)
   */
  queueSnapshot(
    marketKey: string,
    outcomeIndex: number,
    bidOrders: Order[],
    askOrders: Order[],
    stats?: OrderBookStats
  ): void {
    const key = `${marketKey}:${outcomeIndex}`;

    const snapshot: QueuedFullSnapshotData = {
      marketKey,
      outcomeIndex,
      bidOrders,
      askOrders,
      stats,
      updatedAt: Date.now(),
    };

    this.pendingSnapshots.set(key, snapshot);
  }

  queuePublicSnapshot(
    marketKey: string,
    outcomeIndex: number,
    depth: DepthSnapshot,
    stats?: OrderBookStats
  ): void {
    const key = `${marketKey}:${outcomeIndex}`;
    const snapshot: QueuedPublicSnapshotData = {
      marketKey,
      outcomeIndex,
      depth,
      stats,
      updatedAt: Date.now(),
    };
    this.pendingPublicSnapshots.set(key, snapshot);
  }

  /**
   * 批量写入待处理的快照
   */
  private async flushPendingSnapshots(): Promise<void> {
    if (
      this.syncInProgress ||
      (this.pendingSnapshots.size === 0 && this.pendingPublicSnapshots.size === 0)
    ) {
      return;
    }

    this.syncInProgress = true;
    const snapshots = new Map(this.pendingSnapshots);
    const publicSnapshots = new Map(this.pendingPublicSnapshots);
    this.pendingSnapshots.clear();
    this.pendingPublicSnapshots.clear();

    try {
      if (snapshots.size > 0) {
        await this.saveSnapshotsToRedis(snapshots, "full");
      }
      if (publicSnapshots.size > 0) {
        await this.savePublicSnapshotsToRedis(publicSnapshots, "public");
      }

      logger.debug("Flushed orderbook snapshots", {
        fullCount: snapshots.size,
        publicCount: publicSnapshots.size,
      });
    } catch (error: any) {
      logger.error("Failed to flush orderbook snapshots", {}, error);
      // 失败的快照放回队列
      for (const [key, snapshot] of snapshots) {
        if (!this.pendingSnapshots.has(key)) {
          this.pendingSnapshots.set(key, snapshot);
        }
      }
      for (const [key, snapshot] of publicSnapshots) {
        if (!this.pendingPublicSnapshots.has(key)) {
          this.pendingPublicSnapshots.set(key, snapshot);
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 保存快照到 Redis
   */
  private buildFullSnapshot(snapshot: QueuedFullSnapshotData): OrderbookSnapshotData {
    return {
      marketKey: snapshot.marketKey,
      outcomeIndex: snapshot.outcomeIndex,
      bidOrders: snapshot.bidOrders.map((o) => this.serializeOrder(o)),
      askOrders: snapshot.askOrders.map((o) => this.serializeOrder(o)),
      lastTradePrice: snapshot.stats?.lastTradePrice?.toString() || null,
      volume24h: snapshot.stats?.volume24h?.toString() || "0",
      updatedAt: snapshot.updatedAt,
    };
  }

  private buildPublicSnapshot(snapshot: QueuedPublicSnapshotData): OrderbookPublicSnapshotData {
    const stats = snapshot.stats;
    return {
      marketKey: snapshot.marketKey,
      outcomeIndex: snapshot.outcomeIndex,
      bids: snapshot.depth.bids.map((l) => ({
        price: l.price.toString(),
        qty: l.totalQuantity.toString(),
        count: l.orderCount,
      })),
      asks: snapshot.depth.asks.map((l) => ({
        price: l.price.toString(),
        qty: l.totalQuantity.toString(),
        count: l.orderCount,
      })),
      bestBid: stats?.bestBid?.toString() || null,
      bestAsk: stats?.bestAsk?.toString() || null,
      spread: stats?.spread?.toString() || null,
      bidDepth: stats?.bidDepth?.toString() || "0",
      askDepth: stats?.askDepth?.toString() || "0",
      lastTradePrice: stats?.lastTradePrice?.toString() || null,
      volume24h: stats?.volume24h?.toString() || "0",
      updatedAt: snapshot.updatedAt,
    };
  }

  private async saveSnapshotToRedis(snapshot: OrderbookSnapshotData): Promise<boolean> {
    const key = this.getOrderbookKey(snapshot.marketKey, snapshot.outcomeIndex);
    const data = JSON.stringify(snapshot);
    return this.redis.set(key, data, SNAPSHOT_TTL);
  }

  private async savePublicSnapshotToRedis(snapshot: OrderbookPublicSnapshotData): Promise<boolean> {
    const key = this.getOrderbookPublicKey(snapshot.marketKey, snapshot.outcomeIndex);
    const data = JSON.stringify(snapshot);
    return this.redis.set(key, data, PUBLIC_SNAPSHOT_TTL);
  }

  private async saveSnapshotsToRedis(
    snapshots: Map<string, QueuedFullSnapshotData>,
    snapshotType: "full"
  ): Promise<void> {
    const startedAt = Date.now();
    const raw = this.redis.getRawClient();
    const ttlSeconds = SNAPSHOT_TTL;
    try {
      if (!raw) {
        for (const [, snapshot] of snapshots) {
          await this.saveSnapshotToRedis(this.buildFullSnapshot(snapshot));
        }
        orderbookSnapshotFlushTotal.inc({ snapshot_type: snapshotType, result: "success" });
        orderbookSnapshotFlushLatency.observe(
          { snapshot_type: snapshotType, result: "success" },
          Date.now() - startedAt
        );
        return;
      }

      const entries = Array.from(snapshots.values());
      const chunkSize = 50;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const multi = raw.multi();
        for (const s of chunk) {
          const key = this.redis.getPrefixedKey(this.getOrderbookKey(s.marketKey, s.outcomeIndex));
          multi.setEx(key, ttlSeconds, JSON.stringify(this.buildFullSnapshot(s)));
        }
        await multi.exec();
      }
      orderbookSnapshotFlushTotal.inc({ snapshot_type: snapshotType, result: "success" });
      orderbookSnapshotFlushLatency.observe(
        { snapshot_type: snapshotType, result: "success" },
        Date.now() - startedAt
      );
    } catch {
      orderbookSnapshotFlushTotal.inc({ snapshot_type: snapshotType, result: "error" });
      orderbookSnapshotFlushLatency.observe(
        { snapshot_type: snapshotType, result: "error" },
        Date.now() - startedAt
      );
      throw new Error("snapshot flush failed");
    }
  }

  private async savePublicSnapshotsToRedis(
    snapshots: Map<string, QueuedPublicSnapshotData>,
    snapshotType: "public"
  ): Promise<void> {
    const startedAt = Date.now();
    const raw = this.redis.getRawClient();
    const ttlSeconds = PUBLIC_SNAPSHOT_TTL;
    try {
      if (!raw) {
        for (const [, snapshot] of snapshots) {
          await this.savePublicSnapshotToRedis(this.buildPublicSnapshot(snapshot));
        }
        orderbookSnapshotFlushTotal.inc({ snapshot_type: snapshotType, result: "success" });
        orderbookSnapshotFlushLatency.observe(
          { snapshot_type: snapshotType, result: "success" },
          Date.now() - startedAt
        );
        return;
      }

      const entries = Array.from(snapshots.values());
      const chunkSize = 200;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const multi = raw.multi();
        for (const s of chunk) {
          const key = this.redis.getPrefixedKey(
            this.getOrderbookPublicKey(s.marketKey, s.outcomeIndex)
          );
          multi.setEx(key, ttlSeconds, JSON.stringify(this.buildPublicSnapshot(s)));
        }
        await multi.exec();
      }
      orderbookSnapshotFlushTotal.inc({ snapshot_type: snapshotType, result: "success" });
      orderbookSnapshotFlushLatency.observe(
        { snapshot_type: snapshotType, result: "success" },
        Date.now() - startedAt
      );
    } catch {
      orderbookSnapshotFlushTotal.inc({ snapshot_type: snapshotType, result: "error" });
      orderbookSnapshotFlushLatency.observe(
        { snapshot_type: snapshotType, result: "error" },
        Date.now() - startedAt
      );
      throw new Error("public snapshot flush failed");
    }
  }

  /**
   * 立即保存订单簿快照
   */
  async saveSnapshot(
    marketKey: string,
    outcomeIndex: number,
    bidOrders: Order[],
    askOrders: Order[],
    stats?: OrderBookStats
  ): Promise<boolean> {
    const snapshot: OrderbookSnapshotData = {
      marketKey,
      outcomeIndex,
      bidOrders: bidOrders.map((o) => this.serializeOrder(o)),
      askOrders: askOrders.map((o) => this.serializeOrder(o)),
      lastTradePrice: stats?.lastTradePrice?.toString() || null,
      volume24h: stats?.volume24h?.toString() || "0",
      updatedAt: Date.now(),
    };

    const success = await this.saveSnapshotToRedis(snapshot);

    if (success) {
      logger.debug("Orderbook snapshot saved", {
        marketKey,
        outcomeIndex,
        bidCount: bidOrders.length,
        askCount: askOrders.length,
      });
    }

    return success;
  }

  /**
   * 加载订单簿快照
   */
  async loadSnapshot(
    marketKey: string,
    outcomeIndex: number
  ): Promise<{
    orders: Order[];
    stats: Partial<OrderBookStats>;
  } | null> {
    const key = this.getOrderbookKey(marketKey, outcomeIndex);
    const data = await this.redis.get(key);

    if (!data) {
      logger.debug("No snapshot found in Redis", { marketKey, outcomeIndex });
      return null;
    }

    try {
      const snapshot = JSON.parse(data) as OrderbookSnapshotData;

      const orders: Order[] = [
        ...snapshot.bidOrders.map((o) => this.deserializeOrder(o)),
        ...snapshot.askOrders.map((o) => this.deserializeOrder(o)),
      ];

      const stats: Partial<OrderBookStats> = {
        marketKey: snapshot.marketKey,
        outcomeIndex: snapshot.outcomeIndex,
        lastTradePrice: snapshot.lastTradePrice ? BigInt(snapshot.lastTradePrice) : null,
        volume24h: BigInt(snapshot.volume24h),
      };

      logger.info("Orderbook snapshot loaded from Redis", {
        marketKey,
        outcomeIndex,
        orderCount: orders.length,
        snapshotAge: Date.now() - snapshot.updatedAt,
      });

      return { orders, stats };
    } catch (error: any) {
      logger.error("Failed to parse orderbook snapshot", { marketKey, outcomeIndex }, error);
      return null;
    }
  }

  async loadPublicSnapshot(
    marketKey: string,
    outcomeIndex: number
  ): Promise<OrderbookPublicSnapshotData | null> {
    const key = this.getOrderbookPublicKey(marketKey, outcomeIndex);
    const data = await this.redis.get(key);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data) as OrderbookPublicSnapshotData;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        parsed.marketKey !== marketKey ||
        parsed.outcomeIndex !== outcomeIndex ||
        !Array.isArray(parsed.bids) ||
        !Array.isArray(parsed.asks)
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  clearPendingSnapshots(marketKey: string, outcomeIndex: number): void {
    const key = `${marketKey}:${outcomeIndex}`;
    this.pendingSnapshots.delete(key);
    this.pendingPublicSnapshots.delete(key);
  }

  async deleteOrderbookState(
    marketKey: string,
    outcomeIndex: number
  ): Promise<{ full: boolean; public: boolean; stats: boolean }> {
    this.clearPendingSnapshots(marketKey, outcomeIndex);
    const fullKey = this.getOrderbookKey(marketKey, outcomeIndex);
    const publicKey = this.getOrderbookPublicKey(marketKey, outcomeIndex);
    const statsKey = this.getStatsKey(marketKey, outcomeIndex);
    const [full, pub, stats] = await Promise.all([
      this.redis.del(fullKey),
      this.redis.del(publicKey),
      this.redis.del(statsKey),
    ]);
    return { full, public: pub, stats };
  }

  async deleteMarketOrderbooks(
    marketKey: string,
    outcomeIndices: number[]
  ): Promise<{ deleted: number }> {
    const unique = Array.from(new Set(outcomeIndices)).filter((n) => Number.isInteger(n) && n >= 0);
    let deleted = 0;
    for (const outcomeIndex of unique) {
      const result = await this.deleteOrderbookState(marketKey, outcomeIndex);
      if (result.full || result.public || result.stats) deleted++;
    }
    return { deleted };
  }

  /**
   * 列出所有订单簿 key
   */
  async listOrderbooks(): Promise<string[]> {
    // 注意: 这个方法需要 SCAN 命令，可能较慢
    // 在生产环境中应该维护一个单独的索引
    logger.warn("listOrderbooks is not implemented - use database as source of truth");
    return [];
  }

  /**
   * 保存统计信息
   */
  async saveStats(
    marketKey: string,
    outcomeIndex: number,
    stats: OrderBookStats
  ): Promise<boolean> {
    const key = `${STATS_PREFIX}${marketKey}:${outcomeIndex}`;
    const data = JSON.stringify({
      ...stats,
      bestBid: stats.bestBid?.toString() || null,
      bestAsk: stats.bestAsk?.toString() || null,
      spread: stats.spread?.toString() || null,
      bidDepth: stats.bidDepth.toString(),
      askDepth: stats.askDepth.toString(),
      lastTradePrice: stats.lastTradePrice?.toString() || null,
      volume24h: stats.volume24h.toString(),
      updatedAt: Date.now(),
    });

    return this.redis.set(key, data, 300); // 5 分钟过期
  }

  /**
   * 获取统计信息
   */
  async getStats(marketKey: string, outcomeIndex: number): Promise<OrderBookStats | null> {
    const key = `${STATS_PREFIX}${marketKey}:${outcomeIndex}`;
    const data = await this.redis.get(key);

    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      return {
        marketKey: parsed.marketKey,
        outcomeIndex: parsed.outcomeIndex,
        bestBid: parsed.bestBid ? BigInt(parsed.bestBid) : null,
        bestAsk: parsed.bestAsk ? BigInt(parsed.bestAsk) : null,
        spread: parsed.spread ? BigInt(parsed.spread) : null,
        bidDepth: BigInt(parsed.bidDepth),
        askDepth: BigInt(parsed.askDepth),
        lastTradePrice: parsed.lastTradePrice ? BigInt(parsed.lastTradePrice) : null,
        volume24h: BigInt(parsed.volume24h),
      };
    } catch (error) {
      logger.error("Failed to parse stats from Redis", { marketKey, outcomeIndex });
      return null;
    }
  }

  /**
   * 关闭时刷新所有待处理的快照
   */
  async shutdown(): Promise<void> {
    this.stopSync();

    if (this.pendingSnapshots.size > 0 || this.pendingPublicSnapshots.size > 0) {
      logger.info("Flushing pending snapshots before shutdown", {
        fullCount: this.pendingSnapshots.size,
        publicCount: this.pendingPublicSnapshots.size,
      });
      await this.flushPendingSnapshots();
    }
  }
}

// 单例实例
let snapshotService: OrderbookSnapshotService | null = null;

export function getOrderbookSnapshotService(): OrderbookSnapshotService {
  if (!snapshotService) {
    snapshotService = new OrderbookSnapshotService();
  }
  return snapshotService;
}

export { OrderbookSnapshotService };
