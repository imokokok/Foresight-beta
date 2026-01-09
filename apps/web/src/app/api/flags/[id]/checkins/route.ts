import { NextRequest, NextResponse } from "next/server";
import { supabase, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { logApiError, getSessionAddress, normalizeAddress } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import { ApiResponses } from "@/lib/apiResponse";

function isEvmAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const flagId = normalizeId(id);
    if (flagId == null || flagId <= 0) return ApiResponses.invalidParameters("flagId is required");
    const { searchParams } = new URL(req.url);
    const sessionViewer = await getSessionAddress(req);
    const viewerParam = searchParams.get("viewer") || searchParams.get("address") || "";
    const viewer =
      sessionViewer || (isEvmAddress(viewerParam) ? normalizeAddress(viewerParam) : "");
    if (!viewer) return ApiResponses.unauthorized("Unauthorized");

    const rawLimit = Number(searchParams.get("limit") || 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, rawLimit)) : 50;

    const rawOffset = Number(searchParams.get("offset") || 0);
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
    const client = supabase || getClient();
    if (!client) return ApiResponses.internalError("Service not configured");

    const f = await client
      .from("flags")
      .select("id,user_id,witness_id")
      .eq("id", flagId)
      .maybeSingle();
    if (f.error) return ApiResponses.databaseError("Failed to query flag", f.error.message);
    if (!f.data) return ApiResponses.notFound("Flag not found");
    const owner = String((f.data as Database["public"]["Tables"]["flags"]["Row"]).user_id || "");
    const wit = String((f.data as Database["public"]["Tables"]["flags"]["Row"]).witness_id || "");
    const allowed =
      viewer.toLowerCase() === owner.toLowerCase() ||
      (!!wit && viewer.toLowerCase() === wit.toLowerCase());
    if (!allowed) return ApiResponses.forbidden("Not authorized to view check-ins");

    // 首选专用历史表
    const res = await client
      .from("flag_checkins")
      .select("id,note,image_url,created_at,review_status,reviewer_id,review_reason,reviewed_at")
      .eq("flag_id", flagId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (res.error)
      return ApiResponses.databaseError("Failed to query check-ins", res.error.message);
    const items = (res.data || []).map(
      (r: Database["public"]["Tables"]["flag_checkins"]["Row"]) => ({
        id: String(r.id),
        note: String(r.note || ""),
        image_url: String(r.image_url || ""),
        created_at: String(r.created_at || ""),
        review_status: String(r.review_status || "pending"),
        reviewer_id: String(r.reviewer_id || ""),
        review_reason: String(r.review_reason || ""),
        reviewed_at: String(r.reviewed_at || ""),
      })
    );
    return NextResponse.json({ items, total: items.length }, { status: 200 });
  } catch (e: any) {
    return ApiResponses.internalError(
      "Request failed",
      process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
    );
  }
}
