/**
 * 集群管理 API 路由
 */

import { Router, Request, Response } from "express";
import { logger } from "../monitoring/logger.js";

const router = Router();

// 延迟导入以避免循环依赖
let clusterManager: any = null;
let chainReconciler: any = null;
let databasePool: any = null;

const getClusterManager = async () => {
  if (!clusterManager) {
    const { getClusterManager: getCM } = await import("../cluster/clusterManager.js");
    clusterManager = getCM();
  }
  return clusterManager;
};

const getChainReconciler = async () => {
  if (!chainReconciler) {
    const { getChainReconciler: getCR } = await import("../reconciliation/chainReconciler.js");
    chainReconciler = getCR();
  }
  return chainReconciler;
};

const getDatabasePool = async () => {
  if (!databasePool) {
    const { getDatabasePool: getDP } = await import("../database/connectionPool.js");
    databasePool = getDP();
  }
  return databasePool;
};

// ============================================================
// 集群状态
// ============================================================

/**
 * GET /cluster/status - 获取集群状态
 */
router.get("/cluster/status", async (req: Request, res: Response) => {
  try {
    const cm = await getClusterManager();
    
    res.json({
      nodeId: cm.getNodeId(),
      isLeader: cm.isLeader(),
      leaderId: await cm.getLeaderId(),
      nodes: cm.getNodes(),
      nodeCount: cm.getNodeCount(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Failed to get cluster status", {}, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /cluster/leader - 获取当前 Leader 信息
 */
router.get("/cluster/leader", async (req: Request, res: Response) => {
  try {
    const cm = await getClusterManager();
    const election = cm.getLeaderElection();
    
    if (!election) {
      res.json({ leader: null, message: "Leader election not enabled" });
      return;
    }

    const leader = await election.getCurrentLeader();
    
    res.json({
      leader,
      isCurrentNodeLeader: cm.isLeader(),
      currentNodeId: cm.getNodeId(),
    });
  } catch (error: any) {
    logger.error("Failed to get leader info", {}, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /cluster/nodes - 获取所有节点
 */
router.get("/cluster/nodes", async (req: Request, res: Response) => {
  try {
    const cm = await getClusterManager();
    
    res.json({
      nodes: cm.getNodes(),
      count: cm.getNodeCount(),
      currentNodeId: cm.getNodeId(),
    });
  } catch (error: any) {
    logger.error("Failed to get cluster nodes", {}, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 数据库状态
// ============================================================

/**
 * GET /database/status - 获取数据库连接状态
 */
router.get("/database/status", async (req: Request, res: Response) => {
  try {
    const pool = await getDatabasePool();
    const stats = pool.getStats();
    
    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Failed to get database status", {}, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 对账状态
// ============================================================

/**
 * GET /reconciliation/status - 获取对账状态
 */
router.get("/reconciliation/status", async (req: Request, res: Response) => {
  try {
    const reconciler = await getChainReconciler();
    const status = reconciler.getStatus();
    
    res.json({
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Failed to get reconciliation status", {}, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /reconciliation/discrepancies - 获取差异列表
 */
router.get("/reconciliation/discrepancies", async (req: Request, res: Response) => {
  try {
    const reconciler = await getChainReconciler();
    const onlyUnresolved = req.query.unresolved === "true";
    
    const discrepancies = onlyUnresolved 
      ? reconciler.getUnresolvedDiscrepancies()
      : reconciler.getDiscrepancies();
    
    res.json({
      discrepancies,
      count: discrepancies.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Failed to get discrepancies", {}, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /reconciliation/trigger - 手动触发对账
 */
router.post("/reconciliation/trigger", async (req: Request, res: Response) => {
  try {
    const reconciler = await getChainReconciler();
    
    // 异步运行对账，立即返回
    reconciler.triggerReconciliation().catch((err: any) => {
      logger.error("Triggered reconciliation failed", {}, err);
    });
    
    res.json({
      message: "Reconciliation triggered",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Failed to trigger reconciliation", {}, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /reconciliation/resolve/:id - 解决差异
 */
router.post("/reconciliation/resolve/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    
    if (!resolution) {
      res.status(400).json({ error: "Resolution is required" });
      return;
    }

    const reconciler = await getChainReconciler();
    const resolved = reconciler.resolveDiscrepancy(id, resolution);
    
    if (resolved) {
      res.json({
        message: "Discrepancy resolved",
        discrepancyId: id,
        resolution,
      });
    } else {
      res.status(404).json({ error: "Discrepancy not found" });
    }
  } catch (error: any) {
    logger.error("Failed to resolve discrepancy", {}, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 综合状态端点
// ============================================================

/**
 * GET /admin/overview - 管理概览
 */
router.get("/admin/overview", async (req: Request, res: Response) => {
  try {
    const cm = await getClusterManager();
    const pool = await getDatabasePool();
    const reconciler = await getChainReconciler();
    
    res.json({
      cluster: {
        nodeId: cm.getNodeId(),
        isLeader: cm.isLeader(),
        nodeCount: cm.getNodeCount(),
      },
      database: pool.getStats(),
      reconciliation: reconciler.getStatus(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("Failed to get admin overview", {}, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

