import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import {
  getSessionAddress,
  isAdminAddress,
  logApiError,
  normalizeAddress,
} from "@/lib/serverUtils";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin;
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
  } catch (e) {
    const error = e as Error;
    logApiError("GET /api/markets/map unhandled error", error);
    const detail = error?.message || String(error);
    return ApiResponses.internalError(
      "Failed to fetch market map",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized();
    const { data: prof, error: profErr } = await (client as any)
      .from("user_profiles")
      .select("is_admin")
      .eq("wallet_address", viewer)
      .maybeSingle();
    if (profErr) return ApiResponses.databaseError("Query failed", profErr.message);
    const viewerIsAdmin = !!prof?.is_admin || isAdminAddress(viewer);
    if (!viewerIsAdmin) return ApiResponses.forbidden("无权限");

    const ip = getIP(req);
    const rl = await checkRateLimit(
      `markets_map:upsert:${viewer.toLowerCase()}:${ip || "unknown"}`,
      RateLimits.strict,
      "markets_map_upsert"
    );
    if (!rl.success) return ApiResponses.rateLimit("操作过于频繁，请稍后再试");

    const body = (await req.json().catch(() => ({}))) as any;
    const feeBps =
      body.fee_bps === undefined || body.fee_bps === null ? undefined : Number(body.fee_bps);

    const isEvmAddress = (v: unknown) => /^0x[a-fA-F0-9]{40}$/.test(String(v || "").trim());

    const payload: any = {
      event_id: Number(body.event_id),
      chain_id: Number(body.chain_id),
      market: String(body.market || "")
        .trim()
        .toLowerCase(),
      collateral_token:
        body.collateral_token == null ? null : String(body.collateral_token).trim().toLowerCase(),
      tick_size: body.tick_size == null ? null : Number(body.tick_size),
      resolution_time: body.resolution_time || null,
      status: String(body.status || "open"),
    };
    if (typeof feeBps === "number" && Number.isFinite(feeBps) && feeBps >= 0) {
      payload.fee_bps = feeBps;
    }
    if (
      !Number.isFinite(payload.event_id) ||
      !Number.isFinite(payload.chain_id) ||
      !payload.market ||
      !isEvmAddress(payload.market) ||
      (payload.collateral_token !== null && !isEvmAddress(payload.collateral_token))
    ) {
      return ApiResponses.invalidParameters("invalid payload");
    }
    if (
      payload.tick_size !== null &&
      (!Number.isFinite(payload.tick_size) || payload.tick_size <= 0)
    ) {
      return ApiResponses.invalidParameters("invalid payload");
    }
    if (
      payload.status &&
      (typeof payload.status !== "string" ||
        payload.status.length > 32 ||
        !/^[a-z_]+$/.test(payload.status))
    ) {
      return ApiResponses.invalidParameters("invalid payload");
    }
    if (
      typeof payload.fee_bps === "number" &&
      Number.isFinite(payload.fee_bps) &&
      (payload.fee_bps < 0 || payload.fee_bps > 10000)
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
  } catch (e) {
    const error = e as Error;
    logApiError("POST /api/markets/map unhandled error", error);
    const detail = error?.message || String(error);
    return ApiResponses.internalError(
      "Failed to upsert market map",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
