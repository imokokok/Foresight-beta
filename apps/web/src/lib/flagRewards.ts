import { Database } from "@/lib/database.types";

export type FlagTier = "light" | "standard" | "intense" | "hardcore";

type TierConfig = {
  checkinDropRate: number;
  settleDropRate: number;
};

type TierSettleRule = {
  minDays: number;
  threshold: number;
};

type Rarity = "common" | "rare" | "epic" | "legendary";

type RarityWeight = {
  rarity: Rarity;
  weight: number;
};

export type StickerReward = {
  id: string;
  emoji: string;
  name: string;
  rarity: string;
  desc: string;
  color: string;
  image_url?: string;
};

type EmojiRow = {
  id: string;
  image_url?: string | null;
  url?: string | null;
  name: string;
  rarity?: string | null;
  description?: string | null;
};

const msDay = 86400000;

export function getFlagTotalDaysFromRow(flag: Database["public"]["Tables"]["flags"]["Row"]) {
  const deadline = new Date(String(flag.deadline));
  const endDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  let startDay: Date;
  if (flag.created_at) {
    const c = new Date(String(flag.created_at));
    startDay = new Date(c.getFullYear(), c.getMonth(), c.getDate());
  } else {
    startDay = new Date(endDay.getTime());
  }
  return Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / msDay) + 1);
}

export function getFlagTotalDaysFromRange(startDay: Date, endDay: Date) {
  return Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / msDay) + 1);
}

export function getFlagTierFromTotalDays(totalDays: number): FlagTier {
  if (totalDays <= 7) return "light";
  if (totalDays <= 14) return "standard";
  if (totalDays <= 30) return "intense";
  return "hardcore";
}

export function getFlagTierFromFlag(flag: Database["public"]["Tables"]["flags"]["Row"]): FlagTier {
  const totalDays = getFlagTotalDaysFromRow(flag);
  return getFlagTierFromTotalDays(totalDays);
}

const TIER_CONFIG_MAP: Record<FlagTier, TierConfig> = {
  light: {
    checkinDropRate: 0.03,
    settleDropRate: 0.6,
  },
  standard: {
    checkinDropRate: 0.05,
    settleDropRate: 0.75,
  },
  intense: {
    checkinDropRate: 0.07,
    settleDropRate: 0.9,
  },
  hardcore: {
    checkinDropRate: 0.09,
    settleDropRate: 0.9,
  },
};

export function getTierConfig(tier: FlagTier): TierConfig {
  return TIER_CONFIG_MAP[tier];
}

const TIER_SETTLE_RULES: Record<FlagTier, TierSettleRule> = {
  light: {
    minDays: 1,
    threshold: 0.7,
  },
  standard: {
    minDays: 5,
    threshold: 0.75,
  },
  intense: {
    minDays: 10,
    threshold: 0.8,
  },
  hardcore: {
    minDays: 10,
    threshold: 0.85,
  },
};

export function getTierSettleRule(tier: FlagTier): TierSettleRule {
  return TIER_SETTLE_RULES[tier];
}

const RARITY_CONFIG: Record<
  FlagTier,
  {
    checkin: RarityWeight[];
    settle: RarityWeight[];
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

export function pickRarity(source: "checkin" | "settle", tier: FlagTier): Rarity {
  const table = RARITY_CONFIG[tier][source];
  let r = Math.random();
  let acc = 0;
  for (const entry of table) {
    acc += entry.weight;
    if (r <= acc) return entry.rarity;
  }
  return table[table.length - 1].rarity;
}

export function getRarityClass(r: string) {
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

export function isLuckyAddress(address?: string | null) {
  return false;
}

export async function getPendingReviewCountForWitness(options: {
  client: any;
  witnessId: string;
}): Promise<number> {
  const { client, witnessId } = options;
  try {
    const { count, error } = await client
      .from("flags")
      .select("id", { count: "exact", head: true })
      .eq("witness_id", witnessId)
      .eq("status", "pending_review")
      .eq("verification_type", "witness");
    if (error) return 0;
    const n = Number(count || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function getTodayPendingCheckins(options: {
  client: any;
  userId: string;
}): Promise<{ count: number; sampleTitles: string[] }> {
  const { client, userId } = options;
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = new Date(start.getTime() + msDay);
    const startIso = start.toISOString();
    const nextIso = next.toISOString();

    const todayDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const { data } = await client
      .from("flags")
      .select(
        `
        id,
        title,
        deadline,
        flag_checkins!left (
          id,
          created_at
        )
      `
      )
      .eq("user_id", userId)
      .eq("status", "active");

    if (!Array.isArray(data) || data.length === 0) return { count: 0, sampleTitles: [] };

    let pending = 0;
    const sampleTitles: string[] = [];

    for (const raw of data as any[]) {
      const idNum = Number(raw?.id);
      const title = typeof raw?.title === "string" ? String(raw.title).trim() : "";
      const deadline = raw?.deadline ? new Date(String(raw.deadline)) : null;
      if (!Number.isFinite(idNum) || !deadline) continue;

      const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
      if (deadlineDay.getTime() < todayDayStart.getTime()) continue;

      const checkins = Array.isArray((raw as any)?.flag_checkins)
        ? ((raw as any).flag_checkins as any[])
        : [];
      const hasTodayCheckin = checkins.some((c: any) => {
        const createdAt = c?.created_at ? new Date(String(c.created_at)) : null;
        if (!createdAt) return false;
        return createdAt >= start && createdAt < next;
      });
      if (hasTodayCheckin) continue;

      pending++;
      if (title && sampleTitles.length < 3) {
        sampleTitles.push(title);
      }
    }

    return { count: pending, sampleTitles };
  } catch {
    return { count: 0, sampleTitles: [] };
  }
}

export async function issueRandomSticker(options: {
  client: any;
  userId: string;
  source: "flag_checkin" | "flag_settle";
  mode: "checkin" | "settle";
  tier: FlagTier;
  defaultDesc: string;
}): Promise<StickerReward | null> {
  const { client, userId, source, mode, tier, defaultDesc } = options;
  const { data: emojis } = await client.from("emojis").select("*");
  if (!emojis || emojis.length === 0) {
    return null;
  }
  const targetRarity = pickRarity(mode, tier);
  let pool = (emojis as EmojiRow[]).filter((e) => (e.rarity || "common") === targetRarity);
  if (!pool.length) {
    pool = emojis as EmojiRow[];
  }
  const randomDbEmoji = pool[Math.floor(Math.random() * pool.length)];
  const { error: rewardError } = await client.from("user_emojis").insert({
    user_id: userId,
    emoji_id: randomDbEmoji.id,
    source,
  });
  if (rewardError) {
    return null;
  }
  return {
    id: String(randomDbEmoji.id),
    emoji: randomDbEmoji.image_url || randomDbEmoji.url || "❓",
    name: randomDbEmoji.name,
    rarity: randomDbEmoji.rarity || "common",
    desc: randomDbEmoji.description || defaultDesc,
    color: getRarityClass(randomDbEmoji.rarity || "common"),
    image_url: randomDbEmoji.image_url || randomDbEmoji.url || undefined,
  };
}
