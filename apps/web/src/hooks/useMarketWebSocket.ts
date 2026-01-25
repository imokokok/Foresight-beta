"use client";

/**
 * 市场 WebSocket 客户端
 * 用于实时接收订单簿深度、成交等数据
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ============ 类型定义 ============

export interface DepthLevel {
  price: string;
  qty: string;
  count: number;
}

export interface DepthData {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export interface TradeData {
  id: string;
  price: string;
  amount: string;
  isBuyerMaker: boolean;
  maker: string;
  taker: string;
  timestamp: number;
}

export interface StatsData {
  bestBid: string | null;
  bestAsk: string | null;
  spread: string | null;
  bidDepth: string;
  askDepth: string;
  lastTradePrice: string | null;
  volume24h: string;
  high24h: string | null;
  low24h: string | null;
  avg24h: string | null;
  trades24h: string;
}

type WebSocketMessage = {
  channel: string;
  data: any;
  timestamp: number;
};

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

// ============ WebSocket 管理器 (单例) ============

class MarketWebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private subscriptions: Set<string> = new Set();
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;
  private status: ConnectionStatus = "disconnected";

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.ws?.readyState === WebSocket.CONNECTING) return;

    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[WebSocket] Connected");
        this.setStatus("connected");
        this.reconnectAttempts = 0;

        // 重新订阅之前的频道
        if (this.subscriptions.size > 0) {
          this.send({
            type: "subscribe",
            channels: Array.from(this.subscriptions),
          });
        }

        // 启动心跳
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (e) {
          console.error("[WebSocket] Failed to parse message:", e);
        }
      };

      this.ws.onclose = () => {
        console.log("[WebSocket] Disconnected");
        this.setStatus("disconnected");
        this.stopPing();
        this.attemptReconnect();
      };

      this.ws.onerror = (event) => {
        const errorEvent = event as ErrorEvent;
        const detail = errorEvent.message || errorEvent.error || event;
        console.warn("[WebSocket] Error event:", detail);
        this.setStatus("error");
      };
    } catch (e) {
      console.error("[WebSocket] Connection failed:", e);
      this.setStatus("error");
      this.attemptReconnect();
    }
  }

  private handleMessage(message: any): void {
    if (message.type === "pong") return;
    if (message.type === "subscribed") {
      console.log("[WebSocket] Subscribed to:", message.channels);
      return;
    }

    // 市场数据消息
    if (message.channel) {
      const listeners = this.listeners.get(message.channel);
      if (listeners) {
        listeners.forEach((callback) => callback(message.data));
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[WebSocket] Max reconnect attempts reached");
      this.setStatus("error");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: "ping" });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach((callback) => callback(status));
  }

  private send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(channels: string[]): void {
    channels.forEach((c) => this.subscriptions.add(c));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "subscribe", channels });
    }
  }

  unsubscribe(channels: string[]): void {
    channels.forEach((c) => this.subscriptions.delete(c));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: "unsubscribe", channels });
    }
  }

  addListener(channel: string, callback: (data: any) => void): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);
  }

  removeListener(channel: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(channel);
      }
    }
  }

  addStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.add(callback);
    // 立即通知当前状态
    callback(this.status);
  }

  removeStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.delete(callback);
  }

  disconnect(): void {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.listeners.clear();
    this.statusListeners.clear();
    this.status = "disconnected";
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }
}

// 全局 WebSocket 管理器实例
let wsManager: MarketWebSocketManager | null = null;

function getWebSocketManager(): MarketWebSocketManager {
  if (!wsManager) {
    // 优先使用环境变量，默认使用 localhost:3006
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3006";
    wsManager = new MarketWebSocketManager(wsUrl);
  }
  return wsManager;
}

/**
 * 获取 WebSocket URL (供外部使用)
 */
export function getWebSocketUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3006";
}

// ============ React Hooks ============

/**
 * WebSocket 连接状态 hook
 */
export function useWebSocketStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    const manager = getWebSocketManager();
    manager.addStatusListener(setStatus);
    manager.connect();

    return () => {
      manager.removeStatusListener(setStatus);
    };
  }, []);

  return status;
}

/**
 * 订单簿深度实时订阅 hook
 */
