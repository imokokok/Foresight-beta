/**
 * Rate Limiting 工具
 * 基于内存的简单限流实现
 * 注意：由于构建环境限制（Edge Runtime 兼容性），仅保留内存实现。
 * 生产环境建议迁移到 Redis。
 */

import type { NextRequest } from "next/server";

interface RateLimitConfig {
  /**
   * 时间窗口（毫秒）
   */
  interval: number;
  /**
   * 窗口内最大请求数
   */
  limit: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// 内存存储（开发环境）
const store = new Map<string, RateLimitEntry>();

const upstashUrl = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const upstashToken = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

function canUseUpstash(): boolean {
  return Boolean(upstashUrl && upstashToken);
}

async function upstashPipeline(commands: Array<Array<string | number>>): Promise<unknown> {
  const url = new URL("pipeline", upstashUrl).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

async function upstashIncrWithExpire(key: string, ttlMs: number): Promise<number | null> {
  try {
    const incrRes = await upstashPipeline([["INCR", key]]);
    const countRaw = Array.isArray(incrRes) ? (incrRes[0] as any)?.result : null;
    const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
    if (!Number.isFinite(count)) return null;
    if (count === 1) {
      await upstashPipeline([["PEXPIRE", key, Math.max(1, Math.floor(ttlMs))]]);
    }
    return count;
  } catch {
    return null;
  }
}

/**
 * 检查请求是否超出限流
 * @param identifier 标识符（通常是 IP 地址或用户 ID）
 * @param config 限流配置
 * @returns 是否允许通过
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { interval: 60 * 1000, limit: 60 },
  namespace: string = "default"
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const baseKey = `ratelimit:${namespace}:${identifier}`;

  if (canUseUpstash()) {
    const intervalMs = Math.max(1, Math.floor(config.interval));
    const windowStart = Math.floor(now / intervalMs) * intervalMs;
    const resetAt = windowStart + intervalMs;
    const windowKey = `${baseKey}:${windowStart}`;
    const count = await upstashIncrWithExpire(windowKey, intervalMs + 1000);
    if (count !== null) {
      const remaining = Math.max(0, config.limit - count);
      return { success: count <= config.limit, remaining, resetAt };
    }
  }

  const entry = store.get(baseKey);

  // 如果没有记录或已过期，创建新记录
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.interval;
    store.set(baseKey, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: resetAt,
    };
  }

  // 如果未超出限制，增加计数
  if (entry.count < config.limit) {
    entry.count++;
    return {
      success: true,
      remaining: config.limit - entry.count,
      resetAt: entry.resetAt,
    };
  }

  // 超出限制
  return {
    success: false,
    remaining: 0,
    resetAt: entry.resetAt,
  };
}

export const RateLimits = {
  strict: { interval: 60 * 1000, limit: 5 }, // 5 req/min
  moderate: { interval: 60 * 1000, limit: 20 }, // 20 req/min
  relaxed: { interval: 60 * 1000, limit: 60 }, // 60 req/min
  lenient: { interval: 60 * 1000, limit: 120 }, // 120 req/min
};

export function getIP(req: NextRequest | Request): string {
  if ("ip" in req && req.ip) return req.ip as string;
  const headers = "headers" in req ? req.headers : new Headers();
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown"
  );
}

export function resetRateLimitStore() {
  store.clear();
}
