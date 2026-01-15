import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { Database } from "@/lib/database.types";
import {
  parseRequestBody,
  logApiError,
  getSessionAddress,
  normalizeAddress,
} from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import { getFlagTierFromFlag, getTierConfig, issueRandomSticker } from "@/lib/flagRewards";
import { ApiResponses } from "@/lib/apiResponse";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const flagId = normalizeId(id);
    if (flagId == null || flagId <= 0) return ApiResponses.invalidParameters("flagId is required");

    const body = await parseRequestBody(req as any);
    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Service not configured");

    const userId = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(userId)) {
      return ApiResponses.unauthorized("Unauthorized");
    }

    const note = String(body?.note || "").trim();
    const imageUrl = String(body?.image_url || "").trim();

    const { data: rawFlag, error: findErr } = await client
      .from("flags")
      .select("*")
      .eq("id", flagId)
      .maybeSingle();

    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;

    if (findErr) return ApiResponses.databaseError("Failed to query flag", findErr.message);
    if (!flag) return ApiResponses.notFound("Flag not found");
    if (String(flag.user_id || "").toLowerCase() !== userId.toLowerCase())
      return ApiResponses.forbidden("Only the owner can check in");

    const now = new Date();
    const deadline = new Date(String(flag.deadline));
    if (Number.isNaN(deadline.getTime()))
      return ApiResponses.internalError("Invalid flag deadline");
    if (now > deadline) return ApiResponses.badRequest("Flag deadline has passed, cannot check in");

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = new Date(start.getTime() + 86400000);
    const startIso = start.toISOString();
    const nextIso = next.toISOString();
    let todayCount = 0;
    const cnt = await client
      .from("flag_checkins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startIso)
      .lt("created_at", nextIso);
    if (cnt.error)
      return ApiResponses.databaseError("Failed to query daily check-ins", cnt.error.message);
    todayCount = Number(cnt.count || 0);
    if (todayCount >= 30) return ApiResponses.rateLimit("Daily check-in limit reached (30)");

    const existingForFlag = await client
      .from("flag_checkins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("flag_id", flagId)
      .gte("created_at", startIso)
      .lt("created_at", nextIso);
    if (existingForFlag.error)
      return ApiResponses.databaseError(
        "Failed to query flag daily check-ins",
        existingForFlag.error.message
      );
    const alreadyCheckedInFlagToday = Number(existingForFlag.count || 0) > 0;
    if (alreadyCheckedInFlagToday) {
      return ApiResponses.badRequest("Already checked in today");
    }

    const historyPayload: Database["public"]["Tables"]["discussions"]["Insert"] = {
      proposal_id: flagId,
      user_id: userId,
      content: JSON.stringify({
        type: "checkin",
        note,
        image_url: imageUrl,
        ts: new Date().toISOString(),
      }),
    };
    try {
      await client.from("discussions").insert(historyPayload);
    } catch (e) {
      logApiError("POST /api/flags/[id]/checkin history insert failed", e);
    }

    const { data: insertedCheckin, error: insertErr } = await client
      .from("flag_checkins")
      .insert({
        flag_id: flagId,
        user_id: userId,
        note,
        image_url: imageUrl || null,
      } as Database["public"]["Tables"]["flag_checkins"]["Insert"])
      .select("*")
      .maybeSingle();
    if (insertErr || !insertedCheckin?.id) {
      logApiError("POST /api/flags/[id]/checkin insert failed", insertErr);
      return ApiResponses.databaseError("Check-in failed", insertErr?.message || "insert_failed");
    }

    const isSelfSupervised =
      flag.verification_type === "self" ||
      (!flag.witness_id && String(flag.user_id || "").toLowerCase() === userId.toLowerCase());

    const canAutoApprove =
      insertedCheckin?.id &&
      ((flag?.verification_type === "witness" && String(flag?.witness_id || "") === "official") ||
        isSelfSupervised);

    if (canAutoApprove) {
      const checkinId = insertedCheckin?.id;
      if (!checkinId) {
        throw new Error("Missing checkin id for auto-approve");
      }

      try {
        await client
          .from("flag_checkins")
          .update({
            review_status: "approved",
            reviewer_id: isSelfSupervised ? "self" : "official",
            reviewed_at: new Date().toISOString(),
          } as Database["public"]["Tables"]["flag_checkins"]["Update"])
          .eq("id", checkinId);
      } catch (e) {
        logApiError("POST /api/flags/[id]/checkin auto-approve update failed", e);
      }
    }

    const tier = getFlagTierFromFlag(flag);
    const tierConfig = getTierConfig(tier);
    let rewardedSticker = null;
    const rewardRoll = Math.random();
    const shouldRewardFromTier = rewardRoll < tierConfig.checkinDropRate;
    const shouldReward = insertedCheckin?.id && canAutoApprove && shouldRewardFromTier;
    if (shouldReward) {
      try {
        rewardedSticker = await issueRandomSticker({
          client,
          userId,
          source: "flag_checkin",
          mode: "checkin",
          tier,
          defaultDesc: "Keep going!",
        });
      } catch (e) {
        console.error("Reward error", e);
      }
    }

    let newStatus =
      flag.verification_type === "witness" && String(flag?.witness_id || "") !== "official"
        ? "pending_review"
        : "active";

    let { data, error } = await client
      .from("flags")
      .update({
        proof_comment: note || null,
        proof_image_url: imageUrl || null,
        status: newStatus,
      })
      .eq("id", flagId)
      .select("*")
      .maybeSingle();
    if (error) {
      const fallback = await client
        .from("flags")
        .update({
          status: newStatus,
        })
        .eq("id", flagId)
        .select("*")
        .maybeSingle();
      if (fallback.error)
        return ApiResponses.databaseError("Check-in failed", fallback.error.message);
      data = fallback.data;
    }
    return NextResponse.json(
      {
        message: "ok",
        data,
        sticker_earned: !!rewardedSticker,
        sticker_id: rewardedSticker?.id,
        sticker: rewardedSticker,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return ApiResponses.internalError(
      "Check-in failed",
      process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
    );
  }
}
