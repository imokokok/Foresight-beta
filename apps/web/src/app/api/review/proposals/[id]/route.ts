import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { getSessionAddress, logApiError, normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";
import { getReviewerSession } from "@/lib/reviewAuth";

type ForumThreadRow = Database["public"]["Tables"]["forum_threads"]["Row"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const reason = String(body.reason || "");
    const patch = body.patch || {};
    if (!action) {
      return ApiResponses.invalidParameters("action_required");
    }
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }
    const { id } = await ctx.params;
    const threadId = Number(id);
    if (!Number.isFinite(threadId)) {
      return ApiResponses.invalidParameters("invalid_id");
    }
    if (
      action !== "resubmit" &&
      action !== "approve" &&
      action !== "reject" &&
      action !== "needs_changes" &&
      action !== "edit_metadata"
    ) {
      return ApiResponses.invalidParameters("invalid_action");
    }
    if (action === "resubmit") {
      const sessAddr = await getSessionAddress(req);
      const walletAddress = normalizeAddress(String(sessAddr || ""));
      if (!walletAddress) {
        return ApiResponses.unauthorized("unauthorized");
      }
      const { data: existing, error: fetchError } = await client
        .from("forum_threads")
        .select("*")
        .eq("id", threadId)
        .maybeSingle();
      if (fetchError) {
        logApiError("POST /api/review/proposals/[id] resubmit_query_failed", fetchError);
        return ApiResponses.databaseError("query_failed", fetchError.message);
      }
      if (!existing) {
        return ApiResponses.notFound("not_found");
      }
      const existingRow = existing as ForumThreadRow;
      const owner = normalizeAddress(String(existingRow.user_id || ""));
      if (!owner || owner !== walletAddress) {
        return ApiResponses.forbidden("forbidden");
      }
      const status = String(existingRow.review_status || "");
      if (status !== "needs_changes") {
        return ApiResponses.invalidParameters("invalid_status");
      }
      const { data, error } = await client
        .from("forum_threads")
        .update({
          review_status: "pending_review",
          reviewed_by: null,
          reviewed_at: null,
        } as Partial<ForumThreadRow> as never)
        .eq("id", threadId)
        .select("*")
        .maybeSingle();
      if (error) {
        logApiError("POST /api/review/proposals/[id] resubmit_update_failed", error);
        return ApiResponses.databaseError("update_failed", error.message);
      }
      return NextResponse.json({ item: data }, { status: 200 });
    }
    if ((action === "reject" || action === "needs_changes") && !reason.trim()) {
      return ApiResponses.invalidParameters("reason_required");
    }
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
    const { data: existing, error: fetchError } = await client
      .from("forum_threads")
      .select("*")
      .eq("id", threadId)
      .maybeSingle();
    if (fetchError) {
      logApiError("POST /api/review/proposals/[id] query_failed", fetchError);
      return ApiResponses.databaseError("query_failed", fetchError.message);
    }
    if (!existing) {
      return ApiResponses.notFound("not_found");
    }
    const now = new Date().toISOString();
    const existingRow = existing as ForumThreadRow;
    let reviewStatus = String(existingRow.review_status || "");
    if (action === "approve") reviewStatus = "approved";
    if (action === "reject") reviewStatus = "rejected";
    if (action === "needs_changes") reviewStatus = "needs_changes";
    const updatePayload: Partial<ForumThreadRow> = {
      review_status: reviewStatus,
      reviewed_by: auth.userId,
      reviewed_at: now,
      review_reason: reason || existingRow.review_reason || null,
    };
    if (action === "edit_metadata" && patch && typeof patch === "object") {
      const allowedKeys = [
        "category",
        "deadline",
        "title_preview",
        "criteria_preview",
        "subject_name",
        "action_verb",
        "target_value",
      ];
      for (const key of allowedKeys) {
        if (key in patch) {
          const value = patch[key];
          (updatePayload as Record<string, unknown>)[key] = value as unknown;
        }
      }
    }
    const { data, error } = await client
      .from("forum_threads")
      .update(updatePayload as never)
      .eq("id", threadId)
      .select("*")
      .maybeSingle();
    if (error) {
      logApiError("POST /api/review/proposals/[id] update_failed", error);
      return ApiResponses.databaseError("update_failed", error.message);
    }
    return NextResponse.json({ item: data }, { status: 200 });
  } catch (e: any) {
    logApiError("POST /api/review/proposals/[id] unhandled error", e);
    const detail = e?.message || String(e);
    return ApiResponses.internalError("update_failed", detail);
  }
}
