import { getRedisClient } from "../redis/client.js";
import { microCacheGet, microCacheSet, type MicroCacheEntry } from "./microCache.js";

export type IntentStatus = "pending" | "confirming" | "failed";

export type TradeIntentRecord = {
  id: string;
  type: "trade";
  userAddress: string;
  marketKey: string;
  chainId: number;
  createdAt: number;
  updatedAt: number;
  status: IntentStatus;
  txHash: string | null;
  error: string | null;
};

function getIntentRedisKey(id: string): string {
  return `intent:${id}`;
}

export function createGaslessQuotaStore() {
  const gaslessQuotaMicroCache = new Map<string, MicroCacheEntry<number>>();

  function getGaslessQuotaKey(userAddress: string): string {
    return `gasless:quota:day:${userAddress.toLowerCase()}`;
  }

  async function getGaslessQuotaUsage(
    userAddress: string
  ): Promise<{ used: number; remaining: number }> {
    const limit =
      Number(process.env.RELAYER_GASLESS_DAILY_LIMIT_USD || "0") > 0
        ? Number(process.env.RELAYER_GASLESS_DAILY_LIMIT_USD || "0")
        : 0;
    if (limit <= 0) return { used: 0, remaining: Number.POSITIVE_INFINITY };

    const cacheKey = userAddress.toLowerCase();
    const cached = microCacheGet(gaslessQuotaMicroCache, cacheKey);
    if (typeof cached === "number") {
      return { used: cached, remaining: Math.max(0, limit - cached) };
    }

    const redis = getRedisClient();
    if (!redis.isReady()) return { used: 0, remaining: limit };

    const raw = await redis.get(getGaslessQuotaKey(userAddress));
    const used = raw ? Number(raw) || 0 : 0;
    microCacheSet(gaslessQuotaMicroCache, cacheKey, 5000, used, 5000);
    return { used, remaining: Math.max(0, limit - used) };
  }

  async function addGaslessQuotaUsage(userAddress: string, costUsd: number): Promise<void> {
    if (!(Number(process.env.RELAYER_GASLESS_DAILY_LIMIT_USD || "0") > 0)) return;
    if (!(Number.isFinite(costUsd) && costUsd > 0)) return;
    const redis = getRedisClient();
    if (!redis.isReady()) return;
    const key = getGaslessQuotaKey(userAddress);
    const now = Date.now();
    const endOfDay =
      new Date(now).setUTCHours(23, 59, 59, 999) - new Date(now).getTimezoneOffset() * 60000;
    const ttlSeconds = Math.max(60, Math.floor((endOfDay - now) / 1000));
    try {
      const raw = await redis.get(key);
      const next = (raw ? Number(raw) || 0 : 0) + costUsd;
      await redis.set(key, String(next), ttlSeconds);
    } catch {}
    const cacheKey = userAddress.toLowerCase();
    const cached = microCacheGet(gaslessQuotaMicroCache, cacheKey);
    if (typeof cached === "number") {
      const next = cached + costUsd;
      microCacheSet(gaslessQuotaMicroCache, cacheKey, 5000, next, 5000);
    }
  }

  return { getGaslessQuotaUsage, addGaslessQuotaUsage };
}

export function createIntentStore() {
  const intentStatusMicroCache = new Map<string, MicroCacheEntry<TradeIntentRecord>>();

  async function saveTradeIntent(record: TradeIntentRecord): Promise<void> {
    const redis = getRedisClient();
    const ttlSeconds = Math.max(
      60,
      Math.floor((Number(process.env.RELAYER_INTENT_TTL_MS || "86400000") || 86400000) / 1000)
    );
    try {
      await redis.set(getIntentRedisKey(record.id), JSON.stringify(record), ttlSeconds);
    } catch {}
    microCacheSet(intentStatusMicroCache, record.id, 5000, record, 5000);
  }

  async function loadIntent(id: string): Promise<TradeIntentRecord | null> {
    const cached = microCacheGet(intentStatusMicroCache, id);
    if (cached) return cached;
    const redis = getRedisClient();
    if (!redis.isReady()) return null;
    try {
      const raw = await redis.get(getIntentRedisKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as TradeIntentRecord;
      if (!parsed || typeof parsed !== "object") return null;
      microCacheSet(intentStatusMicroCache, id, 5000, parsed, 5000);
      return parsed;
    } catch {
      return null;
    }
  }

  return { saveTradeIntent, loadIntent };
}
