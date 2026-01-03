import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError, getSessionAddress } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";

type FlagTier = "light" | "standard" | "intense" | "hardcore";

function getFlagTotalDays(flag: Database["public"]["Tables"]["flags"]["Row"]) {
  const deadline = new Date(String(flag.deadline));
  const endDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  let startDay: Date;
  if (flag.created_at) {
    const c = new Date(String(flag.created_at));
    startDay = new Date(c.getFullYear(), c.getMonth(), c.getDate());
  } else {
    startDay = new Date(endDay.getTime());
  }
  const msDay = 86400000;
  return Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / msDay) + 1);
}

function getFlagTier(flag: Database["public"]["Tables"]["flags"]["Row"]): FlagTier {
  const totalDays = getFlagTotalDays(flag);
  if (totalDays <= 7) return "light";
  if (totalDays <= 14) return "standard";
  if (totalDays <= 30) return "intense";
  return "hardcore";
}

function getTierConfig(tier: FlagTier) {
  if (tier === "light") {
    return {
      checkinDropRate: 0.02,
      settleDropRate: 0.4,
    };
  }
  if (tier === "standard") {
    return {
      checkinDropRate: 0.04,
      settleDropRate: 0.7,
    };
  }
  if (tier === "intense") {
    return {
      checkinDropRate: 0.06,
      settleDropRate: 1,
    };
  }
  return {
    checkinDropRate: 0.08,
    settleDropRate: 1,
  };
}

function pickRarity(
  source: "checkin" | "settle",
  tier: FlagTier
): "common" | "rare" | "epic" | "legendary" {
  const configs: Record<
    FlagTier,
    {
      checkin: { rarity: "common" | "rare" | "epic" | "legendary"; weight: number }[];
      settle: { rarity: "common" | "rare" | "epic" | "legendary"; weight: number }[];
    }
  > = {
    light: {
      checkin: [
        { rarity: "common", weight: 0.95 },
        { rarity: "rare", weight: 0.05 },
      ],
      settle: [
        { rarity: "common", weight: 0.9 },
        { rarity: "rare", weight: 0.1 },
      ],
    },
    standard: {
      checkin: [
        { rarity: "common", weight: 0.9 },
        { rarity: "rare", weight: 0.1 },
      ],
      settle: [
        { rarity: "common", weight: 0.8 },
        { rarity: "rare", weight: 0.18 },
        { rarity: "epic", weight: 0.02 },
      ],
    },
    intense: {
      checkin: [
        { rarity: "common", weight: 0.8 },
        { rarity: "rare", weight: 0.18 },
        { rarity: "epic", weight: 0.02 },
      ],
      settle: [
        { rarity: "common", weight: 0.7 },
        { rarity: "rare", weight: 0.25 },
        { rarity: "epic", weight: 0.04 },
        { rarity: "legendary", weight: 0.01 },
      ],
    },
    hardcore: {
      checkin: [
        { rarity: "common", weight: 0.7 },
        { rarity: "rare", weight: 0.25 },
        { rarity: "epic", weight: 0.04 },
        { rarity: "legendary", weight: 0.01 },
      ],
      settle: [
        { rarity: "common", weight: 0.6 },
        { rarity: "rare", weight: 0.3 },
        { rarity: "epic", weight: 0.08 },
        { rarity: "legendary", weight: 0.02 },
      ],
    },
  };
  const table = configs[tier][source];
  let r = Math.random();
  let acc = 0;
  for (const entry of table) {
    acc += entry.weight;
    if (r <= acc) return entry.rarity;
  }
  return table[table.length - 1].rarity;
}

function getRarityClass(r: string) {
  switch (r) {
    case "common":
      return "bg-green-100";
    case "rare":
      return "bg-blue-100";
    case "epic":
      return "bg-purple-100";
    case "legendary":
      return "bg-fuchsia-100";
    default:
      return "bg-gray-100";
  }
}

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

    const luckyAddresses = [
      "0x23d930b75a647a11a12b94d747488aa232375859",
      "0x377f4bb22f0ebd9238c1a30a8872fd00fb0b6f43",
    ];
    const isLuckyUser = luckyAddresses.some((addr) => addr.toLowerCase() === userId.toLowerCase());

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

    const tier = getFlagTier(flag);
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
        const { data: emojis } = await client.from("emojis").select("*");
        if (emojis && emojis.length > 0) {
          const targetRarity = pickRarity("checkin", tier);
          let pool = (emojis as any[]).filter((e) => (e.rarity || "common") === targetRarity);
          if (!pool.length) {
            pool = emojis as any[];
          }
          const randomDbEmoji = pool[Math.floor(Math.random() * pool.length)];
          const { error: rewardError } = await client.from("user_emojis").insert({
            user_id: userId,
            emoji_id: randomDbEmoji.id,
            source: "flag_checkin",
          });
          if (!rewardError) {
            rewardedSticker = {
              id: String(randomDbEmoji.id),
              emoji: randomDbEmoji.image_url || randomDbEmoji.url || "❓",
              name: randomDbEmoji.name,
              rarity: randomDbEmoji.rarity || "common",
              desc: randomDbEmoji.description || "Keep going!",
              color: getRarityClass(randomDbEmoji.rarity),
              image_url: randomDbEmoji.image_url || randomDbEmoji.url,
            };
          }
        }
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
