/**
 * Rate Limiting 工具
 * 基于内存的简单限流实现
 * 注意：由于构建环境限制（Edge Runtime 兼容性），暂时移除 Upstash Redis 依赖，回退到内存实现。
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

type UpstashLimiter = {
  limit: (identifier: string) => Promise<{ success: boolean; remaining: number; reset?: number }>;
};

const upstashLimiterCache = new Map<string, UpstashLimiter>();

function resolveUpstashEnv() {
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_REST_URL ||
    ""
  ).trim();
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.REDIS_REST_TOKEN ||
    ""
  ).trim();
  if (!url || !token) return null;
  return { url, token };
}

function intervalMsToWindow(intervalMs: number): `${number} s` {
  const sec = Math.max(1, Math.floor(intervalMs / 1000));
  return `${sec} s`;
}

async function getUpstashLimiter(
  namespace: string,
  config: RateLimitConfig
): Promise<UpstashLimiter | null> {
  const env = resolveUpstashEnv();
  if (!env) return null;

  const cacheKey = `${namespace}:${config.limit}:${config.interval}`;
  const cached = upstashLimiterCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [{ Redis }, { Ratelimit }] = await Promise.all([
      import("@upstash/redis"),
      import("@upstash/ratelimit"),
    ]);

    const redis = new Redis({ url: env.url, token: env.token });
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, intervalMsToWindow(config.interval)),
      prefix: `ratelimit:${namespace}`,
    });

    const limiter: UpstashLimiter = {
      limit: async (identifier: string) => {
        const result = await ratelimit.limit(identifier);
        return {
          success: !!result.success,
          remaining: typeof result.remaining === "number" ? result.remaining : 0,
          reset: typeof (result as any).reset === "number" ? (result as any).reset : undefined,
        };
      },
    };
    upstashLimiterCache.set(cacheKey, limiter);
    return limiter;
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
  const upstash = await getUpstashLimiter(namespace, config);
  if (upstash) {
    const res = await upstash.limit(identifier);
    const resetAt = typeof res.reset === "number" ? res.reset : Date.now() + config.interval;
    return {
      success: res.success,
      remaining: Math.max(0, res.remaining),
      resetAt,
    };
  }

  const now = Date.now();
  const key = `ratelimit:${namespace}:${identifier}`;

  const entry = store.get(key);

  // 如果没有记录或已过期，创建新记录
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.interval;
    store.set(key, { count: 1, resetAt });
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
