import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError, getSessionAddress } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";

type FlagTier = "light" | "standard" | "intense" | "hardcore";

function getFlagTotalDaysFromRange(startDay: Date, endDay: Date) {
  const msDay = 86400000;
  return Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / msDay) + 1);
}

function getFlagTierFromTotalDays(totalDays: number): FlagTier {
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
    const minDays = Math.max(1, Number(body?.min_days || 10));
    const threshold = Math.min(1, Math.max(0, Number(body?.threshold || 0.8)));

    const client = getClient() as any;
    if (!client) return NextResponse.json({ message: "Service not configured" }, { status: 500 });

    const settler_id = await getSessionAddress(req);
    if (!settler_id)
      return NextResponse.json(
        { message: "Unauthorized", detail: "Missing session address" },
        { status: 401 }
      );

    const { data: rawFlag, error: fErr } = await client
      .from("flags")
      .select("*")
      .eq("id", flagId)
      .maybeSingle();
    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;
    if (fErr)
      return NextResponse.json(
        { message: "Failed to query flag", detail: fErr.message },
        { status: 500 }
      );
    if (!flag) return NextResponse.json({ message: "Flag not found" }, { status: 404 });
    const owner = String(flag.user_id || "");
    if (settler_id.toLowerCase() !== owner.toLowerCase())
      return NextResponse.json({ message: "Only the owner can settle this flag" }, { status: 403 });

    const end = new Date(String(flag.deadline));
    if (Number.isNaN(end.getTime()))
      return NextResponse.json({ message: "Invalid flag deadline" }, { status: 500 });

    const now = new Date();
    if (now < end)
      return NextResponse.json(
        { message: "Flag deadline has not passed, cannot settle" },
        { status: 400 }
      );

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

    const msDay = 86400000;
    const totalDays = getFlagTotalDaysFromRange(startDay, endDay);

    let approvedDays = 0;
    const { data: approvals, error: aErr } = await client
      .from("flag_checkins")
      .select("created_at")
      .eq("flag_id", flagId)
      .eq("review_status", "approved")
      .gte("created_at", startDay.toISOString())
      .lte("created_at", new Date(endDay.getTime() + msDay - 1).toISOString());
    if (aErr)
      return NextResponse.json(
        { message: "Failed to query approved check-ins", detail: aErr.message },
        { status: 500 }
      );
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
    const status = ratio >= threshold && approvedDays >= minDays ? "success" : "failed";
    const metrics = {
      approvedDays,
      totalDays,
      ratio,
      threshold,
      minDays,
      startDay: startDay.toISOString(),
      endDay: endDay.toISOString(),
    };

    await client.from("flags").update({ status }).eq("id", flagId);

    const luckyAddresses = [
      "0x23d930b75a647a11a12b94d747488aa232375859",
      "0x377f4bb22f0ebd9238c1a30a8872fd00fb0b6f43",
    ];
    const isLuckyOwner = luckyAddresses.some((addr) => addr.toLowerCase() === owner.toLowerCase());

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
      await client.from("flag_settlements").insert({
        flag_id: flagId,
        status,
        strategy: "ratio_threshold",
        metrics,
        settled_by: settler_id,
        settled_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["flag_settlements"]["Insert"]);

      const tier = getFlagTierFromTotalDays(totalDays);
      const tierConfig = getTierConfig(tier);
      const rewardRoll = Math.random();
      const baseShouldReward = status === "success" && rewardRoll < tierConfig.settleDropRate;
      const shouldReward = baseShouldReward || isLuckyOwner;

      if (shouldReward) {
        const { data: emojis } = await client.from("emojis").select("*");
        if (emojis && emojis.length > 0) {
          const targetRarity = pickRarity("settle", tier);
          let pool = (emojis as any[]).filter((e) => (e.rarity || "common") === targetRarity);
          if (!pool.length) {
            pool = emojis as any[];
          }
          const randomDbEmoji = pool[Math.floor(Math.random() * pool.length)];
          const { error: rewardError } = await client.from("user_emojis").insert({
            user_id: owner,
            emoji_id: randomDbEmoji.id,
            source: "flag_settle",
          });
          if (!rewardError) {
            rewardedSticker = {
              id: String(randomDbEmoji.id),
              emoji: randomDbEmoji.image_url || randomDbEmoji.url || "❓",
              name: randomDbEmoji.name,
              rarity: randomDbEmoji.rarity || "common",
              desc: randomDbEmoji.description || "",
              color: getRarityClass(randomDbEmoji.rarity),
              image_url: randomDbEmoji.image_url || randomDbEmoji.url,
            };
          }
        }
      }
    } catch (e) {
      logApiError("POST /api/flags/[id]/settle settlement insert failed", e);
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
    return NextResponse.json(
      { message: "Failed to settle flag", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
