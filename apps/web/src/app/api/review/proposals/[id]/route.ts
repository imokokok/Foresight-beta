import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { Database } from "@/lib/database.types";
import { getSessionAddress, logApiError, normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";
import { getReviewerSession } from "@/lib/reviewAuth";
import { createPrediction } from "../../../predictions/_lib/createPrediction";

type ForumThreadRow = Database["public"]["Tables"]["forum_threads"]["Row"];

function actionLabel(v: string): string {
  const s = String(v || "").trim();
  if (s === "priceReach") return "价格是否会达到";
  if (s === "willHappen") return "是否将会发生";
  if (s === "willWin") return "是否将会赢得";
  return "是否将会发生";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const rawAction = (body as Record<string, unknown>).action;
    const action = typeof rawAction === "string" ? rawAction.trim() : "";
    const rawReason = (body as Record<string, unknown>).reason;
    const reason = typeof rawReason === "string" ? rawReason : "";
    const patch = (body as Record<string, unknown>).patch;
    if (!action) {
      return ApiResponses.invalidParameters("action_required");
    }
    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }
    const { id } = await ctx.params;
    const threadId = Number(id);
    if (!Number.isFinite(threadId)) {
      return ApiResponses.invalidParameters("invalid_id");
    }
    const allowedActions = new Set([
      "resubmit",
      "approve",
      "reject",
      "needs_changes",
      "edit_metadata",
    ]);
    if (!allowedActions.has(action)) {
      return ApiResponses.invalidParameters("invalid_action");
    }
    if (action === "resubmit") {
      const sessAddr = await getSessionAddress(req);
      const walletAddress = normalizeAddress(String(sessAddr || ""));
      if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
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
    const existingRow = existing as any;
    let reviewStatus = String(existingRow.review_status || "");
    const updatePayload: any = {
      reviewed_by: auth.userId,
      reviewed_at: now,
      review_reason: reason || existingRow.review_reason || null,
    };

    if (action === "approve") {
      reviewStatus = "approved";
      if (!existingRow.created_prediction_id) {
        let title = existingRow.title_preview;
        if (!title) {
          const subj = existingRow.subject_name || "";
          const verb = existingRow.action_verb || "";
          const target = existingRow.target_value || "";
          if (subj && verb && target) {
            title = `${subj}${actionLabel(verb)}${target}`;
          } else {
            title = existingRow.title || "Untitled Prediction";
          }
        }

        const seed = (title || "prediction").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const imageUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;

        const deadline = existingRow.deadline
          ? new Date(existingRow.deadline).toISOString()
          : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

        try {
          const result = await createPrediction(client, {
            title: title || "Untitled",
            description: existingRow.title_preview || title || "No description",
            category: existingRow.category || "其他",
            deadline,
            minStake: 0.1,
            criteria:
              existingRow.criteria_preview || "以客观可验证来源为准，截止前满足条件视为达成",
            image_url: imageUrl,
          });
          if (result.newPrediction?.id) {
            updatePayload.created_prediction_id = result.newPrediction.id;
          }
        } catch (err: any) {
          logApiError("Failed to create prediction on approve", err);
          return ApiResponses.internalError("failed_to_create_market", err.message);
        }
      }
    }
    if (action === "reject") reviewStatus = "rejected";
    if (action === "needs_changes") reviewStatus = "needs_changes";

    updatePayload.review_status = reviewStatus;

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
      const safePatch = patch as Record<string, unknown>;
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(safePatch, key)) {
          const value = safePatch[key];
          if (value !== undefined) {
            (updatePayload as Record<string, unknown>)[key] = value as unknown;
          }
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
