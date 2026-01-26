/**
 * 集群管理器
 * 协调 Leader Election、Pub/Sub 和集群状态
 */

import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { LeaderElection, getLeaderElection, LeaderElectionConfig } from "./leaderElection.js";
import { RedisPubSub, getPubSub, PubSubMessage } from "./pubsub.js";
import { logger } from "../monitoring/logger.js";
import { Counter, Gauge } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";

// ============================================================
// 指标定义
// ============================================================

const clusterNodesTotal = new Gauge({
  name: "foresight_cluster_nodes_total",
  help: "Total nodes in cluster",
  registers: [metricsRegistry],
});

const clusterNodeRole = new Gauge({
  name: "foresight_cluster_node_role",
  help: "Node role (1=leader, 0=follower)",
  labelNames: ["node_id"] as const,
  registers: [metricsRegistry],
});

const clusterLeaderChangesTotal = new Counter({
  name: "foresight_cluster_leader_changes_total",
  help: "Total leader changes observed",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});

const clusterLeaderKnown = new Gauge({
  name: "foresight_cluster_leader_known",
  help: "Whether a leader is currently known (1/0)",
  registers: [metricsRegistry],
});

const clusterLeaderLastChangedMs = new Gauge({
  name: "foresight_cluster_leader_last_changed_ms",
  help: "Last time leader changed, in unix milliseconds",
  registers: [metricsRegistry],
});

const clusterHeartbeatFailuresTotal = new Counter({
  name: "foresight_cluster_heartbeat_failures_total",
  help: "Total cluster heartbeat loop failures",
  registers: [metricsRegistry],
});

