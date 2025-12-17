/**
 * 简单的内存限流器
 * 生产环境建议使用 Redis (Upstash/Vercel KV)
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

// 定期清理过期记录
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetAt) {
        store.delete(key);
      }
    }
  }, 60000); // 每分钟清理一次
}

export interface RateLimitConfig {
  /**
   * 时间窗口内允许的最大请求数
   */
  limit: number;

  /**
   * 时间窗口（毫秒）
   */
  windowMs: number;
}

export interface RateLimitResult {
  /**
   * 是否允许请求
   */
  success: boolean;

  /**
   * 剩余请求数
   */
  remaining: number;

  /**
   * 重置时间戳
   */
  resetAt: number;

  /**
   * 是否被限流
   */
  limited: boolean;
}

/**
 * 检查速率限制
 * @param identifier 唯一标识符（IP、用户ID等）
 * @param config 限流配置
 * @returns 限流结果
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { limit: 10, windowMs: 60000 }
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  let record = store.get(key);

  // 如果记录不存在或已过期，创建新记录
  if (!record || now > record.resetAt) {
    record = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, record);

    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: record.resetAt,
      limited: false,
    };
  }

  // 检查是否超过限制
  if (record.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: record.resetAt,
      limited: true,
    };
  }

  // 增加计数
  record.count++;
  store.set(key, record);

  return {
    success: true,
    remaining: config.limit - record.count,
    resetAt: record.resetAt,
    limited: false,
  };
}

/**
 * 从请求中获取 IP 地址
 */
export function getIP(request: Request): string {
  // Vercel/Cloudflare 等平台的标准头
  const headers = request.headers;

  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * 预定义的限流配置
 */
export const RateLimits = {
  // 严格限制（登录、注册等）
  strict: { limit: 5, windowMs: 60000 }, // 5次/分钟

  // 中等限制（创建订单、发帖等）
  moderate: { limit: 20, windowMs: 60000 }, // 20次/分钟

  // 宽松限制（查询、浏览等）
  relaxed: { limit: 100, windowMs: 60000 }, // 100次/分钟

  // 极宽松（静态资源等）
  lenient: { limit: 1000, windowMs: 60000 }, // 1000次/分钟
};
