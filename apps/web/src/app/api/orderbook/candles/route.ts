import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { logApiError } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

const RESOLUTION_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

type Candle = {
  time: number; // timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const { searchParams } = new URL(req.url);
    const market = searchParams.get("market");
    const chainId = Number(searchParams.get("chainId"));
    const outcome = Number(searchParams.get("outcome"));
    const resolution = searchParams.get("resolution") || "15m";
    const limitParam = Number(searchParams.get("limit") || "");
    const tradeLimit =
      Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 5000 ? limitParam : 5000;

    if (!market || !Number.isFinite(chainId) || !Number.isFinite(outcome)) {
      return ApiResponses.badRequest("Missing required parameters");
    }

    // 1. 直接从 trades 表获取成交记录
    const { data: rawTrades, error } = await client
      .from("trades")
      .select("price, amount, block_timestamp")
      .eq("network_id", chainId)
      .eq("market_address", market.toLowerCase())
      .eq("outcome_index", outcome)
      .order("block_timestamp", { ascending: false }) // 获取最新的
      .limit(tradeLimit);

    if (error) {
      logApiError("GET /api/orderbook/candles query trades failed", error);
      return ApiResponses.databaseError("Failed to fetch trades", error.message);
    }

    if (!rawTrades || rawTrades.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Explicitly cast to any[] to avoid TypeScript errors if types are not generated correctly
    const trades = rawTrades as any[];

    // 2. 内存中聚合 K 线
    const intervalSec = RESOLUTION_SECONDS[resolution] || 900;
    const candlesMap = new Map<number, Candle>();

    // 按时间正序处理（从旧到新），以便正确计算 Open/Close
    const sortedTrades = [...trades].reverse();

    for (const trade of sortedTrades) {
      const ts = new Date(trade.block_timestamp).getTime() / 1000;
      const price = Number(trade.price);
      const amount = Number(trade.amount);

      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      // 计算时间桶 (向下取整)
      const bucketTime = Math.floor(ts / intervalSec) * intervalSec;

      if (!candlesMap.has(bucketTime)) {
        candlesMap.set(bucketTime, {
          time: bucketTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: amount,
        });
      } else {
        const c = candlesMap.get(bucketTime)!;
        c.high = Math.max(c.high, price);
        c.low = Math.min(c.low, price);
        c.close = price; // 因为是按时间正序遍历，最新的价格即为 close
        c.volume += amount;
      }
    }

    // 3. 格式化返回
    const candles = Array.from(candlesMap.values()).sort((a, b) => a.time - b.time);

    return NextResponse.json({ success: true, data: candles });
  } catch (e: unknown) {
    logApiError("GET /api/orderbook/candles unhandled error", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("Failed to fetch candles", message);
  }
}
