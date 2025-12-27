import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { logApiError } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }
    const url = new URL(req.url);
    const idStr = url.searchParams.get("id") || "";
    const id = Number(idStr);
    if (!Number.isFinite(id)) {
      return ApiResponses.badRequest("invalid id");
    }
    const { data, error } = await client
      .from("orders")
      .select(
        "id, verifying_contract, chain_id, maker_address, maker_salt, outcome_index, is_buy, price, amount, remaining, expiry, signature, status, created_at"
      )
      .eq("id", id)
      .limit(1)
      .maybeSingle();
    if (error) {
      logApiError("GET /api/orderbook/order query failed", error);
      return ApiResponses.databaseError("Failed to fetch order", error.message);
    }
    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    logApiError("GET /api/orderbook/order unhandled error", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("Failed to fetch order", message);
  }
}
