/**
 * WebSocket 实时推送服务
 * 支持订单簿深度、成交、订单状态等实时推送
 */

import { WebSocket } from "ws";
import type { MarketEvent, DepthSnapshot, Trade, OrderBookStats } from "./types.js";
import { BaseWebSocketServer } from "../common/baseWebSocketServer";

/**
 * WebSocket 服务器
 */
export class MarketWebSocketServer extends BaseWebSocketServer {
  constructor(port: number = 3006) {
    super(port);
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
      this.heartbeatInterval = undefined;
    }

    for (const ws of this.clients.keys()) {
      ws.terminate();
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
    }

    console.log("[WebSocket] Server stopped");
  }
}
