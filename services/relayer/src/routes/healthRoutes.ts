/**
 * 健康检查和监控端点路由
 */

import { Router, Request, Response } from "express";
import { getMetrics, getContentType, readinessCheckReady } from "../monitoring/metrics.js";
import { healthService } from "../monitoring/health.js";
import { logger } from "../monitoring/logger.js";

const router = Router();

/**
 * GET /health - 健康检查端点
 * 用于 Kubernetes liveness probe
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const result = await healthService.runHealthChecks();
    const statusCode = result.status === "healthy" ? 200 : result.status === "degraded" ? 200 : 503;

    res.status(statusCode).json(result);
  } catch (error: any) {
    logger.error("Health check failed", {}, error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /ready - 就绪检查端点
 * 用于 Kubernetes readiness probe
 */
router.get("/ready", async (req: Request, res: Response) => {
  try {
    const result = await healthService.runReadinessChecks();
    for (const [name, check] of Object.entries(result.checks || {})) {
      readinessCheckReady.set({ check: name }, check.ready ? 1 : 0);
    }
    const statusCode = result.ready ? 200 : 503;

    res.status(statusCode).json(result);
  } catch (error: any) {
    logger.error("Readiness check failed", {}, error);
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /live - 简单存活检查
 * 最小化开销的存活检查
 */
router.get("/live", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: healthService.getUptime(),
  });
});

/**
 * GET /metrics - Prometheus 指标端点
 */
router.get("/metrics", async (req: Request, res: Response) => {
  try {
    const metrics = await getMetrics();
    res.setHeader("Content-Type", getContentType());
    res.send(metrics);
  } catch (error: any) {
    logger.error("Failed to get metrics", {}, error);
    res.status(500).send("Failed to get metrics");
  }
});

/**
 * GET /version - 版本信息
 */
router.get("/version", (req: Request, res: Response) => {
  res.json({
    version: process.env.npm_package_version || "1.0.0",
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || "development",
    buildTime: process.env.BUILD_TIME || null,
    commitHash: process.env.COMMIT_HASH || null,
  });
});

export default router;
