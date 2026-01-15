"use client";

import { useEffect, useState } from "react";
import { fetchTradesApi } from "../orderbookApi";
import { buildMarketKey } from "../constants";
import { useTrades as useTradesWS } from "@/hooks/useMarketWebSocket";
import type { MarketInfo } from "../marketTypes";

/**
 * 🚀 成交记录 hook - 优先使用 WebSocket，降级到轮询
 */
export function useTradesPolling(
  market: MarketInfo | null,
  predictionIdRaw?: string | number,
  outcomeIndex: number = 0
) {
  const [trades, setTrades] = useState<any[]>([]);

  // 构建 marketKey
  const marketKey =
    market && predictionIdRaw ? buildMarketKey(market.chain_id, predictionIdRaw) : undefined;

  // 🚀 使用 WebSocket 获取实时成交
  const { trades: wsTrades, status: wsStatus } = useTradesWS(marketKey, outcomeIndex);

  // 当 WebSocket 有新成交时，合并到列表
  useEffect(() => {
    if (wsStatus === "connected" && wsTrades.length > 0) {
      setTrades((prev) => {
        // 合并新成交，去重
        const existingIds = new Set(prev.map((t) => t.id || t.tx_hash));
        const newTrades = wsTrades.filter((t) => !existingIds.has(t.id));

        if (newTrades.length === 0) return prev;

        // 新成交放在前面，最多保留 100 条
        return [...newTrades, ...prev].slice(0, 100);
      });
    }
  }, [wsTrades, wsStatus]);

  // 📡 Fallback: 初始加载和 WebSocket 不可用时使用轮询
  useEffect(() => {
    if (!market) return;

    const fetchTrades = async () => {
      try {
        const items = await fetchTradesApi(market.market, market.chain_id, outcomeIndex);
        setTrades(items);
      } catch (e) {
        console.error("Fetch trades failed", e);
      }
    };

    // 首次加载
    fetchTrades();

    // WebSocket 连接时，降低轮询频率；断开时正常轮询
    const interval = wsStatus === "connected" ? 30000 : 5000;
    const timer = setInterval(fetchTrades, interval);

    return () => clearInterval(timer);
  }, [market, wsStatus, outcomeIndex]);

  return {
    trades,
    setTrades,
    // 🚀 新增：连接状态
    wsStatus,
    isRealtime: wsStatus === "connected",
  };
}
