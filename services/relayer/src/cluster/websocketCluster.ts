/**
 * WebSocket 集群适配器
 * 通过 Redis Pub/Sub 实现多节点 WebSocket 广播
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { RedisPubSub, CHANNELS, PubSubMessage } from "./pubsub.js";
import { logger } from "../monitoring/logger.js";
import { Gauge, Counter, Histogram } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";
import type { DepthSnapshot, Trade, OrderBookStats, MarketEvent } from "../matching/types.js";

// ============================================================
// 指标定义
// ============================================================

const wsClusterConnectionsTotal = new Gauge({
  name: "foresight_ws_cluster_connections",
  help: "Total WebSocket connections in this node",
  labelNames: ["node_id"] as const,
  registers: [metricsRegistry],
});

const wsClusterSubscriptionsTotal = new Gauge({
  name: "foresight_ws_cluster_subscriptions",
  help: "Total WebSocket subscriptions in this node",
  labelNames: ["node_id"] as const,
  registers: [metricsRegistry],
});

const wsClusterMessagesTotal = new Counter({
  name: "foresight_ws_cluster_messages_total",
  help: "Total WebSocket messages",
  labelNames: ["direction", "type"] as const, // direction: inbound/outbound/broadcast
  registers: [metricsRegistry],
});

const wsClusterBroadcastLatency = new Histogram({
  name: "foresight_ws_cluster_broadcast_latency_ms",
  help: "WebSocket broadcast latency in milliseconds",
  labelNames: ["type"] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

interface ClientSubscription {
  channels: Set<string>;
  lastPing: number;
  clientId: string;
}

interface BroadcastMessage {
  type: string;
  channel: string;
  data: unknown;
  timestamp: number;
}

// ============================================================
// WebSocket 集群服务
// ============================================================

export class ClusteredWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private pubsub: RedisPubSub | null = null;
  private nodeId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_BACKOFF_MS = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    private port: number = 3006,
    nodeId?: string
  ) {
    this.nodeId = nodeId || this.generateNodeId();
  }

  private generateNodeId(): string {
    const hostname = process.env.HOSTNAME || process.env.POD_NAME || "local";
    const pid = process.pid;
    const random = randomUUID().slice(0, 8);
    return `ws-${hostname}-${pid}-${random}`;
  }

  private generateClientId(): string {
    return `client-${randomUUID()}`;
  }

  /**
   * 启动集群化 WebSocket 服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("ClusteredWebSocketServer already running");
      return;
    }

    // 连接 Pub/Sub
    this.pubsub = new RedisPubSub({}, this.nodeId);
    const connected = await this.pubsub.connect();

    if (!connected) {
      logger.warn("Pub/Sub not available, running in standalone mode");
    } else {
      // 订阅广播频道
      await this.subscribeToBroadcastChannels();
    }

    // 启动 WebSocket 服务器
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // 启动心跳检测
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 30000);

    this.isRunning = true;
    logger.info("ClusteredWebSocketServer started", {
      port: this.port,
      nodeId: this.nodeId,
      pubsubEnabled: connected,
    });
  }

  /**
   * 订阅 Pub/Sub 广播频道
   */
  private async subscribeToBroadcastChannels(): Promise<void> {
    if (!this.pubsub) return;

    const handler = (message: PubSubMessage) => {
      this.handlePubSubMessage(message as PubSubMessage<BroadcastMessage>);
    };

    await this.pubsub.subscribe(CHANNELS.WS_DEPTH, handler);
    await this.pubsub.subscribe(CHANNELS.WS_TRADES, handler);
    await this.pubsub.subscribe(CHANNELS.WS_STATS, handler);
    await this.pubsub.subscribe(CHANNELS.WS_ORDERS, handler);
  }

  /**
   * 处理 Pub/Sub 消息 (来自其他节点的广播)
   */
  private handlePubSubMessage(message: PubSubMessage<BroadcastMessage>): void {
    const { payload } = message;

    if (!payload || !payload.channel) {
      return;
    }

    wsClusterMessagesTotal.inc({ direction: "broadcast", type: payload.type });

    this.localBroadcast(payload.channel, payload.data);
  }

  private async attemptPubsubReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error("Max reconnection attempts reached for Pub/Sub, giving up");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.RECONNECT_BACKOFF_MS * Math.pow(2, this.reconnectAttempts - 1),
      60000
    );

    logger.info(
      `Attempting Pub/Sub reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        const newPubsub = new RedisPubSub({}, this.nodeId);
        const connected = await newPubsub.connect();

        if (connected) {
          this.pubsub = newPubsub;
          this.reconnectAttempts = 0;
          logger.info("Pub/Sub reconnected successfully");
          await this.subscribeToBroadcastChannels();
        } else {
          this.attemptPubsubReconnect();
        }
      } catch (error) {
        logger.error("Pub/Sub reconnection failed", undefined, error);
        this.attemptPubsubReconnect();
      }
    }, delay);
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = this.generateClientId();
    const clientIp = req.socket.remoteAddress || "unknown";

    logger.info("WebSocket client connected", { clientId, clientIp, nodeId: this.nodeId });

    this.clients.set(ws, {
      channels: new Set(),
      lastPing: Date.now(),
      clientId,
    });

    this.updateMetrics();

    ws.on("message", (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on("close", () => {
      logger.info("WebSocket client disconnected", { clientId });
      this.clients.delete(ws);
      this.updateMetrics();
    });

    ws.on("error", (error) => {
      logger.error("WebSocket client error", { clientId }, error);
      this.clients.delete(ws);
      this.updateMetrics();
    });

    // 发送欢迎消息
    this.send(ws, {
      type: "connected",
      timestamp: Date.now(),
      message: "Connected to Foresight Market WebSocket",
      nodeId: this.nodeId,
      clientId,
    });
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const subscription = this.clients.get(ws);
      if (!subscription) return;

      wsClusterMessagesTotal.inc({ direction: "inbound", type: message.type });

      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(ws, subscription, message.channels);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(ws, subscription, message.channels);
          break;

        case "ping":
          subscription.lastPing = Date.now();
          this.send(ws, { type: "pong", timestamp: Date.now() });
          break;

        default:
          this.send(ws, { type: "error", message: "Unknown message type" });
      }
    } catch (error) {
      this.send(ws, { type: "error", message: "Invalid message format" });
    }
  }

  /**
   * 处理订阅请求
   */
  private handleSubscribe(
    ws: WebSocket,
    subscription: ClientSubscription,
    channels: string[]
  ): void {
    if (!Array.isArray(channels)) {
      this.send(ws, { type: "error", message: "channels must be an array" });
      return;
    }

    for (const channel of channels) {
      if (this.isValidChannel(channel)) {
        subscription.channels.add(channel);
      }
    }

    this.updateMetrics();

    this.send(ws, {
      type: "subscribed",
      channels: Array.from(subscription.channels),
    });

    logger.debug("Client subscribed", {
      clientId: subscription.clientId,
      channels: Array.from(subscription.channels),
    });
  }

  /**
   * 处理取消订阅请求
   */
  private handleUnsubscribe(
    ws: WebSocket,
    subscription: ClientSubscription,
    channels: string[]
  ): void {
    if (!Array.isArray(channels)) {
      this.send(ws, { type: "error", message: "channels must be an array" });
      return;
    }

    for (const channel of channels) {
      subscription.channels.delete(channel);
    }

    this.updateMetrics();

    this.send(ws, {
      type: "unsubscribed",
      channels: Array.from(subscription.channels),
    });
  }

  /**
   * 验证频道名称
   */
  private isValidChannel(channel: string): boolean {
    const parts = channel.split(":");
    if (parts.length < 2) return false;

    const type = parts[0];
    return ["depth", "trades", "stats", "orders"].includes(type);
  }

  /**
   * 检查心跳,清理断开的连接
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 60000; // 60 秒超时

    for (const [ws, subscription] of this.clients.entries()) {
      if (now - subscription.lastPing > timeout) {
        logger.info("WebSocket client timeout", { clientId: subscription.clientId });
        ws.terminate();
        this.clients.delete(ws);
      }
    }

    this.updateMetrics();
  }

  /**
   * 发送消息到客户端
   */
  private send(ws: WebSocket, data: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      wsClusterMessagesTotal.inc({
        direction: "outbound",
        type: (data as { type?: string }).type || "unknown",
      });
    }
  }

  /**
   * 本地广播 (只发送到本节点的客户端)
   */
  private localBroadcast(channel: string, data: unknown): void {
    const message = JSON.stringify({
      channel,
      data,
      timestamp: Date.now(),
    });

    for (const [ws, subscription] of this.clients.entries()) {
      if (subscription.channels.has(channel) && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * 集群广播 (发送到所有节点)
   */
  async clusterBroadcast(channel: string, type: string, data: unknown): Promise<void> {
    const start = Date.now();

    // 先本地广播
    this.localBroadcast(channel, data);

    // 通过 Pub/Sub 广播到其他节点
    if (this.pubsub && this.pubsub.isReady()) {
      const pubsubChannel = this.getChannelType(channel);
      if (pubsubChannel) {
        await this.pubsub.publish(pubsubChannel, type, {
          type,
          channel,
          data,
          timestamp: Date.now(),
        });
      }
    }

    const latency = Date.now() - start;
    wsClusterBroadcastLatency.observe({ type }, latency);
  }

  /**
   * 获取频道类型对应的 Pub/Sub 频道
   */
  private getChannelType(channel: string): string | null {
    const type = channel.split(":")[0];
    switch (type) {
      case "depth":
        return CHANNELS.WS_DEPTH;
      case "trades":
        return CHANNELS.WS_TRADES;
      case "stats":
        return CHANNELS.WS_STATS;
      case "orders":
        return CHANNELS.WS_ORDERS;
      default:
        return null;
    }
  }

  /**
   * 广播深度更新
   */
  async broadcastDepth(depth: DepthSnapshot): Promise<void> {
    const channel = `depth:${depth.marketKey}:${depth.outcomeIndex}`;
    await this.clusterBroadcast(channel, "depth", {
      type: "depth",
      bids: depth.bids.map((l) => ({
        price: l.price.toString(),
        qty: l.totalQuantity.toString(),
        count: l.orderCount,
      })),
      asks: depth.asks.map((l) => ({
        price: l.price.toString(),
        qty: l.totalQuantity.toString(),
        count: l.orderCount,
      })),
    });
  }

  /**
   * 广播成交
   */
  async broadcastTrade(trade: Trade): Promise<void> {
    const channel = `trades:${trade.marketKey}:${trade.outcomeIndex}`;
    await this.clusterBroadcast(channel, "trade", {
      type: "trade",
      id: trade.id,
      price: trade.price.toString(),
      amount: trade.amount.toString(),
      isBuyerMaker: trade.isBuyerMaker,
      maker: trade.maker,
      taker: trade.taker,
      timestamp: trade.timestamp,
    });
  }

  /**
   * 广播统计更新
   */
  async broadcastStats(stats: OrderBookStats): Promise<void> {
    const channel = `stats:${stats.marketKey}:${stats.outcomeIndex}`;
    await this.clusterBroadcast(channel, "stats", {
      type: "stats",
      bestBid: stats.bestBid?.toString() || null,
      bestAsk: stats.bestAsk?.toString() || null,
      spread: stats.spread?.toString() || null,
      bidDepth: stats.bidDepth.toString(),
      askDepth: stats.askDepth.toString(),
      lastTradePrice: stats.lastTradePrice?.toString() || null,
      volume24h: stats.volume24h.toString(),
    });
  }

  private serializeOrder(order: any): any {
    return {
      id: String(order.id),
      marketKey: String(order.marketKey),
      maker: String(order.maker),
      outcomeIndex: Number(order.outcomeIndex),
      isBuy: Boolean(order.isBuy),
      price: order.price?.toString?.() ?? String(order.price),
      amount: order.amount?.toString?.() ?? String(order.amount),
      remainingAmount: order.remainingAmount?.toString?.() ?? String(order.remainingAmount),
      salt: String(order.salt),
      expiry: Number(order.expiry),
      signature: String(order.signature),
      chainId: Number(order.chainId),
      verifyingContract: String(order.verifyingContract),
      sequence: order.sequence?.toString?.() ?? String(order.sequence),
      status: String(order.status),
      createdAt: Number(order.createdAt),
      tif: order.tif,
      postOnly: order.postOnly,
    };
  }

  async broadcastOrderEvent(event: MarketEvent): Promise<void> {
    if (event.type === "order_placed" || event.type === "order_updated") {
      const channel = `orders:${event.order.marketKey}:${event.order.outcomeIndex}`;
      await this.clusterBroadcast(channel, "order", {
        type: "order",
        event: event.type,
        order: this.serializeOrder(event.order),
      });
      return;
    }
    if (event.type === "order_canceled") {
      const outcomeIndex = typeof event.outcomeIndex === "number" ? event.outcomeIndex : null;
      const channel =
        outcomeIndex === null
          ? `orders:${event.marketKey}`
          : `orders:${event.marketKey}:${outcomeIndex}`;
      await this.clusterBroadcast(channel, "order", {
        type: "order",
        event: event.type,
        orderId: event.orderId,
        marketKey: event.marketKey,
        outcomeIndex,
      });
    }
  }

  /**
   * 处理市场事件
   */
  async handleMarketEvent(event: MarketEvent): Promise<void> {
    switch (event.type) {
      case "depth_update":
        await this.broadcastDepth(event.depth);
        break;
      case "trade":
        await this.broadcastTrade(event.trade);
        break;
      case "stats_update":
        await this.broadcastStats(event.stats);
        break;
      case "order_placed":
      case "order_canceled":
      case "order_updated":
        await this.broadcastOrderEvent(event);
        break;
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(): void {
    wsClusterConnectionsTotal.set({ node_id: this.nodeId }, this.clients.size);

    let subscriptions = 0;
    for (const sub of this.clients.values()) {
      subscriptions += sub.channels.size;
    }
    wsClusterSubscriptionsTotal.set({ node_id: this.nodeId }, subscriptions);
  }

  /**
   * 获取连接统计
   */
  getStats(): { connections: number; subscriptions: number; nodeId: string } {
    let subscriptions = 0;
    for (const sub of this.clients.values()) {
      subscriptions += sub.channels.size;
    }
    return {
      connections: this.clients.size,
      subscriptions,
      nodeId: this.nodeId,
    };
  }

  /**
   * 获取节点 ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const ws of this.clients.keys()) {
      ws.terminate();
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pubsub) {
      await this.pubsub.disconnect();
      this.pubsub = null;
    }

    logger.info("ClusteredWebSocketServer stopped", { nodeId: this.nodeId });
  }
}

// ============================================================
// 导出
// ============================================================

let wsServerInstance: ClusteredWebSocketServer | null = null;

export function getClusteredWebSocketServer(
  port?: number,
  nodeId?: string
): ClusteredWebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new ClusteredWebSocketServer(port, nodeId);
  }
  return wsServerInstance;
}

export async function initClusteredWebSocketServer(
  port?: number,
  nodeId?: string
): Promise<ClusteredWebSocketServer> {
  const server = getClusteredWebSocketServer(port, nodeId);
  await server.start();
  return server;
}

export async function closeClusteredWebSocketServer(): Promise<void> {
  if (wsServerInstance) {
    await wsServerInstance.stop();
    wsServerInstance = null;
  }
}