const clusterEventPublishFailuresTotal = new Counter({
  name: "foresight_cluster_event_publish_failures_total",
  help: "Total cluster event publish failures",
  labelNames: ["event_type"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

export interface ClusterConfig {
  nodeId?: string;
  enableLeaderElection?: boolean;
  enablePubSub?: boolean;
  leaderElectionConfig?: Partial<LeaderElectionConfig>;
}

export interface ClusterNode {
  nodeId: string;
  isLeader: boolean;
  lastSeen: number;
  metadata?: Record<string, unknown>;
  consecutiveMissedHeartbeats: number;
}

export type ClusterEventType =
  | "node_joined"
  | "node_left"
  | "leader_changed"
  | "became_leader"
  | "lost_leadership";

// ============================================================
// 集群管理器
// ============================================================

export class ClusterManager extends EventEmitter {
  private leaderElection: LeaderElection | null = null;
  private pubsub: RedisPubSub | null = null;
  private config: ClusterConfig;
  private nodeId: string;
  private nodes: Map<string, ClusterNode> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private currentLeaderId: string | null = null;
  private leaderLastChangedAtMs: number | null = null;

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private async stopLeaderElection(): Promise<void> {
    if (!this.leaderElection) return;
    this.leaderElection.removeListener("became_leader", this.onBecameLeader);
    this.leaderElection.removeListener("lost_leadership", this.onLostLeadership);
    await this.leaderElection.stop();
    this.leaderElection = null;
  }

  private async stopPubSub(): Promise<void> {
    if (!this.pubsub) return;
    await this.pubsub.disconnect();
    this.pubsub = null;
  }

  private readonly onBecameLeader = () => {
    const previousLeader = this.currentLeaderId;
    this.currentLeaderId = this.nodeId;
    clusterLeaderKnown.set(1);
    if (previousLeader !== this.nodeId) {
      clusterLeaderChangesTotal.inc({ source: "became_leader" });
      this.leaderLastChangedAtMs = Date.now();
      clusterLeaderLastChangedMs.set(this.leaderLastChangedAtMs);
      logger.info("Leader changed", {
        previousLeader,
        newLeader: this.nodeId,
        source: "became_leader",
      });
    }

    this.emit("became_leader");
    this.emit("leader_changed", { newLeader: this.nodeId });
    this.registerNode(this.nodeId, true);
    void this.broadcastClusterEvent("leader_changed", {
      newLeader: this.nodeId,
    }).catch((error: any) => {
      logger.warn("Failed to broadcast leader_changed", undefined, error);
    });
  };

  private readonly onLostLeadership = () => {
    const previousLeader = this.currentLeaderId;
    if (this.currentLeaderId === this.nodeId) {
      this.currentLeaderId = null;
      clusterLeaderKnown.set(0);
      clusterLeaderChangesTotal.inc({ source: "lost_leadership" });
      this.leaderLastChangedAtMs = Date.now();
      clusterLeaderLastChangedMs.set(this.leaderLastChangedAtMs);
      logger.warn("Leadership lost", { previousLeader, source: "lost_leadership" });
    }

    this.emit("lost_leadership");
    this.registerNode(this.nodeId, false);
  };

  constructor(config: ClusterConfig = {}) {
    super();

    this.config = {
      enableLeaderElection: config.enableLeaderElection ?? true,
      enablePubSub: config.enablePubSub ?? true,
      leaderElectionConfig: config.leaderElectionConfig || {},
    };

    this.nodeId = config.nodeId || this.generateNodeId();
  }

  private generateNodeId(): string {
    const hostname = process.env.HOSTNAME || process.env.POD_NAME || "local";
    const pid = process.pid;
    const random = randomUUID().slice(0, 8);
    return `${hostname}-${pid}-${random}`;
  }

  /**
   * 启动集群管理器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("ClusterManager already running");
      return;
    }

    logger.info("Starting ClusterManager", { nodeId: this.nodeId });

    this.isRunning = true;
    try {
      if (this.config.enablePubSub) {
        this.pubsub = getPubSub({}, this.nodeId);
        await this.pubsub.connect();
        await this.pubsub.subscribeToClusterEvents((msg) => this.handleClusterMessage(msg));
      }

      if (this.config.enableLeaderElection) {
        this.leaderElection = getLeaderElection({
          ...this.config.leaderElectionConfig,
          nodeId: this.nodeId,
        });

        this.leaderElection.on("became_leader", this.onBecameLeader);
        this.leaderElection.on("lost_leadership", this.onLostLeadership);

        await this.leaderElection.start();
      }

      this.startHeartbeat();

      await this.broadcastClusterEvent("node_joined", {
        nodeId: this.nodeId,
        timestamp: Date.now(),
      });

      this.registerNode(this.nodeId, this.isLeader());
      if (this.isLeader()) {
        this.currentLeaderId = this.nodeId;
        clusterLeaderKnown.set(1);
      } else {
        clusterLeaderKnown.set(this.currentLeaderId ? 1 : 0);
      }

      logger.info("ClusterManager started", {
        nodeId: this.nodeId,
        isLeader: this.isLeader(),
      });
    } catch (error: any) {
      this.isRunning = false;

      this.stopHeartbeat();
      await this.stopLeaderElection();
      await this.stopPubSub();

      throw error;
    }
  }

  /**
   * 停止集群管理器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info("Stopping ClusterManager", { nodeId: this.nodeId });

    this.isRunning = false;

    try {
      await this.broadcastClusterEvent("node_left", {
        nodeId: this.nodeId,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      logger.warn("Failed to broadcast node_left", undefined, error);
    }

    // 停止心跳
    this.stopHeartbeat();
    await this.stopLeaderElection();
    await this.stopPubSub();

    for (const nodeId of this.nodes.keys()) {
      try {
        clusterNodeRole.remove({ node_id: nodeId });
      } catch {}
    }

    this.nodes.clear();
    clusterNodesTotal.set(0);
    try {
      clusterNodeRole.remove({ node_id: this.nodeId });
    } catch {}

    logger.info("ClusterManager stopped");
  }

  /**
   * 处理集群消息
   */
  private handleClusterMessage(message: PubSubMessage): void {
    const { type, payload, source } = message;

    logger.debug("Received cluster message", { type, source });

    switch (type) {
      case "node_joined":
        this.handleNodeJoined(payload as { nodeId: string });
        break;

      case "node_left":
        this.handleNodeLeft(payload as { nodeId: string });
        break;

      case "heartbeat":
        this.handleHeartbeat(payload as { nodeId: string; isLeader: boolean });
        break;

      case "leader_changed":
        this.handleLeaderChanged(payload as { newLeader?: unknown });
        break;
    }
  }

  private handleLeaderChanged(payload: { newLeader?: unknown }): void {
    const newLeader = typeof payload?.newLeader === "string" ? payload.newLeader : "";
    if (newLeader) {
      const previousLeader = this.currentLeaderId;
      this.currentLeaderId = newLeader;
      clusterLeaderKnown.set(1);
      if (previousLeader !== newLeader) {
        clusterLeaderChangesTotal.inc({ source: "remote" });
        this.leaderLastChangedAtMs = Date.now();
        clusterLeaderLastChangedMs.set(this.leaderLastChangedAtMs);
        logger.info("Leader changed", { previousLeader, newLeader, source: "remote" });
      }

      for (const [nodeId, node] of this.nodes.entries()) {
        const shouldBeLeader = nodeId === newLeader;
        if (node.isLeader !== shouldBeLeader) {
          this.nodes.set(nodeId, { ...node, isLeader: shouldBeLeader, lastSeen: Date.now() });
        }
        clusterNodeRole.set({ node_id: nodeId }, shouldBeLeader ? 1 : 0);
      }
      const existing = this.nodes.get(newLeader);
      if (!existing) {
        this.registerNode(newLeader, true);
      }
    }
    this.emit("leader_changed", payload);
  }

  /**
   * 处理节点加入
   */
  private handleNodeJoined(data: { nodeId: string }): void {
    this.registerNode(data.nodeId, false);
    this.emit("node_joined", data.nodeId);

    logger.info("Node joined cluster", { nodeId: data.nodeId });
  }

  /**
   * 处理节点离开
   */
  private handleNodeLeft(data: { nodeId: string }): void {
    this.nodes.delete(data.nodeId);
    clusterNodesTotal.set(this.nodes.size);
    try {
      clusterNodeRole.remove({ node_id: data.nodeId });
    } catch {}

    this.emit("node_left", data.nodeId);

    logger.info("Node left cluster", { nodeId: data.nodeId });
  }

  /**
   * 处理心跳
   */
  private handleHeartbeat(data: { nodeId: string; isLeader: boolean }): void {
    this.registerNode(data.nodeId, data.isLeader);
  }

  /**
   * 注册节点
   */
  private registerNode(nodeId: string, isLeader: boolean): void {
    const existing = this.nodes.get(nodeId);
    this.nodes.set(nodeId, {
      nodeId,
      isLeader,
      lastSeen: Date.now(),
      consecutiveMissedHeartbeats: 0,
    });

    clusterNodesTotal.set(this.nodes.size);
    clusterNodeRole.set({ node_id: nodeId }, isLeader ? 1 : 0);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    const heartbeatInterval = 15000;
    const missedThreshold = 3;

    this.heartbeatTimer = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.broadcastClusterEvent("heartbeat", {
          nodeId: this.nodeId,
          isLeader: this.isLeader(),
        });

        const now = Date.now();

        for (const [nodeId, node] of this.nodes.entries()) {
          if (nodeId === this.nodeId) continue;

          const timeSinceLastSeen = now - node.lastSeen;

          if (timeSinceLastSeen > heartbeatInterval * missedThreshold) {
            logger.warn("Node missed multiple heartbeats, removing", {
              nodeId,
              lastSeen: node.lastSeen,
              consecutiveMissed: node.consecutiveMissedHeartbeats + 1,
            });
            this.handleNodeLeft({ nodeId });
          } else if (timeSinceLastSeen > heartbeatInterval * 1.5) {
            node.consecutiveMissedHeartbeats++;
            if (node.consecutiveMissedHeartbeats >= missedThreshold) {
              logger.warn("Node missed consecutive heartbeats, removing", {
                nodeId,
                lastSeen: node.lastSeen,
                consecutiveMissed: node.consecutiveMissedHeartbeats,
              });
              this.handleNodeLeft({ nodeId });
            }
          }
        }
      } catch (error: any) {
        clusterHeartbeatFailuresTotal.inc();
        logger.warn("Cluster heartbeat failed", undefined, error);
      }
    }, 15000); // 15 秒
  }

  /**
   * 广播集群事件
   */
  private async broadcastClusterEvent(eventType: string, data: unknown): Promise<void> {
    if (this.pubsub && this.pubsub.isReady()) {
      try {
        await this.pubsub.publishClusterEvent(eventType, data);
      } catch (e) {
        const error = e as Error;
        clusterEventPublishFailuresTotal.inc({ event_type: eventType });
        throw error;
      }
    }
  }

  /**
   * 检查当前节点是否是 Leader
   */
  isLeader(): boolean {
    return this.leaderElection?.isCurrentLeader() ?? false;
  }

  /**
   * 获取当前 Leader 节点 ID
   */
  async getLeaderId(): Promise<string | null> {
    if (!this.leaderElection) return null;
    const leader = await this.leaderElection.getCurrentLeader();
    return leader?.nodeId ?? null;
  }

  getKnownLeaderId(): string | null {
    return this.currentLeaderId;
  }

  isLeaderKnown(): boolean {
    return !!this.currentLeaderId;
  }

  getLeaderLastChangedMs(): number | null {
    return this.leaderLastChangedAtMs;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取所有节点
   */
  getNodes(): ClusterNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取节点数量
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * 获取节点 ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * 获取 Pub/Sub 实例
   */
  getPubSub(): RedisPubSub | null {
    return this.pubsub;
  }

  /**
   * 获取 Leader Election 实例
   */
  getLeaderElection(): LeaderElection | null {
    return this.leaderElection;
  }

  /**
   * 仅在 Leader 节点执行
   */
  async executeAsLeader<T>(fn: () => Promise<T>): Promise<T | null> {
    if (!this.isLeader()) {
      logger.debug("Not leader, skipping execution");
      return null;
    }
    return fn();
  }

  /**
   * 等待成为 Leader
   */
  async waitForLeadership(timeoutMs: number = 60000): Promise<boolean> {
    if (!this.leaderElection) return false;
    return this.leaderElection.waitForLeadership(timeoutMs);
  }
}

// ============================================================
// 单例
// ============================================================

let clusterManagerInstance: ClusterManager | null = null;

export function getClusterManager(config?: ClusterConfig): ClusterManager {
  if (!clusterManagerInstance) {
    clusterManagerInstance = new ClusterManager(config);
  }
  return clusterManagerInstance;
}

export async function initClusterManager(config?: ClusterConfig): Promise<ClusterManager> {
  const manager = getClusterManager(config);
  await manager.start();
  return manager;
}

export async function closeClusterManager(): Promise<void> {
  if (clusterManagerInstance) {
    await clusterManagerInstance.stop();
    clusterManagerInstance = null;
  }
}
