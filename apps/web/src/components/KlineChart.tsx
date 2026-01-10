"use client";

import { createChart, ColorType, UTCTimestamp, CandlestickSeries } from "lightweight-charts";
import React, { useEffect, useRef, useCallback } from "react";
import { useTrades, type TradeData } from "@/hooks/useMarketWebSocket";

interface KlineChartProps {
  market: string;
  chainId: number;
  outcomeIndex: number;
  resolution?: string;
  marketKey?: string; // 🚀 新增：用于 WebSocket 订阅
}

async function safeJson<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    console.warn("KlineChart: non-JSON response", {
      contentType,
      preview: text ? text.slice(0, 120) : "",
    });
    return { success: false, data: [] } as T;
  }
  try {
    return (await res.json()) as T;
  } catch {
    console.warn("KlineChart: failed to parse JSON response");
    return { success: false, data: [] } as T;
  }
}

// 获取 K 线周期的毫秒数
function getResolutionMs(resolution: string): number {
  const map: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
  };
  return map[resolution] || 15 * 60 * 1000;
}

export default function KlineChart({
  market,
  chainId,
  outcomeIndex,
  resolution = "15m",
  marketKey,
}: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const lastCandleRef = useRef<any>(null); // 🚀 保存最后一根 K 线

  // 🚀 使用 WebSocket 订阅实时成交
  const { trades: wsTrades, status: wsStatus } = useTrades(marketKey, outcomeIndex);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 销毁旧的 chart 实例（如果在 React StrictMode 下重复执行）
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "black",
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      grid: {
        vertLines: { color: "#f0f3fa" },
        horzLines: { color: "#f0f3fa" },
      },
    });

    try {
      // Use v4+ API with addSeries
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });
      seriesRef.current = candlestickSeries;
    } catch (e) {
      console.error("Failed to create candlestick series:", e);
    }

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // 🚀 实时更新最后一根 K 线
  const updateLastCandle = useCallback(
    (trade: TradeData) => {
      if (!seriesRef.current || !lastCandleRef.current) return;

      const resolutionMs = getResolutionMs(resolution);
      const tradeTime = trade.timestamp;
      const price = Number(trade.price);

      if (isNaN(price) || price <= 0) return;

      const candleTime = Math.floor(tradeTime / resolutionMs) * (resolutionMs / 1000);
      const lastCandle = lastCandleRef.current;

      if (candleTime === lastCandle.time) {
        // 更新当前 K 线
        const updatedCandle = {
          ...lastCandle,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price),
          close: price,
        };
        seriesRef.current.update(updatedCandle);
        lastCandleRef.current = updatedCandle;
      } else if (candleTime > lastCandle.time) {
        // 新的 K 线
        const newCandle = {
          time: candleTime as UTCTimestamp,
          open: price,
          high: price,
          low: price,
          close: price,
        };
        seriesRef.current.update(newCandle);
        lastCandleRef.current = newCandle;
      }
    },
    [resolution]
  );

  // 🚀 监听 WebSocket 成交，实时更新 K 线
  useEffect(() => {
    if (wsStatus !== "connected" || wsTrades.length === 0) return;

    // 只处理最新的成交
    const latestTrade = wsTrades[0];
    if (latestTrade) {
      updateLastCandle(latestTrade);
    }
  }, [wsTrades, wsStatus, updateLastCandle]);

  useEffect(() => {
    if (!seriesRef.current) return;

    const fetchCandles = async () => {
      try {
        // Use local API route instead of direct relayer call
        const url = `/api/orderbook/candles?market=${market}&chainId=${chainId}&outcome=${outcomeIndex}&resolution=${resolution}&limit=200`;
        const res = await fetch(url);
        const json = await safeJson(res);
        if (json.success === false) return;

        const data = (json.data || [])
          .map((c: any) => {
            const t = new Date(c.time).getTime() / 1000;
            return {
              time: t as UTCTimestamp,
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            };
          })
          .filter((d: any) => !Number.isNaN(d.time) && !Number.isNaN(d.open))
          .sort((a: any, b: any) => a.time - b.time);

        if (seriesRef.current && data.length > 0) {
          seriesRef.current.setData(data);
          // 🚀 保存最后一根 K 线用于实时更新
          lastCandleRef.current = data[data.length - 1];
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("KlineChart: failed to fetch candles:", message);
      }
    };

    fetchCandles();
    // 🚀 WebSocket 连接时降低轮询频率
    const interval = setInterval(fetchCandles, wsStatus === "connected" ? 30000 : 10000);

    return () => clearInterval(interval);
  }, [market, chainId, outcomeIndex, resolution, wsStatus]);

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="w-full h-[300px]" />
      {/* 🚀 实时连接状态指示器 */}
      {wsStatus === "connected" && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          实时
        </div>
      )}
    </div>
  );
}
