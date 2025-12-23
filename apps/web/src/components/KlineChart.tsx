"use client";

import { createChart, ColorType, UTCTimestamp, CandlestickSeries } from "lightweight-charts";
import React, { useEffect, useRef } from "react";

interface KlineChartProps {
  market: string;
  chainId: number;
  outcomeIndex: number;
  resolution?: string;
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

export default function KlineChart({
  market,
  chainId,
  outcomeIndex,
  resolution = "15m",
}: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

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

  useEffect(() => {
    if (!seriesRef.current) return;

    const fetchCandles = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_RELAYER_URL || "http://localhost:3005";
        const url = `${base}/orderbook/candles?market=${market}&chainId=${chainId}&outcome=${outcomeIndex}&resolution=${resolution}&limit=200`;
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

        if (seriesRef.current) {
          seriesRef.current.setData(data);
        }
      } catch (e) {
        console.error("Failed to fetch candles", e);
      }
    };

    fetchCandles();
    const interval = setInterval(fetchCandles, 10000); // Poll every 10s

    return () => clearInterval(interval);
  }, [market, chainId, outcomeIndex, resolution]);

  return <div ref={chartContainerRef} className="w-full h-[300px]" />;
}
