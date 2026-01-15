/**
 * Express 限流中间件
 */

import { Request, Response, NextFunction } from "express";
import { getRateLimiter, TieredRateLimitConfig, RateLimitRequest } from "./slidingWindow.js";
import { logger } from "../monitoring/logger.js";

/**
 * 创建限流中间件
 */
export function createRateLimitMiddleware(config?: TieredRateLimitConfig) {
  const limiter = getRateLimiter(config);

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const rateLimitReq: RateLimitRequest = {
      ip: getClientIp(req),
      path: req.path,
      method: req.method,
      userId: getUserId(req),
      headers: req.headers as Record<string, string>,
    };

    try {
      const result = await limiter.check(rateLimitReq);

      // 设置限流响应头
      res.setHeader(
        "X-RateLimit-Limit",
        result.remaining >= 0 ? result.remaining + 1 : "unlimited"
      );
      res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
      res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
        res.setHeader("Retry-After", result.retryAfter || 60);

        logger.warn("Rate limit exceeded", {
          ip: rateLimitReq.ip,
          path: rateLimitReq.path,
          userId: rateLimitReq.userId,
          retryAfter: result.retryAfter,
        });

        res.status(429).json({
          success: false,
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: result.retryAfter,
        });
        return;
      }

      next();
    } catch (error: any) {
      logger.error("Rate limit middleware error", {}, error);
      // 限流器出错时放行请求
      next();
    }
  };
}

/**
 * 获取客户端 IP
 */
function getClientIp(req: Request): string {
  // 支持代理头
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ips.trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * 获取用户 ID
 */
function getUserId(req: Request): string | undefined {
  // 从 header 获取
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // 简单提取 token 作为用户标识
    return authHeader.replace(/^Bearer\s+/i, "").substring(0, 20);
  }

  // 从请求体获取
  const body = req.body as { order?: { maker?: string }; maker?: string };
  if (body?.order?.maker) {
    return body.order.maker;
  }
  if (body?.maker) {
    return body.maker;
  }

  return undefined;
}

/**
 * 创建端点限流中间件 (用于特定路由)
 */
export function createEndpointRateLimiter(
  windowMs: number,
  maxRequests: number,
  keyGenerator?: (req: Request) => string
) {
  const limiter = getRateLimiter({
    perEndpoint: {
      "*": { windowMs, maxRequests },
    },
  });

  return async function endpointRateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const rateLimitReq: RateLimitRequest = {
      ip: keyGenerator ? keyGenerator(req) : getClientIp(req),
      path: req.path,
      method: req.method,
    };

    const result = await limiter.check(rateLimitReq);

    if (!result.allowed) {
      res.status(429).json({
        success: false,
        error: "Too Many Requests",
        retryAfter: result.retryAfter,
      });
      return;
    }

    next();
  };
}
