/**
 * 数据库连接池管理
 * 支持读写分离、连接池、故障转移
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../monitoring/logger.js";
import { Gauge, Counter, Histogram } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";

// ============================================================
// 指标定义
// ============================================================

const dbConnectionsActive = new Gauge({
  name: "foresight_db_connections_active",
  help: "Active database connections",
  labelNames: ["pool", "type"] as const, // pool: primary/replica, type: read/write
  registers: [metricsRegistry],
});

const dbQueriesTotal = new Counter({
  name: "foresight_db_queries_total",
  help: "Total database queries",
  labelNames: ["pool", "operation", "status"] as const,
  registers: [metricsRegistry],
});

const dbQueryLatency = new Histogram({
  name: "foresight_db_query_latency_ms",
  help: "Database query latency in milliseconds",
  labelNames: ["pool", "operation"] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [metricsRegistry],
});

const dbReplicaHealth = new Gauge({
  name: "foresight_db_replica_health",
  help: "Replica health status (1=healthy, 0=unhealthy)",
  labelNames: ["replica"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

export interface DatabaseConfig {
  primary: {
    url: string;
    serviceKey: string;
  };
  replicas?: Array<{
    url: string;
    serviceKey: string;
    name: string;
    weight?: number; // 负载均衡权重
  }>;
  options?: {
    maxConnections?: number;
    idleTimeout?: number;
    healthCheckInterval?: number;
    failoverThreshold?: number; // 连续失败次数阈值
  };
}

interface ReplicaState {
  client: SupabaseClient;
  name: string;
  weight: number;
  healthy: boolean;
  failureCount: number;
  lastHealthCheck: number;
}

// ============================================================// 数据库连接池// ============================================================

export class DatabasePool {
  private primaryClient: SupabaseClient | null = null;
  private replicas: ReplicaState[] = [];
  private currentReplicaIndex: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private config: DatabaseConfig;
  private isInitialized: boolean = false;

  // 主库健康状态
  private primaryHealthy: boolean = true;
  private primaryFailureCount: number = 0;
  private lastPrimaryHealthCheck: number = Date.now();

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      primary: {
        url: config?.primary?.url || process.env.SUPABASE_URL || "",
        serviceKey: config?.primary?.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      },
      replicas: config?.replicas || this.getReplicasFromEnv(),
      options: {
        maxConnections: config?.options?.maxConnections || 20,
        idleTimeout: config?.options?.idleTimeout || 10000,
        healthCheckInterval: config?.options?.healthCheckInterval || 30000,
        failoverThreshold: config?.options?.failoverThreshold || 3,
      },
    };
  }

  /**
   * 从环境变量获取副本配置
   */
  private getReplicasFromEnv(): DatabaseConfig["replicas"] {
    const replicas: DatabaseConfig["replicas"] = [];

    // 支持 SUPABASE_REPLICA_1_URL, SUPABASE_REPLICA_1_KEY 格式
    for (let i = 1; i <= 5; i++) {
      const url = process.env[`SUPABASE_REPLICA_${i}_URL`];
      const key = process.env[`SUPABASE_REPLICA_${i}_KEY`];
      const weight = parseInt(process.env[`SUPABASE_REPLICA_${i}_WEIGHT`] || "1", 10);

      if (url && key) {
        replicas.push({
          url,
          serviceKey: key,
          name: `replica-${i}`,
          weight,
        });
      }
    }

    return replicas;
  }

  /**
   * 初始化连接池
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // 初始化主库连接
      if (this.config.primary.url && this.config.primary.serviceKey) {
        this.primaryClient = createClient(this.config.primary.url, this.config.primary.serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // 测试主库连接
        const { error } = await this.primaryClient
          .from("markets")
          .select("count")
          .limit(1)
          .single();
        if (error && !error.message.includes("No rows")) {
          logger.warn("Primary database connection test failed", undefined, error);
        } else {
          logger.info("Primary database connected");
          dbConnectionsActive.set({ pool: "primary", type: "write" }, 1);
        }
      } else {
        logger.warn("Primary database config missing");
        return false;
      }

      // 初始化副本连接
      if (this.config.replicas && this.config.replicas.length > 0) {
        for (const replica of this.config.replicas) {
          const client = createClient(replica.url, replica.serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          this.replicas.push({
            client,
            name: replica.name,
            weight: replica.weight || 1,
            healthy: true,
            failureCount: 0,
            lastHealthCheck: Date.now(),
          });

          dbReplicaHealth.set({ replica: replica.name }, 1);
        }

        logger.info("Replicas initialized", { count: this.replicas.length });
        dbConnectionsActive.set({ pool: "replica", type: "read" }, this.replicas.length);
      } else {
        logger.info("No replicas configured, read queries will use primary");
      }

      // 启动健康检查
      this.startHealthCheck();

      this.isInitialized = true;
      return true;
    } catch (error: any) {
      logger.error("Database pool initialization failed", {}, error);
      return false;
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        // 同时检查主库和副本健康状态
        await Promise.all([this.checkPrimaryHealth(), this.checkReplicaHealth()]);
      } catch (error: any) {
        logger.warn("Health check tick failed", undefined, error);
      }
    }, this.config.options?.healthCheckInterval || 30000);
  }

  /**
   * 检查副本健康状态
   */
  private async checkReplicaHealth(): Promise<void> {
    for (const replica of this.replicas) {
      try {
        const start = Date.now();
        const { error } = await replica.client.from("markets").select("count").limit(1).single();
        const latency = Date.now() - start;

        if (error && !error.message.includes("No rows")) {
          this.markReplicaUnhealthy(replica, error.message);
        } else {
          this.markReplicaHealthy(replica);
          dbQueryLatency.observe({ pool: replica.name, operation: "health_check" }, latency);
        }
      } catch (error: any) {
        this.markReplicaUnhealthy(replica, error.message);
      }
    }
  }

  /**
   * 检查主库健康状态
   */
  private async checkPrimaryHealth(): Promise<void> {
    if (!this.primaryClient) return;

    try {
      const start = Date.now();
      const { error } = await this.primaryClient.from("markets").select("count").limit(1).single();
      const latency = Date.now() - start;

      if (error && !error.message.includes("No rows")) {
        this.markPrimaryUnhealthy(error.message);
      } else {
        this.markPrimaryHealthy();
        dbQueryLatency.observe({ pool: "primary", operation: "health_check" }, latency);
      }
    } catch (error: any) {
      this.markPrimaryUnhealthy(error.message);
    }
  }

  /**
   * 标记主库为不健康
   */
  private markPrimaryUnhealthy(reason: string): void {
    this.primaryFailureCount++;
    this.lastPrimaryHealthCheck = Date.now();

    if (this.primaryHealthy) {
      this.primaryHealthy = false;
      dbConnectionsActive.set({ pool: "primary", type: "write" }, 0);
      logger.warn("Primary database marked unhealthy", {
        reason,
        failureCount: this.primaryFailureCount,
      });
    }
  }

  /**
   * 标记主库为健康
   */
  private markPrimaryHealthy(): void {
    if (!this.primaryHealthy) {
      logger.info("Primary database recovered");
    }
    this.primaryHealthy = true;
    this.primaryFailureCount = 0;
    this.lastPrimaryHealthCheck = Date.now();
    dbConnectionsActive.set({ pool: "primary", type: "write" }, 1);
  }

  /**
   * 标记副本为不健康
   */
  private markReplicaUnhealthy(replica: ReplicaState, reason: string): void {
    replica.failureCount++;
    replica.lastHealthCheck = Date.now();

    if (replica.failureCount >= (this.config.options?.failoverThreshold || 3)) {
      if (replica.healthy) {
        replica.healthy = false;
        dbReplicaHealth.set({ replica: replica.name }, 0);
        logger.warn("Replica marked unhealthy", {
          replica: replica.name,
          reason,
          failureCount: replica.failureCount,
        });
      }
    }
  }

  /**
   * 标记副本为健康
   */
  private markReplicaHealthy(replica: ReplicaState): void {
    if (!replica.healthy) {
      logger.info("Replica recovered", { replica: replica.name });
    }
    replica.healthy = true;
    replica.failureCount = 0;
    replica.lastHealthCheck = Date.now();
    dbReplicaHealth.set({ replica: replica.name }, 1);
  }

  /**
   * 获取写入连接 (主库)
   */
  getWriteClient(): SupabaseClient | null {
    if (!this.primaryHealthy) {
      logger.debug("Primary database is unhealthy, write operations may fail");
    }
    return this.primaryClient;
  }

  /**
   * 获取读取连接 (副本或主库)
   * 使用加权轮询策略
   */
  getReadClient(): SupabaseClient | null {
    // 获取健康的副本
    const healthyReplicas = this.replicas.filter((r) => r.healthy);

    if (healthyReplicas.length === 0) {
      // 没有健康副本,回退到主库
      logger.debug("No healthy replicas, falling back to primary");
      return this.primaryClient;
    }

    // 加权轮询选择
    const totalWeight = healthyReplicas.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;

    for (const replica of healthyReplicas) {
      random -= replica.weight;
      if (random <= 0) {
        return replica.client;
      }
    }

    // 默认返回第一个健康副本
    return healthyReplicas[0].client;
  }

  /**
   * 执行读取查询
   */
  async executeRead<T>(
    operation: string,
    queryFn: (client: SupabaseClient) => Promise<T>,
    retryOptions?: { maxRetries?: number; delayMs?: number }
  ): Promise<T> {
    const maxRetries = retryOptions?.maxRetries || 3;
    const delayMs = retryOptions?.delayMs || 100;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const client = this.getReadClient();
      if (!client) {
        throw new Error("No database connection available");
      }

      const pool =
        this.replicas.length > 0 && this.replicas.some((r) => r.healthy) ? "replica" : "primary";
      const start = Date.now();

      try {
        const result = await queryFn(client);
        dbQueriesTotal.inc({ pool, operation, status: "success" });
        dbQueryLatency.observe({ pool, operation }, Date.now() - start);

        // 如果是重试成功，记录恢复事件
        if (attempt > 0) {
          logger.info(`Database read operation recovered after ${attempt} retries`, {
            operation,
            pool,
            attempt,
          });
        }

        return result;
      } catch (error: any) {
        dbQueriesTotal.inc({ pool, operation, status: "error" });
        dbQueryLatency.observe({ pool, operation }, Date.now() - start);

        lastError = error;

        // 如果是最后一次尝试，抛出错误
        if (attempt >= maxRetries) {
          logger.error(`Database read operation failed after ${maxRetries} retries`, {
            operation,
            pool,
            error: error.message,
          });
          throw error;
        }

        // 记录重试事件
        logger.warn(`Database read operation failed, retrying (${attempt + 1}/${maxRetries})`, {
          operation,
          pool,
          error: error.message,
        });

        // 指数退避延迟
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }

    // 理论上不会到这里，但为了类型安全
    throw lastError || new Error("Database operation failed");
  }

  /**
   * 执行写入查询
   */
  async executeWrite<T>(
    operation: string,
    queryFn: (client: SupabaseClient) => Promise<T>,
    retryOptions?: { maxRetries?: number; delayMs?: number }
  ): Promise<T> {
    const maxRetries = retryOptions?.maxRetries || 3;
    const delayMs = retryOptions?.delayMs || 100;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const client = this.getWriteClient();
      if (!client) {
        throw new Error("No primary database connection available");
      }

      const start = Date.now();

      try {
        const result = await queryFn(client);
        dbQueriesTotal.inc({ pool: "primary", operation, status: "success" });
        dbQueryLatency.observe({ pool: "primary", operation }, Date.now() - start);

        // 如果是重试成功，记录恢复事件
        if (attempt > 0) {
          logger.info(`Database write operation recovered after ${attempt} retries`, {
            operation,
            pool: "primary",
            attempt,
          });
        }

        return result;
      } catch (error: any) {
        dbQueriesTotal.inc({ pool: "primary", operation, status: "error" });
        dbQueryLatency.observe({ pool: "primary", operation }, Date.now() - start);

        lastError = error;

        // 如果是最后一次尝试，抛出错误
        if (attempt >= maxRetries) {
          logger.error(`Database write operation failed after ${maxRetries} retries`, {
            operation,
            pool: "primary",
            error: error.message,
          });
          throw error;
        }

        // 记录重试事件
        logger.warn(`Database write operation failed, retrying (${attempt + 1}/${maxRetries})`, {
          operation,
          pool: "primary",
          error: error.message,
        });

        // 指数退避延迟
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }

    // 理论上不会到这里，但为了类型安全
    throw lastError || new Error("Database operation failed");
  }

  /**
   * 获取连接池统计
   */
  getStats(): {
    primaryConnected: boolean;
    primaryHealthy: boolean;
    primaryFailureCount: number;
    replicaCount: number;
    healthyReplicaCount: number;
    replicas: Array<{ name: string; healthy: boolean; failureCount: number }>;
  } {
    return {
      primaryConnected: this.primaryClient !== null,
      primaryHealthy: this.primaryHealthy,
      primaryFailureCount: this.primaryFailureCount,
      replicaCount: this.replicas.length,
      healthyReplicaCount: this.replicas.filter((r) => r.healthy).length,
      replicas: this.replicas.map((r) => ({
        name: r.name,
        healthy: r.healthy,
        failureCount: r.failureCount,
      })),
    };
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Supabase 客户端不需要显式关闭
    this.primaryClient = null;
    this.replicas = [];
    this.isInitialized = false;

    dbConnectionsActive.set({ pool: "primary", type: "write" }, 0);
    dbConnectionsActive.set({ pool: "replica", type: "read" }, 0);

    logger.info("Database pool closed");
  }
}

// ============================================================
// 单例
// ============================================================

let poolInstance: DatabasePool | null = null;

export function getDatabasePool(config?: Partial<DatabaseConfig>): DatabasePool {
  if (!poolInstance) {
    poolInstance = new DatabasePool(config);
  }
  return poolInstance;
}

export async function initDatabasePool(config?: Partial<DatabaseConfig>): Promise<DatabasePool> {
  const pool = getDatabasePool(config);
  await pool.initialize();
  return pool;
}

export async function closeDatabasePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.close();
    poolInstance = null;
  }
}

// 向后兼容: 导出原始 supabaseAdmin
export function getSupabaseAdmin(): SupabaseClient | null {
  const pool = getDatabasePool();
  return pool.getWriteClient();
}
