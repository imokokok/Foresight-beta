import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses } from "@/lib/apiResponse";
import { logApiError, logApiEvent } from "@/lib/serverUtils";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";

// 这个路由使用了动态服务器功能（request.headers），不能静态渲染
// 移除 revalidate 配置，确保路由被正确标记为动态

function isMissingColumnError(error: any, column: string) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code === "42703") return true;
  return message.toLowerCase().includes(column.toLowerCase());
}

export async function GET(req: NextRequest) {
  try {
    const ip = getIP(req);
    const limitResult = await checkRateLimit(ip, RateLimits.lenient, "trades_ip");
    if (!limitResult.success) {
      try {
        await logApiEvent("trades_rate_limited", {
          ip: ip ? String(ip).split(".").slice(0, 2).join(".") + ".*.*" : "",
        });
      } catch {}
      return ApiResponses.rateLimit("Too many trades requests");
    }
    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const url = new URL(req.url);
    const chainIdRaw = url.searchParams.get("chainId");
    const contract = url.searchParams.get("contract") || undefined;
    const outcomeIndexRaw =
      url.searchParams.get("outcomeIndex") || url.searchParams.get("outcome_index");
    const limitRaw = url.searchParams.get("limit");
    const limitParsed = limitRaw == null ? 50 : Number(limitRaw);
    const limit = Number.isFinite(limitParsed) ? Math.max(1, Math.min(200, limitParsed)) : 50;

    let chainId: string | undefined;
    if (chainIdRaw != null) {
      const parsed = Number(chainIdRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return ApiResponses.badRequest("Invalid chainId");
      }
      chainId = String(parsed);
    }

    let outcomeIndex: number | undefined;
    if (outcomeIndexRaw != null) {
      const parsed = Number(outcomeIndexRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return ApiResponses.badRequest("Invalid outcomeIndex");
      }
      outcomeIndex = Math.floor(parsed);
    }

    let query = client
      .from("trades")
      .select("*")
      .order("block_timestamp", { ascending: false })
      .limit(limit);

    if (chainId) {
      query = query.eq("network_id", chainId);
    }
    if (contract) {
      query = query.eq("market_address", contract);
    }
    if (outcomeIndex != null) {
      query = query.eq("outcome_index", outcomeIndex);
    }

    let { data, error } = await query;
    if (error && outcomeIndex != null && isMissingColumnError(error, "outcome_index")) {
      let fallback = client
        .from("trades")
        .select("*")
        .order("block_timestamp", { ascending: false })
        .limit(limit);
      if (chainId) fallback = fallback.eq("network_id", chainId);
      if (contract) fallback = fallback.eq("market_address", contract);
      ({ data, error } = await fallback);
    }

    if (error) {
      logApiError("GET /api/orderbook/trades query failed", error);
      return ApiResponses.databaseError("Failed to fetch trades", error.message);
    }

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    logApiError("GET /api/orderbook/trades unhandled error", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "Failed to fetch trades",
      process.env.NODE_ENV === "development" ? message : undefined
    );
  }
}
