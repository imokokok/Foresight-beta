import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { logApiError } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";
import { getReviewerSession } from "@/lib/reviewAuth";

export async function GET(req: NextRequest) {
  try {
    const auth = await getReviewerSession(req);
    if (!auth.ok) {
      if (auth.reason === "unauthorized") {
        return ApiResponses.unauthorized("unauthorized");
      }
      if (auth.reason === "forbidden") {
        return ApiResponses.forbidden("forbidden");
      }
      return ApiResponses.internalError("no_client");
    }
    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }
    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get("status");
    const status = rawStatus && rawStatus.trim().length > 0 ? rawStatus : "pending_review";
    const rawLimit = searchParams.get("limit");
    const parsedLimit = rawLimit !== null ? Number(rawLimit) : 50;
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(200, parsedLimit)) : 50;
    const { data, error } = await client
      .from("forum_threads")
      .select(
        "id, event_id, title, content, category, upvotes, review_status, created_at, updated_at, wallet_address"
      )
      .eq("event_id", 0)
      .eq("review_status", status)
      .order("upvotes", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      logApiError("GET /api/review/proposals query_failed", error);
      return ApiResponses.databaseError("query_failed", error.message);
    }
    return NextResponse.json({ items: data || [] }, { status: 200 });
  } catch (e: any) {
    logApiError("GET /api/review/proposals unhandled error", e);
    const detail = e?.message || String(e);
    return ApiResponses.internalError("query_failed", detail);
  }
}
