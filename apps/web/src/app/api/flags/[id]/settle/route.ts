import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError, getSessionAddress } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import { checkRateLimit, RateLimits, getIP } from "@/lib/rateLimit";
import {
  getFlagTotalDaysFromRange,
  getFlagTierFromTotalDays,
  getTierConfig,
  getTierSettleRule,
  isLuckyAddress,
  issueRandomSticker,
} from "@/lib/flagRewards";
import { ApiResponses } from "@/lib/apiResponse";

function isEvmAddress(value: string) {
  return /^0x[a-f0-9]{40}$/.test(String(value || ""));
}

function parseNumberWithBounds(value: unknown, fallback: number, min?: number, max?: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  let v = Number.isFinite(n) ? (n as number) : fallback;
  if (typeof min === "number") v = Math.max(min, v);
  if (typeof max === "number") v = Math.min(max, v);
  return v;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const flagId = normalizeId(id);
    if (flagId == null || flagId <= 0) return ApiResponses.invalidParameters("flagId is required");
    await parseRequestBody(req as any);

    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Service not configured");

    const settler_id = await getSessionAddress(req);
    if (!isEvmAddress(settler_id)) return ApiResponses.unauthorized("Unauthorized");

    const ip = getIP(req);
    const rl = await checkRateLimit(`flags:settle:${settler_id.toLowerCase()}:${flagId}:${ip}`, {
      interval: RateLimits.strict.interval,
      limit: RateLimits.strict.limit,
    });
    if (!rl.success) return ApiResponses.rateLimit("Too many requests, please try again later");

    const { data: rawFlag, error: fErr } = await client
      .from("flags")
      .select("*")
      .eq("id", flagId)
      .maybeSingle();
    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;
    if (fErr) return ApiResponses.databaseError("Failed to query flag", fErr.message);
    if (!flag) return ApiResponses.notFound("Flag not found");
    const owner = String(flag.user_id || "");
    if (settler_id.toLowerCase() !== owner.toLowerCase())
      return ApiResponses.forbidden("Only the owner can settle this flag");

    const { data: existingSettlementBefore } = await client
      .from("flag_settlements")
      .select("*")
      .eq("flag_id", flagId)
      .order("settled_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingSettlementBefore) {
      const status = existingSettlementBefore.status;
      if (flag.status !== "success" && flag.status !== "failed") {
        try {
          await client.from("flags").update({ status }).eq("id", flagId);
        } catch (e) {
          logApiError("POST /api/flags/[id]/settle sync flag status failed", e);
        }
      }
      return NextResponse.json(
        {
          status,
          metrics: existingSettlementBefore.metrics,
          sticker_earned: false,
          sticker_id: null,
          sticker: null,
        },
        { status: 200 }
      );
    }

    const end = new Date(String(flag.deadline));
    if (Number.isNaN(end.getTime())) return ApiResponses.internalError("Invalid flag deadline");

    const now = new Date();
    if (now < end) return ApiResponses.badRequest("Flag deadline has not passed, cannot settle");

    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (flag.status === "success" || flag.status === "failed") {
      const { data: existingSettlement } = await client
        .from("flag_settlements")
        .select("*")
        .eq("flag_id", flagId)
        .order("settled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingSettlement) {
        return NextResponse.json(
          {
            status: existingSettlement.status,
            metrics: existingSettlement.metrics,
            sticker_earned: false,
            sticker_id: null,
            sticker: null,
          },
          { status: 200 }
        );
      }
      return NextResponse.json(
        {
          status: flag.status,
          metrics: null,
          sticker_earned: false,
          sticker_id: null,
          sticker: null,
        },
        { status: 200 }
      );
    }

    let startDay: Date;
    if (flag.created_at) {
      const c = new Date(String(flag.created_at));
      startDay = new Date(c.getFullYear(), c.getMonth(), c.getDate());
    } else {
      // 回退：以最早打卡日作为起始
      const first = await client
        .from("flag_checkins")
        .select("created_at")
        .eq("flag_id", flagId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (!first.error && first.data && first.data[0]?.created_at) {
        const c = new Date(String(first.data[0].created_at));
        startDay = new Date(c.getFullYear(), c.getMonth(), c.getDate());
      } else {
        startDay = new Date(endDay.getTime());
      }
    }

    const totalDays = getFlagTotalDaysFromRange(startDay, endDay);

    let approvedDays = 0;
    const { data: approvals, error: aErr } = await client
      .from("flag_checkins")
      .select("created_at")
      .eq("flag_id", flagId)
      .eq("review_status", "approved")
      .gte("created_at", startDay.toISOString())
      .lte("created_at", new Date(endDay.getTime() + 86400000 - 1).toISOString());
    if (aErr) return ApiResponses.databaseError("Failed to query approved check-ins", aErr.message);
    if (approvals) {
      const set = new Set<string>();
      for (const r of approvals) {
        const d = new Date(String(r.created_at));
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        set.add(key);
      }
      approvedDays = set.size;
    }

    const ratio = approvedDays / totalDays;
    const tier = getFlagTierFromTotalDays(totalDays);
    const settleRule = getTierSettleRule(tier);
    const effectiveMinDays = Math.min(settleRule.minDays, totalDays);
    const status =
      ratio >= settleRule.threshold && approvedDays >= effectiveMinDays ? "success" : "failed";
    const metrics = {
      approvedDays,
      totalDays,
      ratio,
      threshold: settleRule.threshold,
      minDays: effectiveMinDays,
      startDay: startDay.toISOString(),
      endDay: endDay.toISOString(),
    };

    const isLuckyOwner = isLuckyAddress(owner);

    let rewardedSticker: {
      id: string;
      emoji: string;
      name: string;
      rarity: string;
      desc: string;
      color: string;
      image_url?: string;
    } | null = null;

    try {
      const { error: settleErr } = await client.from("flag_settlements").insert({
        flag_id: flagId,
        status,
        strategy: "ratio_threshold",
        metrics,
        settled_by: settler_id,
        settled_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["flag_settlements"]["Insert"]);
      if (settleErr) {
        return ApiResponses.databaseError("Failed to create settlement", settleErr.message);
      }

      const tierConfig = getTierConfig(tier);
      const rewardRoll = Math.random();
      const baseShouldReward = status === "success" && rewardRoll < tierConfig.settleDropRate;
      const shouldReward = baseShouldReward || isLuckyOwner;

      if (shouldReward) {
        rewardedSticker = await issueRandomSticker({
          client,
          userId: owner,
          source: "flag_settle",
          mode: "settle",
          tier,
          defaultDesc: "",
        });
      }
    } catch (e) {
      logApiError("POST /api/flags/[id]/settle settlement insert failed", e);
    }

    try {
      const { error: flagUpdateErr } = await client
        .from("flags")
        .update({ status })
        .eq("id", flagId);
      if (flagUpdateErr) {
        logApiError("POST /api/flags/[id]/settle update flag status failed", flagUpdateErr);
      }
    } catch (e) {
      logApiError("POST /api/flags/[id]/settle update flag status failed", e);
    }

    return NextResponse.json(
      {
        status,
        metrics,
        sticker_earned: !!rewardedSticker,
        sticker_id: rewardedSticker?.id,
        sticker: rewardedSticker,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return ApiResponses.internalError(
      "Failed to settle flag",
      process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
    );
  }
}
