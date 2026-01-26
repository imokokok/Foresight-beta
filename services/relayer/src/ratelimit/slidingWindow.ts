/**
 * 滑动窗口限流器
 * 支持 Redis 分布式限流和本地限流
 */

import { logger } from "../monitoring/logger.js";
import { randomUUID } from "crypto";
import { Counter, Gauge } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";
import { getRedisClient } from "../redis/client.js";

// ============================================================
// 指标定义
// ============================================================

const rateLimitRequestsTotal = new Counter({
  name: "foresight_ratelimit_requests_total",
  help: "Total rate limit checks",
  labelNames: ["endpoint", "result"] as const, // result: allowed, denied
  registers: [metricsRegistry],
});

const rateLimitCurrentUsage = new Gauge({
  name: "foresight_ratelimit_current_usage",
  help: "Current rate limit usage",
  labelNames: ["endpoint", "key"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

export interface RateLimitConfig {
  /** 窗口大小 (毫秒) */
  windowMs: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
  /** 使用 Redis 分布式限流 */
  useRedis?: boolean;
  /** 限流 key 前缀 */
  keyPrefix?: string;
  /** 跳过的路径 */
  skipPaths?: string[];
  /** 跳过的 IP */
  skipIps?: string[];
  /** 自定义 key 生成器 */
  keyGenerator?: (req: RateLimitRequest) => string;
  /** 被限流时的响应 */
  onLimited?: (req: RateLimitRequest) => RateLimitResponse;
}

export interface RateLimitRequest {
  ip: string;
  path: string;
  method: string;
  userId?: string;
  headers?: Record<string, string>;
}

export interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

// ============================================================
// 本地滑动窗口限流器
// ============================================================

export class LocalSlidingWindowLimiter {
  private windows: Map<string, WindowEntry[]> = new Map();
  private config: RateLimitConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      windowMs: config.windowMs || 60000,
      maxRequests: config.maxRequests || 100,
      keyPrefix: config.keyPrefix || "ratelimit:",
      skipPaths: config.skipPaths || ["/health", "/ready", "/live", "/metrics"],
      skipIps: config.skipIps || [],
    };

    this.cleanupTimer = setInterval(
      () => {
        this.cleanup();
      },
      Math.min(this.config.windowMs, 60000)
    );
  }

  /**
   * 清理过期窗口
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    let cleaned = 0;
    const keysToDelete: string[] = [];

    for (const [key, entries] of this.windows.entries()) {
      const validEntries = entries.filter((e) => e.windowStart > windowStart);
      if (validEntries.length === 0) {
        keysToDelete.push(key);
      } else if (validEntries.length < entries.length) {
        this.windows.set(key, validEntries);
      }
      cleaned++;
    }

    for (const key of keysToDelete) {
      this.windows.delete(key);
    }
  }

  /**
   * 检查是否允许请求
   */
  check(req: RateLimitRequest): RateLimitResponse {
    // 检查跳过条件
    if (this.shouldSkip(req)) {
      return { allowed: true, remaining: this.config.maxRequests, resetAt: 0 };
    }

    const key = this.getKey(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // 获取或创建窗口
    let entries = this.windows.get(key) || [];

    // 过滤掉过期的条目
    entries = entries.filter((e) => e.windowStart > windowStart);

    // 计算当前窗口内的请求数
    const currentCount = entries.reduce((sum, e) => sum + e.count, 0);

    if (currentCount >= this.config.maxRequests) {
      // 被限流
      const oldestEntry = entries[0];
      const resetAt = oldestEntry
        ? oldestEntry.windowStart + this.config.windowMs
        : now + this.config.windowMs;
      const retryAfter = Math.ceil((resetAt - now) / 1000);

      rateLimitRequestsTotal.inc({ endpoint: req.path, result: "denied" });

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // 添加新条目
    entries.push({ count: 1, windowStart: now });
    this.windows.set(key, entries);

    const remaining = this.config.maxRequests - currentCount - 1;

    rateLimitRequestsTotal.inc({ endpoint: req.path, result: "allowed" });
    rateLimitCurrentUsage.set({ endpoint: req.path, key }, currentCount + 1);

    return {
      allowed: true,
      remaining,
      resetAt: now + this.config.windowMs,
    };
  }

  /**
   * 生成限流 key
   */
  private getKey(req: RateLimitRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }
    // 默认按 IP + 路径
    return `${this.config.keyPrefix}${req.ip}:${req.path}`;
  }

  /**
   * 检查是否跳过限流
   */
  private shouldSkip(req: RateLimitRequest): boolean {
    if (this.config.skipPaths?.includes(req.path)) {
      return true;
    }
    if (this.config.skipIps?.includes(req.ip)) {
      return true;
    }
    return false;
  }

  /**
   * 停止限流器
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.windows.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): { keys: number; totalEntries: number } {
    let totalEntries = 0;
    for (const entries of this.windows.values()) {
      totalEntries += entries.length;
    }
    return {
      keys: this.windows.size,
      totalEntries,
    };
  }
}

// ============================================================
// Redis 分布式滑动窗口限流器
// ============================================================

export class RedisSlidingWindowLimiter {
  private config: RateLimitConfig;
  private localFallback: LocalSlidingWindowLimiter;

  constructor(config: RateLimitConfig) {
    this.config = {
      ...config,
      windowMs: config.windowMs || 60000,
      maxRequests: config.maxRequests || 100,
      keyPrefix: config.keyPrefix || "ratelimit:",
      skipPaths: config.skipPaths || ["/health", "/ready", "/live", "/metrics"],
      skipIps: config.skipIps || [],
      useRedis: true,
    };

    // 本地降级备份
    this.localFallback = new LocalSlidingWindowLimiter(config);
  }

  /**
   * 检查是否允许请求
   */
  async check(req: RateLimitRequest): Promise<RateLimitResponse> {
    // 检查跳过条件
    if (this.shouldSkip(req)) {
      return { allowed: true, remaining: this.config.maxRequests, resetAt: 0 };
    }

    const redis = getRedisClient();

    // Redis 不可用时降级到本地
    if (!redis.isReady()) {
      logger.debug("Redis not ready, falling back to local rate limiter");
      return this.localFallback.check(req);
    }

    const key = this.getKey(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // 使用 Redis Sorted Set 实现滑动窗口
      // 分数是时间戳，值是唯一 ID
      const rawClient = redis.getRawClient();
      if (!rawClient) {
        return this.localFallback.check(req);
      }

      // 原子操作：清理过期 + 添加新请求 + 获取计数
      const multi = rawClient.multi();

      // 1. 移除过期的条目
      multi.zRemRangeByScore(key, 0, windowStart);

      // 2. 添加当前请求
      const requestId = `${now}-${randomUUID()}`;
      multi.zAdd(key, { score: now, value: requestId });

      // 3. 获取当前窗口内的请求数
      multi.zCard(key);

      // 4. 设置过期时间
      multi.expire(key, Math.ceil(this.config.windowMs / 1000) + 1);

      const results = await multi.exec();
      const currentCount = results[2] as number;

      if (currentCount > this.config.maxRequests) {
        // 被限流，回滚刚才添加的请求
        await rawClient.zRem(key, requestId);

        const resetAt = now + this.config.windowMs;
        const retryAfter = Math.ceil(this.config.windowMs / 1000);

        rateLimitRequestsTotal.inc({ endpoint: req.path, result: "denied" });

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }

      const remaining = this.config.maxRequests - currentCount;

      rateLimitRequestsTotal.inc({ endpoint: req.path, result: "allowed" });
      rateLimitCurrentUsage.set({ endpoint: req.path, key }, currentCount);

      return {
        allowed: true,
        remaining,
        resetAt: now + this.config.windowMs,
      };
    } catch (error: any) {
      logger.error("Redis rate limit error, falling back to local", {}, error);
      return this.localFallback.check(req);
    }
  }

  /**
   * 生成限流 key
   */
  private getKey(req: RateLimitRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }
    return `${this.config.keyPrefix}${req.ip}:${req.path}`;
  }

  /**
   * 检查是否跳过限流
   */
  private shouldSkip(req: RateLimitRequest): boolean {
    if (this.config.skipPaths?.includes(req.path)) {
      return true;
    }
    if (this.config.skipIps?.includes(req.ip)) {
      return true;
    }
    return false;
  }

  /**
   * 停止限流器
   */
  stop(): void {
    this.localFallback.stop();
  }
}

// ============================================================
// 多层限流策略
// ============================================================

export interface TieredRateLimitConfig {
  /** 全局限流 */
  global?: RateLimitConfig;
  /** 按 IP 限流 */
  perIp?: RateLimitConfig;
  /** 按用户限流 */
  perUser?: RateLimitConfig;
  /** 按端点限流 */
  perEndpoint?: Record<string, RateLimitConfig>;
}

export class TieredRateLimiter {
  private globalLimiter?: RedisSlidingWindowLimiter;
  private ipLimiter?: RedisSlidingWindowLimiter;
  private userLimiter?: RedisSlidingWindowLimiter;
  private endpointLimiters: Map<string, RedisSlidingWindowLimiter> = new Map();

  constructor(config: TieredRateLimitConfig) {
    if (config.global) {
      this.globalLimiter = new RedisSlidingWindowLimiter({
        ...config.global,
        keyPrefix: "ratelimit:global:",
        keyGenerator: () => "global",
      });
    }

    if (config.perIp) {
      this.ipLimiter = new RedisSlidingWindowLimiter({
        ...config.perIp,
        keyPrefix: "ratelimit:ip:",
        keyGenerator: (req) => req.ip,
      });
    }

    if (config.perUser) {
      this.userLimiter = new RedisSlidingWindowLimiter({
        ...config.perUser,
        keyPrefix: "ratelimit:user:",
        keyGenerator: (req) => req.userId || req.ip,
      });
    }

    if (config.perEndpoint) {
      for (const [path, endpointConfig] of Object.entries(config.perEndpoint)) {
        this.endpointLimiters.set(
          path,
          new RedisSlidingWindowLimiter({
            ...endpointConfig,
            keyPrefix: `ratelimit:endpoint:${path}:`,
          })
        );
      }
    }
  }

  /**
   * 检查所有限流层
   */
  async check(req: RateLimitRequest): Promise<RateLimitResponse> {
    // 1. 检查全局限流
    if (this.globalLimiter) {
      const result = await this.globalLimiter.check(req);
      if (!result.allowed) {
        return result;
      }
    }

    // 2. 检查 IP 限流
    if (this.ipLimiter) {
      const result = await this.ipLimiter.check(req);
      if (!result.allowed) {
        return result;
      }
    }

    // 3. 检查用户限流
    if (this.userLimiter && req.userId) {
      const result = await this.userLimiter.check(req);
      if (!result.allowed) {
        return result;
      }
    }

    // 4. 检查端点限流
    const endpointLimiter = this.endpointLimiters.get(req.path);
    if (endpointLimiter) {
      const result = await endpointLimiter.check(req);
      if (!result.allowed) {
        return result;
      }
    }

    // 所有检查通过
    return {
      allowed: true,
      remaining: -1, // 多层限流不返回剩余次数
      resetAt: 0,
    };
  }

  /**
   * 停止所有限流器
   */
  stop(): void {
    this.globalLimiter?.stop();
    this.ipLimiter?.stop();
    this.userLimiter?.stop();
    for (const limiter of this.endpointLimiters.values()) {
      limiter.stop();
    }
  }
}

// ============================================================
// 预设配置
// ============================================================

export const DEFAULT_RATE_LIMITS: TieredRateLimitConfig = {
  global: {
    windowMs: 1000, // 1 秒
    maxRequests: 10000, // 全局 10000 QPS
  },
  perIp: {
    windowMs: 60000, // 1 分钟
    maxRequests: 100, // 每 IP 100 次/分钟
  },
  perUser: {
    windowMs: 60000,
    maxRequests: 200, // 登录用户 200 次/分钟
  },
  perEndpoint: {
    "/v2/orders": {
      windowMs: 60000,
      maxRequests: 30, // 下单 30 次/分钟
    },
    "/orderbook/orders": {
      windowMs: 60000,
      maxRequests: 30,
    },
  },
};

// ============================================================
// 单例
// ============================================================

let limiterInstance: TieredRateLimiter | null = null;

export function getRateLimiter(config?: TieredRateLimitConfig): TieredRateLimiter {
  if (!limiterInstance) {
    limiterInstance = new TieredRateLimiter(config || DEFAULT_RATE_LIMITS);
  }
  return limiterInstance;
}

export function closeRateLimiter(): void {
  if (limiterInstance) {
    limiterInstance.stop();
    limiterInstance = null;
  }
}
