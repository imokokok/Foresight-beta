import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { logApiError } from "@/lib/serverUtils";
import { getIP, checkRateLimit, RateLimits } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Cache for 10 seconds to avoid hitting DB too hard
export const revalidate = 10;

export async function GET(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip = getIP(req);
    const limitResult = await checkRateLimit(ip, RateLimits.lenient, "market_summary");
    if (!limitResult.success) {
      return ApiResponses.rateLimit("Too many requests");
    }

    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const { searchParams } = new URL(req.url);
    const marketAddress = searchParams.get("market");
    const chainIdStr = searchParams.get("chainId");

    if (!marketAddress || !chainIdStr) {
      return ApiResponses.badRequest("Missing market or chainId");
    }

    const chainId = Number(chainIdStr);
    if (!Number.isFinite(chainId)) {
      return ApiResponses.badRequest("Invalid chainId");
    }

    const marketAddrLower = marketAddress.toLowerCase();

    // 2. Fetch Market Info (Outcome Count)
    const { data: marketMap, error: mapError } = await client
      .from("markets_map")
      .select("outcome_count")
      .eq("chain_id", chainId)
      .eq("market", marketAddrLower)
      .single();

    // If map not found by strict string, maybe try lowercase?
    // But let's proceed. If error, we default to 2 outcomes (Binary) but return 404 if strictly required.
    // However, if we don't have outcome count, we can't iterate.
    // Let's default to 2 if not found, or maybe just fail.
    // Actually, if market map is missing, we might still have orders/trades.
    // But we need to know how many outcomes to scan.

    let outcomeCount = 2;
    if (marketMap && marketMap.outcome_count) {
      outcomeCount = marketMap.outcome_count;
    } else {
      // Fallback: Try to find max outcome_index from orders? Too slow.
      // Just default to 2.
    }

    // 3. Parallel Fetch for each outcome
    const tasks = [];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (let i = 0; i < outcomeCount; i++) {
      tasks.push(
        (async () => {
          // A. Last Price
          const lastTradeQuery = client
            .from("trades")
            .select("price")
            .eq("network_id", chainId)
            .eq("market_address", marketAddrLower)
            .eq("outcome_index", i)
            .order("block_timestamp", { ascending: false })
            .limit(1)
            .maybeSingle();

          // B. 24h Volume (Limit to 1000 to avoid heavy load)
          const volumeQuery = client
            .from("trades")
            .select("amount")
            .eq("network_id", chainId)
            .eq("market_address", marketAddrLower)
            .eq("outcome_index", i)
            .gt("block_timestamp", oneDayAgo)
            .limit(1000);

          // C. Best Bid
          const bestBidQuery = client
            .from("orders")
            .select("price")
            .eq("chain_id", chainId)
            .eq("verifying_contract", marketAddrLower)
            .eq("outcome_index", i)
            .eq("is_buy", true)
            .in("status", ["open", "partially_filled"]) // Include partially filled
            .gt("remaining", 0) // Ensure some remaining
            .order("price", { ascending: false })
            .limit(1)
            .maybeSingle();

          // D. Best Ask
          const bestAskQuery = client
            .from("orders")
            .select("price")
            .eq("chain_id", chainId)
            .eq("verifying_contract", marketAddrLower)
            .eq("outcome_index", i)
            .eq("is_buy", false)
            .in("status", ["open", "partially_filled"])
            .gt("remaining", 0)
            .order("price", { ascending: true })
            .limit(1)
            .maybeSingle();

          const [lastTrade, volume, bestBid, bestAsk] = await Promise.all([
            lastTradeQuery,
            volumeQuery,
            bestBidQuery,
            bestAskQuery,
          ]);

          let vol24h = 0n;
          if (volume.data) {
            for (const t of volume.data) {
              vol24h += BigInt(t.amount);
            }
          }

          return {
            outcomeIndex: i,
            lastPrice: lastTrade.data?.price || null,
            volume24h: vol24h.toString(),
            bestBid: bestBid.data?.price || null,
            bestAsk: bestAsk.data?.price || null,
          };
        })()
      );
    }

    const outcomes = await Promise.all(tasks);

    return successResponse({
      market: marketAddress,
      chainId,
      outcomeCount,
      outcomes,
    });
  } catch (e) {
    const error = e as Error;
    logApiError("GET /api/markets/summary", error);
    return ApiResponses.internalError("Failed to fetch market summary", error.message);
  }
}
