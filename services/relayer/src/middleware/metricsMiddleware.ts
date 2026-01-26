/**
 * Express 中间件 - API 指标收集
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { apiRequestsTotal, apiRequestLatency, apiRateLimitHits } from "../monitoring/metrics.js";
import { logger } from "../monitoring/logger.js";

const IGNORED_PATHS = new Set(["/health", "/ready", "/metrics", "/favicon.ico"]);

function shouldIgnorePath(path: string): boolean {
  if (IGNORED_PATHS.has(path)) return true;
  if (path.startsWith("/internal/")) return true;
  return false;
}

/**
 * API 请求指标中间件
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const normalizedPath = normalizePath(req.path);

  if (shouldIgnorePath(normalizedPath)) {
    next();
    return;
  }

  const startTime = Date.now();
  const path = normalizedPath;
  const method = req.method;

  // 响应结束时记录指标
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode.toString();

    apiRequestsTotal.inc({ method, path, status });
    apiRequestLatency.observe({ method, path }, duration);

    // 记录慢请求
    if (duration > 1000) {
      logger.warn("Slow API request", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        method,
        path,
        duration,
        status,
      });
    }
  });

  next();
}

/**
 * 速率限制命中记录中间件
 */
export function rateLimitMetricsMiddleware(path: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send.bind(res);

    res.send = function (body: any) {
      if (res.statusCode === 429) {
        apiRateLimitHits.inc({ path: normalizePath(path) });
        logger.warn("Rate limit hit", {
          path: normalizePath(path),
          ip: req.ip,
        });
      }
      return originalSend(body);
    };

    next();
  };
}

/**
 * 标准化路径 (移除参数)
 */
function normalizePath(path: string): string {
  // 移除查询参数
  const basePath = path.split("?")[0];

  // 替换常见的动态参数
  return (
    basePath
      .replace(/0x[a-fA-F0-9]+/g, ":address")
      .replace(/\/\d+(?=\/|$)/g, "/:id")
      .replace(/\/+$/, "") || "/"
  );
}

/**
 * 请求 ID 中间件
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) || `${Date.now()}-${randomUUID()}`;

  res.setHeader("X-Request-ID", requestId);
  (req as any).requestId = requestId;

  next();
}

/**
 * 请求日志中间件
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = (req as any).requestId || "unknown";

  // 请求开始日志
  logger.debug("Request started", {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  // 响应结束日志
  res.on("finish", () => {
    const duration = Date.now() - startTime;

    logger.info("Request completed", {
      requestId,
      apiKeyId: (req as any).apiKeyId || null,
      method: req.method,
      path: normalizePath(req.path),
      status: res.statusCode,
      duration,
    });
  });

  next();
}
