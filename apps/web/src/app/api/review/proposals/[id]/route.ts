import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { Database } from "@/lib/database.types";
import { getSessionAddress, logApiError, logApiEvent, normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";
import { getReviewerSession } from "@/lib/reviewAuth";
import { normalizeCategory } from "@/lib/categories";
import { createPrediction } from "../../../predictions/_lib/createPrediction";

type ForumThreadRow = Database["public"]["Tables"]["forum_threads"]["Row"];

function normalizeActionVerb(v: string): string {
  const s = String(v || "").trim();
  if (s === "priceReach" || s === "willHappen" || s === "willWin") return s;
  if (s === "价格达到") return "priceReach";
  if (s === "将会发生") return "willHappen";
  if (s === "将会赢得") return "willWin";
  return s;
}

function actionLabel(v: string): string {
  const s = normalizeActionVerb(v);
  if (s === "priceReach") return "价格是否会达到";
  if (s === "willHappen") return "是否将会发生";
  if (s === "willWin") return "是否将会赢得";
  return "是否将会发生";
}

function normalizeStringArray(value: unknown, max = 16): string[] {
  let arr: unknown[] = [];
  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        arr = parsed;
      } else {
        arr = value.split(",");
      }
    } catch {
      arr = value.split(",");
    }
  }
  return arr
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeOutcomeLabels(value: unknown, max = 8): string[] {
  const base = Array.isArray(value) ? value : normalizeStringArray(value, max);
  return base
    .map((x) => {
      if (x && typeof x === "object" && "label" in (x as any)) {
        return String((x as any).label || "").trim();
      }
      return String(x || "").trim();
    })
    .filter(Boolean)
    .slice(0, max);
}

