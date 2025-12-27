import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { ApiResponses } from "@/lib/apiResponse";
import { logApiError } from "@/lib/serverUtils";

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) return ApiResponses.internalError("Supabase not configured");
    const url = new URL(req.url);
    const idStr = url.searchParams.get("id") || "";
    const chainStr = url.searchParams.get("chainId") || "";
    const eventId = Number(idStr);
    const chainId = chainStr ? Number(chainStr) : undefined;
    if (!Number.isFinite(eventId)) {
      return ApiResponses.invalidParameters("invalid id");
    }
    let q = client.from("markets_map").select("*").eq("event_id", eventId);
    if (chainId && Number.isFinite(chainId)) q = q.eq("chain_id", chainId);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) {
      logApiError("GET /api/markets/map query failed", error);
      return ApiResponses.databaseError("Failed to fetch market map", error.message);
    }
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    logApiError("GET /api/markets/map unhandled error", e);
    const detail = e?.message || String(e);
    return ApiResponses.internalError("Failed to fetch market map", detail);
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) return ApiResponses.internalError("Supabase not configured");
    const body = (await req.json().catch(() => ({}))) as any;
    const payload = {
      event_id: Number(body.event_id),
      chain_id: Number(body.chain_id),
      market: String(body.market || ""),
      collateral_token: String(body.collateral_token || ""),
      tick_size: body.tick_size == null ? null : Number(body.tick_size),
      resolution_time: body.resolution_time || null,
      status: String(body.status || "open"),
    };
    if (
      !Number.isFinite(payload.event_id) ||
      !Number.isFinite(payload.chain_id) ||
      !payload.market
    ) {
      return ApiResponses.invalidParameters("invalid payload");
    }
    const { data, error } = await client
      .from("markets_map")
      .upsert(payload as any, { onConflict: "event_id,chain_id" })
      .select()
      .maybeSingle();
    if (error) {
      logApiError("POST /api/markets/map upsert failed", error);
      return ApiResponses.databaseError("Failed to upsert market map", error.message);
    }
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    logApiError("POST /api/markets/map unhandled error", e);
    const detail = e?.message || String(e);
    return ApiResponses.internalError("Failed to upsert market map", detail);
  }
}
