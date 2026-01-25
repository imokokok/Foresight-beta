"use client";

import { useEffect, useState, useCallback } from "react";
import { buildMarketKey } from "../constants";
import { fetchOrderbookDepthApi } from "../orderbookApi";
import { useOrderBookDepth } from "@/hooks/useMarketWebSocket";
import type { MarketInfo } from "../marketTypes";

/**
 * 🚀 订单簿深度 hook - 优先使用 WebSocket，降级到轮询
 */
export function useOrderbookDepthPolling(args: {
  market: MarketInfo | null;
  tradeOutcome: number;
  predictionIdRaw: string | number | undefined;
}) {
  const { market, tradeOutcome, predictionIdRaw } = args;
  const [depthBuy, setDepthBuy] = useState<Array<{ price: string; qty: string }>>([]);
  const [depthSell, setDepthSell] = useState<Array<{ price: string; qty: string }>>([]);
  const [bestBid, setBestBid] = useState<string>("");
  const [bestAsk, setBestAsk] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // 构建 marketKey
  const marketKey =
    market && predictionIdRaw ? buildMarketKey(market.chain_id, predictionIdRaw) : undefined;

  // 🚀 使用 WebSocket 获取实时深度
  const { depth: wsDepth, status: wsStatus } = useOrderBookDepth(marketKey, tradeOutcome);

  // 当 WebSocket 数据更新时，同步到状态
  useEffect(() => {
    if (wsStatus === "connected" && (wsDepth.bids.length > 0 || wsDepth.asks.length > 0)) {
      // WebSocket 数据格式: { price, qty, count }
      setDepthBuy(wsDepth.bids.map((b) => ({ price: b.price, qty: b.qty })));
      setDepthSell(wsDepth.asks.map((a) => ({ price: a.price, qty: a.qty })));
      setBestBid(wsDepth.bids[0]?.price || "");
      setBestAsk(wsDepth.asks[0]?.price || "");
    }
  }, [wsDepth, wsStatus]);

  // 📡 Fallback: 当 WebSocket 不可用时使用轮询
  useEffect(() => {
    // 如果 WebSocket 已连接，不需要轮询
    if (wsStatus === "connected") return;
    if (!market || !predictionIdRaw) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchDepth = async () => {
      if (cancelled) return;
      try {
        setError(null);
        const key = buildMarketKey(market!.chain_id, predictionIdRaw);
        const { buys, sells } = await fetchOrderbookDepthApi(
          market!.market,
          market!.chain_id,
          key,
          tradeOutcome
        );
        if (cancelled) return;
        setDepthBuy(buys);
        setDepthSell(sells);
        setBestBid(buys.length > 0 ? buys[0].price : "");
        setBestAsk(sells.length > 0 ? sells[0].price : "");
      } catch (e) {
        if (cancelled) return;
        console.error("[useOrderbookDepthPolling] Failed to fetch depth:", e);
        setError(e instanceof Error ? e.message : "Failed to load orderbook depth");
      }
    };

    // 首次加载
    fetchDepth();

    // 轮询间隔：WebSocket 断开时 2 秒，否则 5 秒 (作为备份)
    const interval = wsStatus === "disconnected" ? 2000 : 5000;
    timer = setInterval(fetchDepth, interval);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [market, tradeOutcome, predictionIdRaw, wsStatus]);

  return {
    depthBuy,
    depthSell,
    bestBid,
    bestAsk,
    error,
    setDepthBuy,
    setDepthSell,
    setBestBid,
    setBestAsk,
    // 🚀 新增：连接状态
    wsStatus,
    isRealtime: wsStatus === "connected",
  };
}
