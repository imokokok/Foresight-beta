import { Database } from "@/lib/database.types";

export type FlagTier = "light" | "standard" | "intense" | "hardcore";

type TierConfig = {
  checkinDropRate: number;
  settleDropRate: number;
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
    checkinDropRate: 0.02,
    settleDropRate: 0.4,
  },
  standard: {
    checkinDropRate: 0.04,
    settleDropRate: 0.7,
  },
  intense: {
    checkinDropRate: 0.06,
    settleDropRate: 1,
  },
  hardcore: {
    checkinDropRate: 0.08,
    settleDropRate: 1,
  },
};

export function getTierConfig(tier: FlagTier): TierConfig {
  return TIER_CONFIG_MAP[tier];
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

const LUCKY_ADDRESSES = [
  "0x23d930b75a647a11a12b94d747488aa232375859",
  "0x377f4bb22f0ebd9238c1a30a8872fd00fb0b6f43",
].map((addr) => addr.toLowerCase());

export function isLuckyAddress(address?: string | null) {
  if (!address) return false;
  const lower = address.toLowerCase();
  return LUCKY_ADDRESSES.some((addr) => addr === lower);
}

export async function getPendingReviewCountForWitness(options: {
  client: any;
  witnessId: string;
}): Promise<number> {
  const { client, witnessId } = options;
  try {
    const { data } = await client
      .from("flags")
      .select("id")
      .eq("witness_id", witnessId)
      .eq("status", "pending_review")
      .eq("verification_type", "witness");
    if (!Array.isArray(data)) return 0;
    return data.length;
  } catch {
    return 0;
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
