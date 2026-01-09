/**
 * 基于 Redis 的 Leader Election
 * 实现撮合引擎主备切换，确保同一时间只有一个节点处理订单
 */

import { EventEmitter } from "events";
import { getRedisClient, RedisClient } from "../redis/client.js";
import { logger } from "../monitoring/logger.js";
import { Gauge, Counter } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";

// ============================================================
// 指标定义
// ============================================================

const leaderStatus = new Gauge({
  name: "foresight_leader_status",
  help: "Leader status (1=leader, 0=follower)",
  labelNames: ["node_id"] as const,
  registers: [metricsRegistry],
});

const leaderElectionTotal = new Counter({
  name: "foresight_leader_election_total",
  help: "Total leader elections",
  labelNames: ["result"] as const, // acquired, lost, failed
  registers: [metricsRegistry],
});

const leaderHeartbeatLatency = new Gauge({
  name: "foresight_leader_heartbeat_latency_ms",
  help: "Leader heartbeat latency in milliseconds",
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

export interface LeaderElectionConfig {
  /** 锁的 key 名称 */
  lockKey: string;
  /** 锁的 TTL (毫秒) */
  lockTtlMs: number;
  /** 续约间隔 (毫秒)，应该小于 lockTtlMs */
  renewIntervalMs: number;
  /** 重试获取锁的间隔 (毫秒) */
  retryIntervalMs: number;
  /** 节点 ID */
  nodeId: string;
}

export interface LeaderInfo {
  nodeId: string;
  acquiredAt: number;
  lastRenewedAt: number;
}

type LeaderEventType = "became_leader" | "lost_leadership" | "leader_changed";

// ============================================================
// Leader Election 实现
// ============================================================

export class LeaderElection extends EventEmitter {
  private redis: RedisClient;
  private config: LeaderElectionConfig;
  private isLeader: boolean = false;
  private leaderInfo: LeaderInfo | null = null;
  private lockToken: string | null = null;

  private renewTimer: NodeJS.Timeout | null = null;
  private watchTimer: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(config: Partial<LeaderElectionConfig> = {}) {
    super();
    this.redis = getRedisClient();

    this.config = {
      lockKey: config.lockKey || "foresight:leader:matching-engine",
      lockTtlMs: config.lockTtlMs || 30000, // 30 秒
      renewIntervalMs: config.renewIntervalMs || 10000, // 10 秒
      retryIntervalMs: config.retryIntervalMs || 5000, // 5 秒
      nodeId: config.nodeId || this.generateNodeId(),
    };

    logger.info("LeaderElection initialized", {
      nodeId: this.config.nodeId,
      lockKey: this.config.lockKey,
      lockTtlMs: this.config.lockTtlMs,
    });
  }

  /**
   * 生成唯一节点 ID
   */
  private generateNodeId(): string {
    const hostname = process.env.HOSTNAME || process.env.POD_NAME || "local";
    const pid = process.pid;
    const random = Math.random().toString(36).substr(2, 8);
    return `${hostname}-${pid}-${random}`;
  }

  private getBaseLockKey(): string {
    return this.config.lockKey.replace("foresight:", "");
  }

  private getLeaderOwnerKey(): string {
    return `${this.getBaseLockKey()}:owner`;
  }

  /**
   * 启动 Leader Election
   */
  async start(): Promise<void> {
    if (!this.redis.isReady()) {
      logger.warn("Redis not ready, attempting to connect...");
      const connected = await this.redis.connect();
      if (!connected) {
        logger.error("Failed to connect to Redis, leader election disabled");
        return;
      }
    }

    logger.info("Starting leader election", { nodeId: this.config.nodeId });

    // 尝试获取 Leader
    await this.tryAcquireLeadership();

    // 启动监视循环
    this.startWatchLoop();
  }

  /**
   * 停止 Leader Election
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;

    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }

    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }

    // 如果是 Leader，释放锁
    if (this.isLeader) {
      await this.releaseLock();
    }
    this.isLeader = false;
    this.leaderInfo = null;
    leaderStatus.set({ node_id: this.config.nodeId }, 0);

    logger.info("Leader election stopped", { nodeId: this.config.nodeId });
  }

  /**
   * 尝试获取 Leadership
   */
  private async tryAcquireLeadership(): Promise<boolean> {
    if (this.isShuttingDown) return false;

    try {
      const now = Date.now();
      const info = {
        nodeId: this.config.nodeId,
        acquiredAt: now,
        lastRenewedAt: now,
      } as LeaderInfo;

      const token = await this.redis.acquireLock(
        this.getBaseLockKey(),
        this.config.lockTtlMs,
        0,
        0
      );
      if (token) {
        this.lockToken = token;
        await this.redis.set(
          this.getLeaderOwnerKey(),
          JSON.stringify(info),
          Math.ceil(this.config.lockTtlMs / 1000)
        );
        this.becomeLeader(info);
        return true;
      }

      this.isLeader = false;
      leaderStatus.set({ node_id: this.config.nodeId }, 0);
      return false;
    } catch (error: any) {
      logger.error("Failed to acquire leadership", { error: error.message });
      leaderElectionTotal.inc({ result: "failed" });
      return false;
    }
  }

  /**
   * 成为 Leader
   */
  private becomeLeader(info: LeaderInfo): void {
    const wasLeader = this.isLeader;
    this.isLeader = true;
    this.leaderInfo = info;

    leaderStatus.set({ node_id: this.config.nodeId }, 1);

    if (!wasLeader) {
      leaderElectionTotal.inc({ result: "acquired" });
      logger.info("Became leader", { nodeId: this.config.nodeId });
      this.emit("became_leader", info);

      // 启动续约定时器
      this.startRenewLoop();
    }
  }

  /**
   * 失去 Leadership
   */
  private loseLeadership(): void {
    if (!this.isLeader) return;

    this.isLeader = false;
    this.leaderInfo = null;
    this.lockToken = null;

    leaderStatus.set({ node_id: this.config.nodeId }, 0);
    leaderElectionTotal.inc({ result: "lost" });

    logger.warn("Lost leadership", { nodeId: this.config.nodeId });
    this.emit("lost_leadership");

    // 停止续约定时器
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }
  }

  /**
   * 启动续约循环
   */
  private startRenewLoop(): void {
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
    }

    this.renewTimer = setInterval(async () => {
      if (!this.isLeader || this.isShuttingDown) return;

      const start = Date.now();
      const success = await this.renewLock();
      const latency = Date.now() - start;

      leaderHeartbeatLatency.set(latency);

      if (!success) {
        this.loseLeadership();
      }
    }, this.config.renewIntervalMs);
  }

  /**
   * 续约锁
   */
  private async renewLock(): Promise<boolean> {
    try {
      if (!this.lockToken) return false;
      const ok = await this.redis.refreshLock(
        this.getBaseLockKey(),
        this.lockToken,
        this.config.lockTtlMs
      );
      if (!ok) return false;

      const now = Date.now();
      const info: LeaderInfo = {
        nodeId: this.config.nodeId,
        acquiredAt: this.leaderInfo?.acquiredAt ?? now,
        lastRenewedAt: now,
      };

      await this.redis.set(
        this.getLeaderOwnerKey(),
        JSON.stringify(info),
        Math.ceil(this.config.lockTtlMs / 1000)
      );

      this.leaderInfo = info;
      logger.debug("Lock renewed", { nodeId: this.config.nodeId });
      return true;
    } catch (error: any) {
      logger.error("Failed to renew lock", { error: error.message });
      return false;
    }
  }

  /**
   * 释放锁
   */
  private async releaseLock(): Promise<void> {
    try {
      if (!this.lockToken) return;
      const released = await this.redis.releaseLock(this.getBaseLockKey(), this.lockToken);
      if (released) {
        await this.redis.del(this.getLeaderOwnerKey());
        logger.info("Lock released", { nodeId: this.config.nodeId });
      }
      this.lockToken = null;
    } catch (error: any) {
      logger.error("Failed to release lock", { error: error.message });
    }
  }

  /**
   * 启动监视循环 (Follower 定期检查 Leader 状态)
   */
  private startWatchLoop(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
    }

    this.watchTimer = setInterval(async () => {
      if (this.isShuttingDown) return;

      if (!this.isLeader) {
        // Follower 尝试获取 Leadership
        await this.tryAcquireLeadership();
      }
    }, this.config.retryIntervalMs);
  }

  /**
   * 获取当前 Leader 信息
   */
  async getCurrentLeader(): Promise<LeaderInfo | null> {
    try {
      const value = await this.redis.get(this.getLeaderOwnerKey());
      if (value) {
        return JSON.parse(value) as LeaderInfo;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 检查当前节点是否是 Leader
   */
  isCurrentLeader(): boolean {
    return this.isLeader;
  }

  /**
   * 获取节点 ID
   */
  getNodeId(): string {
    return this.config.nodeId;
  }

  /**
   * 等待成为 Leader (用于启动时阻塞)
   */
  async waitForLeadership(timeoutMs: number = 60000): Promise<boolean> {
    if (this.isLeader) return true;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeListener("became_leader", onLeader);
        resolve(false);
      }, timeoutMs);

      const onLeader = () => {
        clearTimeout(timeout);
        resolve(true);
      };

      this.once("became_leader", onLeader);
    });
  }
}

// ============================================================
// 单例
// ============================================================

let leaderElectionInstance: LeaderElection | null = null;

export function getLeaderElection(config?: Partial<LeaderElectionConfig>): LeaderElection {
  if (!leaderElectionInstance) {
    leaderElectionInstance = new LeaderElection(config);
  }
  return leaderElectionInstance;
}

export async function initLeaderElection(
  config?: Partial<LeaderElectionConfig>
): Promise<LeaderElection> {
  const election = getLeaderElection(config);
  await election.start();
  return election;
}
