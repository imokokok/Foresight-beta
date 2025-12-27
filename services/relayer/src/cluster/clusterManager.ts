/**
 * 集群管理器
 * 协调 Leader Election、Pub/Sub 和集群状态
 */

import { EventEmitter } from "events";
import { LeaderElection, getLeaderElection, LeaderElectionConfig } from "./leaderElection.js";
import { RedisPubSub, getPubSub, CHANNELS, PubSubMessage } from "./pubsub.js";
import { logger } from "../monitoring/logger.js";
import { Gauge } from "prom-client";
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
    const random = Math.random().toString(36).substr(2, 6);
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

    // 初始化 Pub/Sub
    if (this.config.enablePubSub) {
      this.pubsub = getPubSub({}, this.nodeId);
      await this.pubsub.connect();
      
      // 订阅集群事件
      await this.pubsub.subscribeToClusterEvents((msg) => this.handleClusterMessage(msg));
    }

    // 初始化 Leader Election
    if (this.config.enableLeaderElection) {
      this.leaderElection = getLeaderElection({
        ...this.config.leaderElectionConfig,
        nodeId: this.nodeId,
      });
      
      // 监听 Leader 事件
      this.leaderElection.on("became_leader", () => {
        clusterNodeRole.set({ node_id: this.nodeId }, 1);
        this.emit("became_leader");
        this.broadcastClusterEvent("leader_changed", {
          newLeader: this.nodeId,
        });
      });

      this.leaderElection.on("lost_leadership", () => {
        clusterNodeRole.set({ node_id: this.nodeId }, 0);
        this.emit("lost_leadership");
      });

      await this.leaderElection.start();
    }

    // 启动心跳
    this.startHeartbeat();

    // 广播节点加入
    await this.broadcastClusterEvent("node_joined", {
      nodeId: this.nodeId,
      timestamp: Date.now(),
    });

    // 注册自己
    this.registerNode(this.nodeId, this.isLeader());

    this.isRunning = true;
    logger.info("ClusterManager started", { 
      nodeId: this.nodeId, 
      isLeader: this.isLeader() 
    });
  }

  /**
   * 停止集群管理器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info("Stopping ClusterManager", { nodeId: this.nodeId });

    // 广播节点离开
    await this.broadcastClusterEvent("node_left", {
      nodeId: this.nodeId,
      timestamp: Date.now(),
    });

    // 停止心跳
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // 停止 Leader Election
    if (this.leaderElection) {
      await this.leaderElection.stop();
    }

    // 断开 Pub/Sub
    if (this.pubsub) {
      await this.pubsub.disconnect();
    }

    this.nodes.clear();
    this.isRunning = false;
    
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
        this.emit("leader_changed", payload);
        break;
    }
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
    this.nodes.set(nodeId, {
      nodeId,
      isLeader,
      lastSeen: Date.now(),
    });
    
    clusterNodesTotal.set(this.nodes.size);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      // 发送心跳
      await this.broadcastClusterEvent("heartbeat", {
        nodeId: this.nodeId,
        isLeader: this.isLeader(),
      });

      // 清理过期节点
      const now = Date.now();
      const timeout = 60000; // 60 秒
      
      for (const [nodeId, node] of this.nodes.entries()) {
        if (nodeId !== this.nodeId && now - node.lastSeen > timeout) {
          this.handleNodeLeft({ nodeId });
        }
      }
    }, 15000); // 15 秒
  }

  /**
   * 广播集群事件
   */
  private async broadcastClusterEvent(eventType: string, data: unknown): Promise<void> {
    if (this.pubsub && this.pubsub.isReady()) {
      await this.pubsub.publishClusterEvent(eventType, data);
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

