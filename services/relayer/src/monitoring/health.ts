/**
 * 健康检查系统
 * 提供 /health 和 /ready 端点
 */

import { systemHealthy } from "./metrics.js";
import { logger } from "./logger.js";

export interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    [key: string]: {
      status: "pass" | "fail" | "warn";
      message?: string;
      latency?: number;
    };
  };
}

export interface ReadinessCheckResult {
  ready: boolean;
  timestamp: string;
  checks: {
    [key: string]: {
      ready: boolean;
      message?: string;
    };
  };
}

type HealthChecker = () => Promise<{
  status: "pass" | "fail" | "warn";
  message?: string;
  latency?: number;
}>;
type ReadinessChecker = () => Promise<{ ready: boolean; message?: string }>;

class HealthCheckService {
  private healthCheckers: Map<string, HealthChecker> = new Map();
  private readinessCheckers: Map<string, ReadinessChecker> = new Map();
  private startTime: number = Date.now();
  private version: string = process.env.npm_package_version || "1.0.0";

  /**
   * 注册健康检查器
   */
  registerHealthCheck(name: string, checker: HealthChecker): void {
    this.healthCheckers.set(name, checker);
    logger.debug("Health check registered", { name });
  }

  /**
   * 注册就绪检查器
   */
  registerReadinessCheck(name: string, checker: ReadinessChecker): void {
    this.readinessCheckers.set(name, checker);
    logger.debug("Readiness check registered", { name });
  }

  /**
   * 运行所有健康检查
   */
  async runHealthChecks(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult["checks"] = {};
    let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";

    for (const [name, checker] of this.healthCheckers) {
      try {
        const result = await checker();
        checks[name] = result;

        if (result.status === "fail") {
          overallStatus = "unhealthy";
        } else if (result.status === "warn" && overallStatus !== "unhealthy") {
          overallStatus = "degraded";
        }
      } catch (error: any) {
        checks[name] = {
          status: "fail",
          message: error.message || "Check failed",
        };
        overallStatus = "unhealthy";
      }
    }

    // 更新 Prometheus 指标
    systemHealthy.set(overallStatus === "healthy" ? 1 : 0);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
      checks,
    };
  }

  /**
   * 运行所有就绪检查
   */
  async runReadinessChecks(): Promise<ReadinessCheckResult> {
    const checks: ReadinessCheckResult["checks"] = {};
    let allReady = true;

    for (const [name, checker] of this.readinessCheckers) {
      try {
        const result = await checker();
        checks[name] = result;

        if (!result.ready) {
          allReady = false;
        }
      } catch (error: any) {
        checks[name] = {
          ready: false,
          message: error.message || "Check failed",
        };
        allReady = false;
      }
    }

    return {
      ready: allReady,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * 获取运行时间
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

// 单例实例
export const healthService = new HealthCheckService();

// ============================================================
// 默认健康检查器
// ============================================================

/**
 * 创建 Supabase 健康检查器
 */
export function createSupabaseHealthChecker(supabaseAdmin: any): HealthChecker {
  return async () => {
    if (!supabaseAdmin) {
      return { status: "fail", message: "Supabase not configured" };
    }

    const start = Date.now();
    try {
      const { error } = await supabaseAdmin.from("orders").select("id").limit(1);
      const latency = Date.now() - start;

      if (error) {
        return { status: "fail", message: error.message, latency };
      }

      if (latency > 1000) {
        return { status: "warn", message: "High latency", latency };
      }

      return { status: "pass", latency };
    } catch (error: any) {
      return { status: "fail", message: error.message, latency: Date.now() - start };
    }
  };
}

/**
 * 创建 Redis 健康检查器
 */
export function createRedisHealthChecker(redisClient: any): HealthChecker {
  return async () => {
    if (!redisClient) {
      return { status: "warn", message: "Redis not configured" };
    }

    const start = Date.now();
    try {
      await redisClient.ping();
      const latency = Date.now() - start;

      if (latency > 100) {
        return { status: "warn", message: "High latency", latency };
      }

      return { status: "pass", latency };
    } catch (error: any) {
      return { status: "fail", message: error.message, latency: Date.now() - start };
    }
  };
}

/**
 * 创建 RPC 健康检查器
 */
export function createRpcHealthChecker(provider: any): HealthChecker {
  return async () => {
    if (!provider) {
      return { status: "warn", message: "RPC provider not configured" };
    }

    const start = Date.now();
    try {
      await provider.getBlockNumber();
      const latency = Date.now() - start;

      if (latency > 2000) {
        return { status: "warn", message: "High latency", latency };
      }

      return { status: "pass", latency };
    } catch (error: any) {
      return { status: "fail", message: error.message, latency: Date.now() - start };
    }
  };
}

/**
 * 创建撮合引擎健康检查器
 */
export function createMatchingEngineHealthChecker(engine: any): HealthChecker {
  return async () => {
    if (!engine) {
      return { status: "fail", message: "Matching engine not initialized" };
    }

    try {
      // 检查引擎是否可以响应
      const stats = engine.getSettlementStats?.();
      return { status: "pass", message: `Active markets: ${Object.keys(stats || {}).length}` };
    } catch (error: any) {
      return { status: "fail", message: error.message };
    }
  };
}

/**
 * 创建订单簿恢复就绪检查器
 */
export function createOrderbookReadinessChecker(engine: any): ReadinessChecker {
  return async () => {
    if (!engine) {
      return { ready: false, message: "Matching engine not initialized" };
    }

    // 检查订单簿是否已从数据库恢复
    // 这里假设引擎有一个 isReady 标志
    const isReady = engine.isReady !== false;
    return { ready: isReady, message: isReady ? "Orderbook recovered" : "Orderbook recovering" };
  };
}

export function createWriteProxyReadinessChecker(opts: {
  isClusterActive: () => boolean;
  isLeader: () => boolean;
  getProxyUrl: () => string;
}): ReadinessChecker {
  return async () => {
    if (!opts.isClusterActive()) return { ready: true, message: "Cluster disabled" };
    if (opts.isLeader()) return { ready: true, message: "Leader" };
    const proxyUrl = String(opts.getProxyUrl() || "").trim();
    if (!proxyUrl) return { ready: false, message: "Follower without proxy URL" };
    return { ready: true, message: "Follower with proxy URL" };
  };
}
