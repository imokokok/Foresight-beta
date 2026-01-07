import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError, getSessionAddress } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import {
  getFlagTierFromFlag,
  getTierConfig,
  isLuckyAddress,
  issueRandomSticker,
} from "@/lib/flagRewards";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const flagId = normalizeId(id);
    if (!flagId) return NextResponse.json({ message: "flagId is required" }, { status: 400 });

    const body = await parseRequestBody(req as any);
    const client = getClient() as any;
    if (!client) return NextResponse.json({ message: "Service not configured" }, { status: 500 });

    const userId = await getSessionAddress(req);
    if (!userId)
      return NextResponse.json(
        { message: "Unauthorized", detail: "Missing session address" },
        { status: 401 }
      );

    const isLuckyUser = isLuckyAddress(userId);

    const note = String(body?.note || "").trim();
    const imageUrl = String(body?.image_url || "").trim();

    const { data: rawFlag, error: findErr } = await client
      .from("flags")
      .select("*")
      .eq("id", flagId)
      .maybeSingle();

    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;

    if (findErr)
      return NextResponse.json(
        { message: "Failed to query flag", detail: findErr.message },
        { status: 500 }
      );
    if (!flag) return NextResponse.json({ message: "Flag not found" }, { status: 404 });
    if (String(flag.user_id || "").toLowerCase() !== userId.toLowerCase())
      return NextResponse.json({ message: "Only the owner can check in" }, { status: 403 });

    const now = new Date();
    const deadline = new Date(String(flag.deadline));
    if (Number.isNaN(deadline.getTime()))
      return NextResponse.json({ message: "Invalid flag deadline" }, { status: 500 });
    if (now > deadline)
      return NextResponse.json(
        { message: "Flag deadline has passed, cannot check in" },
        { status: 400 }
      );

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
      return NextResponse.json(
        { message: "Failed to query daily check-ins", detail: cnt.error.message },
        { status: 500 }
      );
    todayCount = Number(cnt.count || 0);
    if (todayCount >= 100)
      return NextResponse.json({ message: "Daily check-in limit reached (100)" }, { status: 429 });

    const existingForFlag = await client
      .from("flag_checkins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("flag_id", flagId)
      .gte("created_at", startIso)
      .lt("created_at", nextIso);
    if (existingForFlag.error)
      return NextResponse.json(
        { message: "Failed to query flag daily check-ins", detail: existingForFlag.error.message },
        { status: 500 }
      );
    const alreadyCheckedInFlagToday = Number(existingForFlag.count || 0) > 0;

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

    let insertedCheckin: Database["public"]["Tables"]["flag_checkins"]["Row"] | null = null;
    try {
      const ins = await client
        .from("flag_checkins")
        .insert({
          flag_id: flagId,
          user_id: userId,
          note,
          image_url: imageUrl || null,
        } as Database["public"]["Tables"]["flag_checkins"]["Insert"])
        .select("*")
        .maybeSingle();
      insertedCheckin = ins?.data || null;
    } catch (e) {
      logApiError("POST /api/flags/[id]/checkin insert failed", e);
    }

    const isSelfSupervised =
      flag.verification_type === "self" || (!flag.witness_id && flag.user_id === userId);

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
    const shouldReward =
      insertedCheckin?.id &&
      !alreadyCheckedInFlagToday &&
      ((canAutoApprove && shouldRewardFromTier) || isLuckyUser);
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
        return NextResponse.json(
          { message: "Check-in failed", detail: fallback.error.message },
          { status: 500 }
        );
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
    return NextResponse.json(
      { message: "Check-in failed", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
