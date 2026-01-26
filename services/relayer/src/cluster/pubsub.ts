/**
 * Redis Pub/Sub 模块
 * 用于 WebSocket 集群间消息广播
 */

import { createClient, RedisClientType } from "redis";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { logger } from "../monitoring/logger.js";
import { Counter, Gauge } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";

// ============================================================
// 指标定义
// ============================================================

const pubsubMessagesTotal = new Counter({
  name: "foresight_pubsub_messages_total",
  help: "Total Pub/Sub messages",
  labelNames: ["direction", "channel"] as const, // direction: publish/receive
  registers: [metricsRegistry],
});

const pubsubSubscriptions = new Gauge({
  name: "foresight_pubsub_subscriptions",
  help: "Number of active subscriptions",
  registers: [metricsRegistry],
});

const pubsubConnectionStatus = new Gauge({
  name: "foresight_pubsub_connection_status",
  help: "Pub/Sub connection status (1=connected, 0=disconnected)",
  labelNames: ["type"] as const, // type: publisher/subscriber
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

export interface PubSubConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  channelPrefix?: string;
}

export interface PubSubMessage<T = unknown> {
  type: string;
  payload: T;
  source: string; // 发送节点 ID
  timestamp: number;
}

// ============================================================
// 预定义频道
// ============================================================

export const CHANNELS = {
  // WebSocket 广播频道
  WS_DEPTH: "ws:depth",
  WS_TRADES: "ws:trades",
  WS_STATS: "ws:stats",
  WS_ORDERS: "ws:orders",

  // 集群协调频道
  CLUSTER_EVENTS: "cluster:events",
  LEADER_EVENTS: "cluster:leader",

  // 订单簿同步
  ORDERBOOK_SYNC: "orderbook:sync",
} as const;

// ============================================================
// Pub/Sub 客户端
// ============================================================

export class RedisPubSub extends EventEmitter {
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private config: PubSubConfig;
  private nodeId: string;
  private subscriptions: Set<string> = new Set();
  private isConnected: boolean = false;

  private static parseEnvInt(envValue: string | undefined, defaultValue: number): number {
    if (envValue === undefined) return defaultValue;
    const parsed = parseInt(envValue, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  constructor(config: Partial<PubSubConfig> = {}, nodeId?: string) {
    super();

    this.config = {
      host: config.host || process.env.REDIS_HOST || "localhost",
      port: config.port || RedisPubSub.parseEnvInt(process.env.REDIS_PORT, 6379),
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || RedisPubSub.parseEnvInt(process.env.REDIS_DB, 0),
      channelPrefix: config.channelPrefix || "foresight:",
      url: config.url || process.env.REDIS_URL,
    };

    this.nodeId = nodeId || this.generateNodeId();
  }

  private generateNodeId(): string {
    const hostname = process.env.HOSTNAME || process.env.POD_NAME || "local";
    const pid = process.pid;
    const random = randomUUID().slice(0, 8);
    return `${hostname}-${pid}-${random}`;
  }

  /**
   * 连接到 Redis
   */
  async connect(): Promise<boolean> {
    try {
      const url = this.config.url || `redis://${this.config.host}:${this.config.port}`;

      // 创建 Publisher
      this.publisher = createClient({
        url,
        password: this.config.password,
        database: this.config.db,
      });

      this.publisher.on("error", (err) => {
        logger.error("PubSub publisher error", {}, err);
        pubsubConnectionStatus.set({ type: "publisher" }, 0);
      });

      this.publisher.on("ready", () => {
        pubsubConnectionStatus.set({ type: "publisher" }, 1);
      });

      await this.publisher.connect();

      // 创建 Subscriber (需要独立连接)
      this.subscriber = this.publisher.duplicate();

      this.subscriber.on("error", (err) => {
        logger.error("PubSub subscriber error", {}, err);
        pubsubConnectionStatus.set({ type: "subscriber" }, 0);
      });

      this.subscriber.on("ready", () => {
        pubsubConnectionStatus.set({ type: "subscriber" }, 1);
      });

      await this.subscriber.connect();

      this.isConnected = true;
      logger.info("PubSub connected", { nodeId: this.nodeId });

      return true;
    } catch (error: any) {
      logger.error("PubSub connection failed", {}, error);
      this.isConnected = false;

      const subscriber = this.subscriber;
      const publisher = this.publisher;
      this.subscriber = null;
      this.publisher = null;

      await Promise.all([
        subscriber?.quit().catch(() => undefined),
        publisher?.quit().catch(() => undefined),
      ]);

      this.subscriptions.clear();
      pubsubSubscriptions.set(0);
      pubsubConnectionStatus.set({ type: "publisher" }, 0);
      pubsubConnectionStatus.set({ type: "subscriber" }, 0);
      return false;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;

    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }

    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }

    this.subscriptions.clear();
    pubsubSubscriptions.set(0);
    pubsubConnectionStatus.set({ type: "publisher" }, 0);
    pubsubConnectionStatus.set({ type: "subscriber" }, 0);

    logger.info("PubSub disconnected");
  }

  /**
   * 获取完整频道名
   */
  private getChannel(channel: string): string {
    return `${this.config.channelPrefix}${channel}`;
  }

  /**
   * 发布消息
   */
  async publish<T>(channel: string, type: string, payload: T): Promise<boolean> {
    if (!this.isConnected || !this.publisher) {
      logger.warn("PubSub not connected, cannot publish");
      return false;
    }

    try {
      const message: PubSubMessage<T> = {
        type,
        payload,
        source: this.nodeId,
        timestamp: Date.now(),
      };

      const fullChannel = this.getChannel(channel);
      await this.publisher.publish(fullChannel, JSON.stringify(message));

      pubsubMessagesTotal.inc({ direction: "publish", channel });

      logger.debug("Message published", { channel, type });
      return true;
    } catch (error: any) {
      logger.error("Publish failed", { channel, type }, error);
      return false;
    }
  }

  /**
   * 订阅频道
   */
  async subscribe(channel: string, handler: (message: PubSubMessage) => void): Promise<boolean> {
    if (!this.isConnected || !this.subscriber) {
      logger.warn("PubSub not connected, cannot subscribe");
      return false;
    }

    try {
      const fullChannel = this.getChannel(channel);

      await this.subscriber.subscribe(fullChannel, (data) => {
        try {
          const message = JSON.parse(data) as PubSubMessage;

          // 忽略自己发送的消息
          if (message.source === this.nodeId) {
            return;
          }

          pubsubMessagesTotal.inc({ direction: "receive", channel });

          handler(message);
          this.emit("message", channel, message);
        } catch (error: any) {
          logger.error("Failed to parse message", { channel }, error);
        }
      });

      this.subscriptions.add(channel);
      pubsubSubscriptions.set(this.subscriptions.size);

      logger.info("Subscribed to channel", { channel });
      return true;
    } catch (error: any) {
      logger.error("Subscribe failed", { channel }, error);
      return false;
    }
  }

  /**
   * 取消订阅
   */
  async unsubscribe(channel: string): Promise<boolean> {
    if (!this.subscriber) return false;

    try {
      const fullChannel = this.getChannel(channel);
      await this.subscriber.unsubscribe(fullChannel);

      this.subscriptions.delete(channel);
      pubsubSubscriptions.set(this.subscriptions.size);

      logger.info("Unsubscribed from channel", { channel });
      return true;
    } catch (error: any) {
      logger.error("Unsubscribe failed", { channel }, error);
      return false;
    }
  }

  /**
   * 发布深度更新
   */
  async publishDepthUpdate(
    marketKey: string,
    outcomeIndex: number,
    depth: unknown
  ): Promise<boolean> {
    return this.publish(CHANNELS.WS_DEPTH, "depth_update", {
      marketKey,
      outcomeIndex,
      depth,
    });
  }

  /**
   * 发布成交
   */
  async publishTrade(trade: unknown): Promise<boolean> {
    return this.publish(CHANNELS.WS_TRADES, "trade", trade);
  }

  /**
   * 发布统计更新
   */
  async publishStats(marketKey: string, outcomeIndex: number, stats: unknown): Promise<boolean> {
    return this.publish(CHANNELS.WS_STATS, "stats_update", {
      marketKey,
      outcomeIndex,
      stats,
    });
  }

  /**
   * 发布集群事件
   */
  async publishClusterEvent(eventType: string, data: unknown): Promise<boolean> {
    return this.publish(CHANNELS.CLUSTER_EVENTS, eventType, data);
  }

  /**
   * 订阅 WebSocket 广播频道
   */
  async subscribeToWebSocketChannels(handler: (message: PubSubMessage) => void): Promise<void> {
    await this.subscribe(CHANNELS.WS_DEPTH, handler);
    await this.subscribe(CHANNELS.WS_TRADES, handler);
    await this.subscribe(CHANNELS.WS_STATS, handler);
    await this.subscribe(CHANNELS.WS_ORDERS, handler);
  }

  /**
   * 订阅集群事件
   */
  async subscribeToClusterEvents(handler: (message: PubSubMessage) => void): Promise<void> {
    await this.subscribe(CHANNELS.CLUSTER_EVENTS, handler);
    await this.subscribe(CHANNELS.LEADER_EVENTS, handler);
  }

  /**
   * 获取节点 ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * 检查连接状态
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

// ============================================================
// 单例
// ============================================================

let pubsubInstance: RedisPubSub | null = null;

export function getPubSub(config?: Partial<PubSubConfig>, nodeId?: string): RedisPubSub {
  if (!pubsubInstance) {
    pubsubInstance = new RedisPubSub(config, nodeId);
  }
  return pubsubInstance;
}

export async function initPubSub(
  config?: Partial<PubSubConfig>,
  nodeId?: string
): Promise<RedisPubSub> {
  const pubsub = getPubSub(config, nodeId);
  await pubsub.connect();
  return pubsub;
}

export async function closePubSub(): Promise<void> {
  if (pubsubInstance) {
    await pubsubInstance.disconnect();
    pubsubInstance = null;
  }
}
