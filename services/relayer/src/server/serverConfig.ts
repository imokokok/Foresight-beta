import express from "express";
import cors from "cors";
import {
  requestIdMiddleware,
  requestLoggerMiddleware,
  metricsMiddleware,
} from "../middleware/index.js";
import { createRateLimitMiddleware } from "../ratelimit/index.js";
import { healthRoutes, clusterRoutes } from "../routes/index.js";
import { clampNumber, readIntEnv } from "../utils/envNumbers.js";
import { getClusterManager } from "../cluster/index.js";
import { getRedisClient } from "../redis/client.js";
import { getOrderbookSnapshotService } from "../redis/orderbookSnapshot.js";
import { microCacheGet, microCacheSet } from "../utils/microCache.js";

export function createApp() {
  const app = express();
  const trustProxyHops = Math.max(0, readIntEnv("RELAYER_TRUST_PROXY_HOPS", 0));
  if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

  // 配置CORS
  const allowedOriginsRaw = process.env.RELAYER_CORS_ORIGINS || "";
  const allowedOrigins = allowedOriginsRaw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    })
  );

  app.use(express.json({ limit: "1mb" }));

  // 添加中间件
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(metricsMiddleware);
  app.use(createRateLimitMiddleware());

  // 添加健康检查和集群管理路由
  app.use(healthRoutes);
  app.use(clusterRoutes);

  return app;
}
