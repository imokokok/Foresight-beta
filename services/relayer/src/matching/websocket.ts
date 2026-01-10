/**
 * WebSocket 实时推送服务
 * 支持订单簿深度、成交、订单状态等实时推送
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { MarketEvent, DepthSnapshot, Trade, OrderBookStats } from "./types.js";

interface ClientSubscription {
  channels: Set<string>;
  lastPing: number;
}

/**
 * WebSocket 服务器
 */
export class MarketWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private port: number = 3006) {}

  /**
   * 启动 WebSocket 服务器
   */
  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      console.log(`[WebSocket] Client connected from ${req.socket.remoteAddress}`);

      this.clients.set(ws, {
        channels: new Set(),
        lastPing: Date.now(),
      });

      ws.on("message", (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on("close", () => {
        console.log("[WebSocket] Client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("[WebSocket] Client error:", error);
        this.clients.delete(ws);
      });

      // 发送欢迎消息
      this.send(ws, {
        type: "connected",
        timestamp: Date.now(),
        message: "Connected to Foresight Market WebSocket",
      });
    });

    // 启动心跳检测
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 30000);

    console.log(`[WebSocket] Server started on port ${this.port}`);
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      const subscription = this.clients.get(ws);
      if (!subscription) return;

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

    this.send(ws, {
      type: "subscribed",
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

    this.send(ws, {
      type: "unsubscribed",
      channels: Array.from(subscription.channels),
    });
  }

  /**
   * 验证频道名称
   */
  private isValidChannel(channel: string): boolean {
    // 频道格式: type:marketKey:outcomeIndex
    // 例如: depth:80002:123:0, trades:80002:123:0, stats:80002:123:0
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
        console.log("[WebSocket] Client timeout, closing connection");
        ws.terminate();
        this.clients.delete(ws);
      }
    }
  }

  /**
   * 发送消息到客户端
   */
  private send(ws: WebSocket, data: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * 广播到指定频道
   */
  broadcast(channel: string, data: object): void {
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
   * 广播深度更新
   */
  broadcastDepth(depth: DepthSnapshot): void {
    const channel = `depth:${depth.marketKey}:${depth.outcomeIndex}`;
    this.broadcast(channel, {
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
  broadcastTrade(trade: Trade): void {
    const channel = `trades:${trade.marketKey}:${trade.outcomeIndex}`;
    this.broadcast(channel, {
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
  broadcastStats(stats: OrderBookStats): void {
    const channel = `stats:${stats.marketKey}:${stats.outcomeIndex}`;
    this.broadcast(channel, {
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

  broadcastOrderEvent(event: MarketEvent): void {
    if (event.type === "order_placed" || event.type === "order_updated") {
      const channel = `orders:${event.order.marketKey}:${event.order.outcomeIndex}`;
      this.broadcast(channel, {
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
      this.broadcast(channel, {
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
  handleMarketEvent(event: MarketEvent): void {
    switch (event.type) {
      case "depth_update":
        this.broadcastDepth(event.depth);
        break;
      case "trade":
        this.broadcastTrade(event.trade);
        break;
      case "stats_update":
        this.broadcastStats(event.stats);
        break;
      case "order_placed":
      case "order_canceled":
      case "order_updated":
        this.broadcastOrderEvent(event);
        break;
    }
  }

  /**
   * 获取连接统计
   */
  getStats(): { connections: number; subscriptions: number } {
    let subscriptions = 0;
    for (const sub of this.clients.values()) {
      subscriptions += sub.channels.size;
    }
    return {
      connections: this.clients.size,
      subscriptions,
    };
  }

  /**
   * 停止服务器
   */
  stop(): void {
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

    console.log("[WebSocket] Server stopped");
  }
}
