/**
 * Rate Limiting 工具
 * 基于内存的简单限流实现（生产环境建议使用 Redis）
 */

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

// 定期清理过期记录（每分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60 * 1000);

/**
 * 检查请求是否超出限流
 * @param identifier 标识符（通常是 IP 地址或用户 ID）
 * @param config 限流配置
 * @returns 是否允许通过
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { interval: 60 * 1000, limit: 60 }
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const key = `ratelimit:${identifier}`;

  const entry = store.get(key);

  // 如果没有记录或已过期，创建新记录
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.interval;
    store.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.limit - 1,
      reset: resetAt,
    };
  }

  // 如果未超出限制，增加计数
  if (entry.count < config.limit) {
    entry.count++;
    return {
      success: true,
      remaining: config.limit - entry.count,
      reset: entry.resetAt,
    };
  }

  // 超出限制
  return {
    success: false,
    remaining: 0,
    reset: entry.resetAt,
  };
}

/**
 * Next.js API Route 中间件包装器
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  config?: RateLimitConfig
) {
  return async (req: Request): Promise<Response> => {
    // 获取客户端 IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const result = checkRateLimit(ip, config);

    // 添加 Rate Limit Headers
    const headers = new Headers({
      "X-RateLimit-Limit": String(config?.limit || 60),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.reset),
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: "请求过于频繁，请稍后再试",
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers.entries()),
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
          },
        }
      );
    }

    // 执行原始处理器
    const response = await handler(req);

    // 添加 Rate Limit Headers 到响应
    for (const [key, value] of headers.entries()) {
      response.headers.set(key, value);
    }

    return response;
  };
}

/**
 * 预定义的限流配置
 */
export const rateLimitPresets = {
  /** 严格限制（登录、注册等敏感操作）*/
  strict: { interval: 15 * 60 * 1000, limit: 5 }, // 15分钟5次
  /** 一般限制（API 调用）*/
  normal: { interval: 60 * 1000, limit: 60 }, // 1分钟60次
  /** 宽松限制（查询操作）*/
  relaxed: { interval: 60 * 1000, limit: 120 }, // 1分钟120次
};
