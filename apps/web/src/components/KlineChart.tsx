"use client";

import {
  createChart,
  ColorType,
  UTCTimestamp,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import React, { useEffect, useRef, useCallback, useState } from "react";
import { useTrades, type TradeData } from "@/hooks/useMarketWebSocket";
import { formatTime } from "@/lib/format";

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

function priceToProbabilityPercent(price: number): number {
  if (!Number.isFinite(price)) return 0;
  const pct = price * 100;
  if (!Number.isFinite(pct)) return 0;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
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
  const volumeSeriesRef = useRef<any>(null);
  const volumeByTimeRef = useRef<Map<number, number>>(new Map());
  const [hoverCandle, setHoverCandle] = useState<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  } | null>(null);

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
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });
      seriesRef.current = candlestickSeries;
      chart.priceScale("right").applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.25,
        },
      });
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "#a855f7",
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      volumeSeriesRef.current = volumeSeries;
      chart.priceScale("volume").applyOptions({
        scaleMargins: {
          top: 0.75,
          bottom: 0,
        },
      });
    } catch (e) {
      console.error("Failed to create candlestick series:", e);
    }

    chartRef.current = chart;

    const handleCrosshairMove = (param: any) => {
      if (!seriesRef.current) return;
      const seriesData = param.seriesData?.get(seriesRef.current);
      if (!seriesData || !seriesData.time) {
        setHoverCandle(null);
        return;
      }
      const t = Number(seriesData.time as UTCTimestamp);
      const volume = volumeByTimeRef.current.get(t);
      setHoverCandle({
        time: t,
        open: Number(seriesData.open),
        high: Number(seriesData.high),
        low: Number(seriesData.low),
        close: Number(seriesData.close),
        volume,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
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

      const intervalSec = getResolutionMs(resolution) / 1000;
      const tradeTimeSec = trade.timestamp;
      const price = Number(trade.price);
      const amount = Number(trade.amount);

      if (
        !Number.isFinite(tradeTimeSec) ||
        tradeTimeSec <= 0 ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return;
      }

      const candleTime = Math.floor(tradeTimeSec / intervalSec) * intervalSec;
      const lastCandle = lastCandleRef.current;

      if (candleTime === lastCandle.time) {
        const updatedCandle = {
          ...lastCandle,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price),
          close: price,
        };
        seriesRef.current.update(updatedCandle);
        lastCandleRef.current = updatedCandle;
        const prevVolume = volumeByTimeRef.current.get(candleTime) || 0;
        const volume = prevVolume + amount;
        volumeByTimeRef.current.set(candleTime, volume);
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update({
            time: candleTime as UTCTimestamp,
            value: volume,
            color: updatedCandle.close >= updatedCandle.open ? "#22c55e" : "#ef4444",
          });
        }
      } else if (candleTime > lastCandle.time) {
        const newCandle = {
          time: candleTime as UTCTimestamp,
          open: price,
          high: price,
          low: price,
          close: price,
        };
        seriesRef.current.update(newCandle);
        lastCandleRef.current = newCandle;
        volumeByTimeRef.current.set(candleTime, amount);
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update({
            time: candleTime as UTCTimestamp,
            value: amount,
            color: newCandle.close >= newCandle.open ? "#22c55e" : "#ef4444",
          });
        }
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

        const candles = (json.data || [])
          .map((c: any) => ({
            time: Number(c.time) as UTCTimestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume),
          }))
          .filter(
            (d: any) =>
              Number.isFinite(d.time) &&
              Number.isFinite(d.open) &&
              Number.isFinite(d.high) &&
              Number.isFinite(d.low) &&
              Number.isFinite(d.close) &&
              Number.isFinite(d.volume) &&
              d.volume >= 0
          )
          .sort((a: any, b: any) => a.time - b.time);

        if (seriesRef.current && candles.length > 0) {
          const ohlc = candles.map((c: any) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          const volumeData = candles.map((c: any) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? "#22c55e" : "#ef4444",
          }));
          seriesRef.current.setData(ohlc);
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.setData(volumeData);
          }
          const volumeMap = new Map<number, number>();
          for (const c of candles) {
            volumeMap.set(Number(c.time), c.volume);
          }
          volumeByTimeRef.current = volumeMap;
          lastCandleRef.current = ohlc[ohlc.length - 1];
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
      {hoverCandle && (
        <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[10px] text-gray-700 shadow">
          <div className="mb-0.5 text-gray-500">{formatTime(hoverCandle.time * 1000)}</div>
          <div className="flex gap-2">
            <span>O {hoverCandle.open.toFixed(4)}</span>
            <span>H {hoverCandle.high.toFixed(4)}</span>
            <span>L {hoverCandle.low.toFixed(4)}</span>
            <span>C {hoverCandle.close.toFixed(4)}</span>
          </div>
          <div className="mt-0.5">
            <span>Prob {priceToProbabilityPercent(hoverCandle.close).toFixed(1)}%</span>
          </div>
          {typeof hoverCandle.volume === "number" && (
            <div className="mt-0.5">
              <span>Vol {hoverCandle.volume.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
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