export function useOrderBookDepth(
  marketKey: string | undefined,
  outcomeIndex: number
): {
  depth: DepthData;
  status: ConnectionStatus;
} {
  const [depth, setDepth] = useState<DepthData>({ bids: [], asks: [] });
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    if (!marketKey) return;

    const manager = getWebSocketManager();
    const channel = `depth:${marketKey}:${outcomeIndex}`;

    const handleDepth = (data: any) => {
      if (data.type === "depth") {
        setDepth({
          bids: data.bids || [],
          asks: data.asks || [],
        });
      }
    };

    manager.addStatusListener(setStatus);
    manager.addListener(channel, handleDepth);
    manager.subscribe([channel]);
    manager.connect();

    return () => {
      manager.removeListener(channel, handleDepth);
      manager.unsubscribe([channel]);
      manager.removeStatusListener(setStatus);
    };
  }, [marketKey, outcomeIndex]);

  return { depth, status };
}

/**
 * 成交记录实时订阅 hook
 */
export function useTrades(
  marketKey: string | undefined,
  outcomeIndex: number
): {
  trades: TradeData[];
  status: ConnectionStatus;
} {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    if (!marketKey) return;

    const manager = getWebSocketManager();
    const channel = `trades:${marketKey}:${outcomeIndex}`;

    const handleTrade = (data: any) => {
      if (data.type === "trade") {
        setTrades((prev) => {
          // 添加新成交，保留最近 100 条
          const newTrades = [data, ...prev].slice(0, 100);
          return newTrades;
        });
      }
    };

    manager.addStatusListener(setStatus);
    manager.addListener(channel, handleTrade);
    manager.subscribe([channel]);
    manager.connect();

    return () => {
      manager.removeListener(channel, handleTrade);
      manager.unsubscribe([channel]);
      manager.removeStatusListener(setStatus);
    };
  }, [marketKey, outcomeIndex]);

  return { trades, status };
}

/**
 * 订单簿统计实时订阅 hook
 */
export function useOrderBookStats(
  marketKey: string | undefined,
  outcomeIndex: number
): {
  stats: StatsData | null;
  status: ConnectionStatus;
} {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    if (!marketKey) return;

    const manager = getWebSocketManager();
    const channel = `stats:${marketKey}:${outcomeIndex}`;

    const handleStats = (data: any) => {
      if (data.type === "stats") {
        const toNullableString = (value: unknown): string | null => {
          if (value == null) return null;
          if (typeof value === "string") return value;
          if (typeof value === "number" && Number.isFinite(value)) return String(value);
          return null;
        };

        const toStringOrDefault = (value: unknown, fallback: string): string => {
          const v = toNullableString(value);
          return v ?? fallback;
        };

        setStats({
          bestBid: toNullableString(data.bestBid),
          bestAsk: toNullableString(data.bestAsk),
          spread: toNullableString(data.spread),
          bidDepth: toStringOrDefault(data.bidDepth, "0"),
          askDepth: toStringOrDefault(data.askDepth, "0"),
          lastTradePrice: toNullableString(data.lastTradePrice),
          volume24h: toStringOrDefault(data.volume24h, "0"),
          high24h: toNullableString(data.high24h),
          low24h: toNullableString(data.low24h),
          avg24h: toNullableString(data.avg24h),
          trades24h: toStringOrDefault(data.trades24h, "0"),
        });
      }
    };

    manager.addStatusListener(setStatus);
    manager.addListener(channel, handleStats);
    manager.subscribe([channel]);
    manager.connect();

    return () => {
      manager.removeListener(channel, handleStats);
      manager.unsubscribe([channel]);
      manager.removeStatusListener(setStatus);
    };
  }, [marketKey, outcomeIndex]);

  return { stats, status };
}

/**
 * 组合 hook - 同时订阅深度、成交、统计
 */
export function useMarketData(
  marketKey: string | undefined,
  outcomeIndex: number
): {
  depth: DepthData;
  trades: TradeData[];
  stats: StatsData | null;
  status: ConnectionStatus;
  bestBid: string;
  bestAsk: string;
} {
  const { depth, status: depthStatus } = useOrderBookDepth(marketKey, outcomeIndex);
  const { trades } = useTrades(marketKey, outcomeIndex);
  const { stats } = useOrderBookStats(marketKey, outcomeIndex);

  // 从深度数据计算最佳买卖价
  const bestBid = depth.bids[0]?.price || "";
  const bestAsk = depth.asks[0]?.price || "";

  return {
    depth,
    trades,
    stats,
    status: depthStatus,
    bestBid,
    bestAsk,
  };
}
