import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { ApiResponses } from "@/lib/apiResponse";
import { logApiError } from "@/lib/serverUtils";

export const revalidate = 5; // 5 seconds cache

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId");
    const contract = searchParams.get("contract");
    const marketKey = searchParams.get("marketKey"); // Optional, if we want to filter by marketKey directly
    const limit = parseInt(searchParams.get("limit") || "50");

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
    // Note: trades table currently uses network_id and market_address.
    // It does not seem to have 'market_key' column based on previous sql file reading.
    // But let's check if we can filter by market_address and network_id effectively.

    const { data, error } = await query;

    if (error) {
      logApiError("GET /api/orderbook/trades query failed", error);
      return ApiResponses.databaseError("Failed to fetch trades", error.message);
    }

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    logApiError("GET /api/orderbook/trades unhandled error", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("Failed to fetch trades", message);
  }
}
