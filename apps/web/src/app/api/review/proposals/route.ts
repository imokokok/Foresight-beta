import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
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
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending_review";
    const limitParam = Number(searchParams.get("limit") || 50);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(200, limitParam)) : 50;
    const { data, error } = await client
      .from("forum_threads")
      .select("*")
      .eq("event_id", 0)
      .eq("review_status", status)
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