function normalizeUrlList(value: unknown, max = 16): string[] {
  return normalizeStringArray(value, max).filter((v) => /^https?:\/\//i.test(v));
}

function pickFirstUrl(values: string[]): string {
  for (const v of values) {
    const s = String(v || "").trim();
    if (s && /^https?:\/\//i.test(s)) return s;
  }
  return "";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const rawAction = (body as Record<string, unknown>).action;
    const action = typeof rawAction === "string" ? rawAction.trim() : "";
    const rawReason = (body as Record<string, unknown>).reason;
    const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 500) : "";
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
        } as any)
        .eq("id", threadId)
        .eq("review_status", "needs_changes")
        .eq("reviewed_by", existingRow.reviewed_by || null)
        .eq("reviewed_at", existingRow.reviewed_at || null)
        .select("*")
        .maybeSingle();
      if (error) {
        logApiError("POST /api/review/proposals/[id] resubmit_update_failed", error);
        return ApiResponses.databaseError("update_failed", error.message);
      }
      if (!data) {
        return ApiResponses.conflict("review_in_progress");
      }
      logApiEvent("proposals.resubmitted", {
        thread_id: threadId,
        user_id: walletAddress,
      });
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
    const currentStatus = String(existingRow.review_status || "pending_review");
    const isPending = currentStatus === "pending_review";
    const canEditMetadata = currentStatus === "pending_review" || currentStatus === "needs_changes";
    const reviewedBy = normalizeAddress(String(existingRow.reviewed_by || ""));
    if (
      isPending &&
      existingRow.reviewed_at &&
      reviewedBy &&
      reviewedBy !== normalizeAddress(auth.userId) &&
      (action === "approve" ||
        action === "reject" ||
        action === "needs_changes" ||
        action === "edit_metadata")
    ) {
      return ApiResponses.conflict("review_in_progress");
    }
    if ((action === "approve" || action === "reject" || action === "needs_changes") && !isPending) {
      return ApiResponses.invalidParameters("invalid_status");
    }
    if (action === "edit_metadata" && !canEditMetadata) {
      return ApiResponses.invalidParameters("invalid_status");
    }

    if (action === "reject" || action === "needs_changes") {
      const reviewStatus = action === "reject" ? "rejected" : "needs_changes";
      const { data, error } = await client
        .from("forum_threads")
        .update({
          review_status: reviewStatus,
          reviewed_by: auth.userId,
          reviewed_at: now,
          review_reason: reason || existingRow.review_reason || null,
        } as any)
        .eq("id", threadId)
        .eq("review_status", "pending_review")
        .is("reviewed_at", null)
        .select("*")
        .maybeSingle();
      if (error) {
        logApiError("POST /api/review/proposals/[id] update_failed", error);
        return ApiResponses.databaseError("update_failed", error.message);
      }
      if (!data) {
        return ApiResponses.conflict("review_in_progress");
      }
      logApiEvent("proposals.reviewed", {
        thread_id: threadId,
        action,
        reviewer_id: auth.userId,
      });
      return NextResponse.json({ item: data }, { status: 200 });
    }

    if (action === "approve") {
      const { data: locked, error: lockErr } = await client
        .from("forum_threads")
        .update({
          reviewed_by: auth.userId,
          reviewed_at: now,
        } as any)
        .eq("id", threadId)
        .eq("review_status", "pending_review")
        .is("reviewed_at", null)
        .select("*")
        .maybeSingle();
      if (lockErr) {
        logApiError("POST /api/review/proposals/[id] lock_failed", lockErr);
        return ApiResponses.databaseError("update_failed", lockErr.message);
      }
      if (!locked) {
        return ApiResponses.conflict("review_in_progress");
      }
      const lockedRow = locked as any;
      let createdPredictionId = lockedRow.created_prediction_id || null;
      if (!createdPredictionId) {
        let title = String(lockedRow.title_preview || "").trim();
        if (!title) {
          const subj = lockedRow.subject_name || "";
          const verb = lockedRow.action_verb || "";
          const target = lockedRow.target_value || "";
          if (subj && verb && target) {
            title = `${subj}${actionLabel(verb)}${target}`;
          } else {
            title = lockedRow.title || "Untitled Prediction";
          }
        }
        title = String(title || "")
          .trim()
          .slice(0, 200);

        const seed = (title || "prediction").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const fallbackImageUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;

        const fallbackDeadline = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        let deadline = fallbackDeadline;
        if (lockedRow.deadline) {
          const d = new Date(String(lockedRow.deadline));
          if (Number.isFinite(d.getTime())) deadline = d.toISOString();
        }

        const outcomes = normalizeOutcomeLabels(lockedRow.outcomes, 8);
        const extraLinks = normalizeUrlList(lockedRow.extra_links, 16);
        const imageUrls = normalizeUrlList(lockedRow.image_urls, 16);
        const primarySource = String(
          lockedRow.primary_source_url || (lockedRow as any).primarySourceUrl || ""
        ).trim();
        const referenceUrl = pickFirstUrl([primarySource, ...extraLinks]);
        const imageUrl = pickFirstUrl(imageUrls) || fallbackImageUrl;
        const predictionType = outcomes.length >= 3 ? "multi" : "binary";
        const predictionOutcomes =
          predictionType === "multi" ? outcomes.map((label) => ({ label })) : [];

        try {
          const result = await createPrediction(client, {
            title: title || "Untitled",
            description: String(
              lockedRow.content || lockedRow.title_preview || title || "No description"
            )
              .trim()
              .slice(0, 4000),
            category: normalizeCategory(String(lockedRow.category || "更多")).slice(0, 32),
            deadline,
            minStake: 0.1,
            criteria: String(
              lockedRow.criteria_preview || "以客观可验证来源为准，截止前满足条件视为达成"
            )
              .trim()
              .slice(0, 4000),
            image_url: imageUrl,
            reference_url: referenceUrl || "",
            type: predictionType,
            outcomes: predictionOutcomes,
          });
          if (result.newPrediction?.id) {
            createdPredictionId = result.newPrediction.id;
          }
        } catch (err: any) {
          logApiError("Failed to create prediction on approve", err);
          await client
            .from("forum_threads")
            .update({
              reviewed_by: null,
              reviewed_at: null,
            } as any)
            .eq("id", threadId)
            .eq("reviewed_by", auth.userId)
            .eq("reviewed_at", now);
          return ApiResponses.internalError("failed_to_create_market", err.message);
        }
      }
      const finalPayload: Record<string, unknown> = {
        review_status: "approved",
        review_reason: reason || lockedRow.review_reason || null,
      };
      if (createdPredictionId) {
        finalPayload.created_prediction_id = createdPredictionId;
      }
      const { data, error } = await client
        .from("forum_threads")
        .update(finalPayload as any)
        .eq("id", threadId)
        .eq("review_status", "pending_review")
        .eq("reviewed_by", auth.userId)
        .eq("reviewed_at", now)
        .select("*")
        .maybeSingle();
      if (error) {
        logApiError("POST /api/review/proposals/[id] update_failed", error);
        return ApiResponses.databaseError("update_failed", error.message);
      }
      if (!data) {
        return ApiResponses.conflict("review_in_progress");
      }
      logApiEvent("proposals.reviewed", {
        thread_id: threadId,
        action,
        reviewer_id: auth.userId,
        prediction_id: createdPredictionId || data.created_prediction_id,
      });
      return NextResponse.json({ item: data }, { status: 200 });
    }

    if (action === "edit_metadata" && patch && typeof patch === "object") {
      const updatePayload: Record<string, unknown> = {};
      const allowedKeys = [
        "category",
        "deadline",
        "title_preview",
        "criteria_preview",
        "subject_name",
        "action_verb",
        "target_value",
        "primary_source_url",
        "outcomes",
        "extra_links",
        "image_urls",
      ];
      const safePatch = patch as Record<string, unknown>;
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(safePatch, key)) {
          const value = safePatch[key];
          if (value !== undefined) {
            if (key === "category") {
              updatePayload.category = normalizeCategory(String(value || "")).slice(0, 32);
              continue;
            }
            if (key === "deadline") {
              const raw = String(value || "").trim();
              if (!raw) {
                updatePayload.deadline = null;
                continue;
              }
              const d = new Date(raw);
              if (!Number.isFinite(d.getTime())) {
                return ApiResponses.invalidParameters("invalid_deadline");
              }
              updatePayload.deadline = d.toISOString();
              continue;
            }
            if (key === "title_preview") {
              updatePayload.title_preview = String(value || "")
                .trim()
                .slice(0, 4000);
              continue;
            }
            if (key === "criteria_preview") {
              updatePayload.criteria_preview = String(value || "")
                .trim()
                .slice(0, 4000);
              continue;
            }
            if (key === "subject_name") {
              updatePayload.subject_name = String(value || "")
                .trim()
                .slice(0, 120);
              continue;
            }
            if (key === "action_verb") {
              updatePayload.action_verb = normalizeActionVerb(String(value || ""))
                .trim()
                .slice(0, 40);
              continue;
            }
            if (key === "target_value") {
              updatePayload.target_value = String(value || "")
                .trim()
                .slice(0, 120);
              continue;
            }
            if (key === "primary_source_url") {
              const raw = String(value || "").trim();
              if (!raw) {
                updatePayload.primary_source_url = null;
                continue;
              }
              if (!/^https?:\/\//i.test(raw)) {
                return ApiResponses.invalidParameters("invalid_primary_source_url");
              }
              updatePayload.primary_source_url = raw.slice(0, 2048);
              continue;
            }
            if (key === "outcomes") {
              updatePayload.outcomes = normalizeOutcomeLabels(value, 8);
              continue;
            }
            if (key === "extra_links") {
              updatePayload.extra_links = normalizeUrlList(value, 16);
              continue;
            }
            if (key === "image_urls") {
              updatePayload.image_urls = normalizeUrlList(value, 16);
              continue;
            }
          }
        }
      }
      const { data, error } = await client
        .from("forum_threads")
        .update(updatePayload as any)
        .eq("id", threadId)
        .select("*")
        .maybeSingle();
      if (error) {
        logApiError("POST /api/review/proposals/[id] update_failed", error);
        return ApiResponses.databaseError("update_failed", error.message);
      }
      logApiEvent("proposals.metadata_edited", {
        thread_id: threadId,
        reviewer_id: auth.userId,
      });
      return NextResponse.json({ item: data }, { status: 200 });
    }
    if (action === "edit_metadata") {
      return ApiResponses.invalidParameters("invalid_patch");
    }
    return ApiResponses.invalidParameters("invalid_action");
  } catch (e: any) {
    logApiError("POST /api/review/proposals/[id] unhandled error", e);
    const detail = e?.message || String(e);
    return ApiResponses.internalError("update_failed", detail);
  }
}
