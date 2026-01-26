import type express from "express";
import { ethers } from "ethers";
import { CHAIN_ID, RPC_URL } from "../env.js";
import { initRedis, getRedisClient } from "../redis/client.js";
import { getOrderbookSnapshotService } from "../redis/orderbookSnapshot.js";
import { initDatabasePool } from "../database/index.js";
import { initClusterManager, getClusterManager } from "../cluster/index.js";
import { initChainReconciler, closeChainReconciler } from "../reconciliation/index.js";
import { initBalanceChecker, closeBalanceChecker } from "../reconciliation/balanceChecker.js";
import {
  healthService,
  createSupabaseHealthChecker,
  createRedisHealthChecker,
  createRpcHealthChecker,
  createMatchingEngineHealthChecker,
  createOrderbookReadinessChecker,
  createWriteProxyReadinessChecker,
} from "../monitoring/health.js";
import { supabaseAdmin } from "../supabase.js";
import {
  clampNumber,
  maybeNonEmptyString,
  pickFirstNonEmptyString,
  readIntEnv,
} from "../utils/envNumbers.js";
import { ClusteredWebSocketServer } from "../cluster/websocketCluster.js";
import { MarketWebSocketServer, type MatchingEngine } from "../matching/index.js";

type LoggerLike = {
  info: (message: string, context?: any) => void;
  warn: (message: string, context?: any, error?: any) => void;
  error: (message: string, context?: any, error?: any) => void;
};

type StartRelayerServerOptions = {
  app: express.Express;
  port: number;
  logger: LoggerLike;
  matchingEngine: MatchingEngine;
  provider: ethers.JsonRpcProvider | null;
  initContractListener: () => Promise<void>;
  startMarketExpiryLoop: () => Promise<void>;
  startAutoIngestLoop: () => Promise<void>;
  setChaosInstance: (instance: any) => void;
  setWsServer: (server: MarketWebSocketServer | ClusteredWebSocketServer | null) => void;
  setClusterIsActive: (active: boolean) => void;
  getClusterIsActive: () => boolean;
};

export function startRelayerServer(opts: StartRelayerServerOptions) {
  if (process.env.NODE_ENV === "test") return;

  opts.app.listen(opts.port, async () => {
    opts.logger.info("Relayer server starting", { port: opts.port });

    try {
      const { initChaosEngineering } = await import("../chaos/chaosInit.js");
      const chaosInstance = await initChaosEngineering();
      opts.setChaosInstance(chaosInstance);
    } catch (error) {
      opts.logger.error("混沌工程初始化失败", { error: String(error) });
    }

    await opts.initContractListener();

    const redisEnabled = process.env.REDIS_ENABLED !== "false";
    let redisConnected = false;
    if (redisEnabled) {
      try {
        const connected = await initRedis();
        if (connected) {
          redisConnected = true;
          opts.logger.info("Redis connected successfully");
          const snapshotService = getOrderbookSnapshotService();
          snapshotService.startSync(5000);
        } else {
          opts.logger.warn("Redis connection failed, running without Redis");
        }
      } catch (e) {
        const error = e as Error;
        opts.logger.warn("Redis initialization failed, running without Redis", {}, error);
      }
    }

    const clusterEnabled = process.env.CLUSTER_ENABLED === "true" && redisConnected;
    if (clusterEnabled === false && process.env.CLUSTER_ENABLED === "true") {
      opts.logger.warn("Cluster mode disabled because Redis is not connected");
    }

    try {
      await initDatabasePool();
      opts.logger.info("Database pool initialized");
    } catch (e) {
      const error = e as Error;
      opts.logger.warn("Database pool initialization failed, using single connection", {}, error);
    }

    const reconciliationEnabled = process.env.RECONCILIATION_ENABLED === "true";
    const shouldInitReconciler = reconciliationEnabled && !!RPC_URL && !!process.env.MARKET_ADDRESS;
    let reconcilerStarted = false;
    opts.setClusterIsActive(false);

    const startReconciler = async () => {
      if (!shouldInitReconciler) return;
      if (reconcilerStarted) return;
      try {
        await initChainReconciler({
          rpcUrl: RPC_URL,
          marketAddress: process.env.MARKET_ADDRESS!,
          chainId: CHAIN_ID,
          intervalMs: Math.max(1000, readIntEnv("RECONCILIATION_INTERVAL_MS", 300000)),
          autoFix: process.env.RECONCILIATION_AUTO_FIX === "true",
        });
        reconcilerStarted = true;
        opts.logger.info("Chain reconciler initialized");
      } catch (e) {
        const error = e as Error;
        opts.logger.warn("Chain reconciler initialization failed", {}, error);
      }
    };

    const stopReconciler = async () => {
      if (!reconcilerStarted) return;
      try {
        await closeChainReconciler();
      } catch {}
      reconcilerStarted = false;
    };

    const balanceCheckerEnabled = process.env.BALANCE_CHECKER_ENABLED !== "false";
    const configuredUsdcAddress = pickFirstNonEmptyString(
      process.env.COLLATERAL_TOKEN_ADDRESS,
      process.env.USDC_ADDRESS,
      process.env.NEXT_PUBLIC_USDC_ADDRESS,
      process.env.NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS
    );
    const shouldInitBalanceChecker =
      balanceCheckerEnabled &&
      !!RPC_URL &&
      !!configuredUsdcAddress &&
      ethers.isAddress(configuredUsdcAddress);
    let balanceCheckerStarted = false;

    const resolveBalanceTolerance = (): bigint | undefined => {
      const raw = maybeNonEmptyString(process.env.BALANCE_CHECK_TOLERANCE_USDC);
      const n = raw ? Number(raw) : NaN;
      if (!Number.isFinite(n) || n < 0) return undefined;
      return BigInt(Math.floor(n * 1e6));
    };

    const startBalanceChecker = async () => {
      if (!shouldInitBalanceChecker) return;
      if (balanceCheckerStarted) return;
      const marketAddress =
        process.env.MARKET_ADDRESS && ethers.isAddress(process.env.MARKET_ADDRESS)
          ? process.env.MARKET_ADDRESS.toLowerCase()
          : ethers.ZeroAddress;
      const tolerance = resolveBalanceTolerance();
      try {
        await initBalanceChecker({
          rpcUrl: RPC_URL,
          usdcAddress: configuredUsdcAddress!.toLowerCase(),
          marketAddress,
          chainId: CHAIN_ID,
          intervalMs: clampNumber(readIntEnv("BALANCE_CHECK_INTERVAL_MS", 60000), 5000, 3600000),
          batchSize: clampNumber(readIntEnv("BALANCE_CHECK_BATCH_SIZE", 200), 1, 1000),
          maxUsers: clampNumber(readIntEnv("BALANCE_CHECK_MAX_USERS", 10000), 1, 1000000),
          includeProxyWallets: process.env.BALANCE_CHECK_INCLUDE_PROXY_WALLETS !== "false",
          autoFix: process.env.BALANCE_CHECK_AUTO_FIX !== "false",
          ...(tolerance ? { tolerance } : {}),
        });
        balanceCheckerStarted = true;
        opts.logger.info("Balance checker initialized");
      } catch (e) {
        const error = e as Error;
        opts.logger.warn("Balance checker initialization failed", {}, error);
      }
    };

    const stopBalanceChecker = async () => {
      if (!balanceCheckerStarted) return;
      try {
        await closeBalanceChecker();
      } catch {}
      balanceCheckerStarted = false;
    };

    if (clusterEnabled) {
      try {
        const cluster = await initClusterManager({
          enableLeaderElection: true,
          enablePubSub: true,
        });
        opts.setClusterIsActive(true);

        cluster.on("became_leader", () => {
          opts.logger.info("This node became the leader, starting matching engine");
          void startReconciler();
          void startBalanceChecker();
        });

        cluster.on("lost_leadership", () => {
          opts.logger.warn("This node lost leadership");
          void stopReconciler();
          void stopBalanceChecker();
        });

        opts.logger.info("Cluster manager initialized", {
          nodeId: cluster.getNodeId(),
          isLeader: cluster.isLeader(),
        });

        if (cluster.isLeader()) {
          await startReconciler();
          await startBalanceChecker();
        }
      } catch (e) {
        const error = e as Error;
        opts.logger.warn(
          "Cluster manager initialization failed, running in standalone mode",
          {},
          error
        );
      }
    }
    if (!clusterEnabled) {
      await startReconciler();
      await startBalanceChecker();
    }

    healthService.registerHealthCheck("supabase", createSupabaseHealthChecker(supabaseAdmin));
    healthService.registerHealthCheck(
      "matching_engine",
      createMatchingEngineHealthChecker(opts.matchingEngine)
    );

    if (redisEnabled) {
      healthService.registerHealthCheck("redis", createRedisHealthChecker(getRedisClient()));
    }

    if (opts.provider) {
      healthService.registerHealthCheck("rpc", createRpcHealthChecker(opts.provider));
    }

    healthService.registerReadinessCheck(
      "orderbook",
      createOrderbookReadinessChecker(opts.matchingEngine)
    );

    healthService.registerHealthCheck("cluster", async () => {
      if (!opts.getClusterIsActive()) return { status: "pass", message: "Cluster disabled" };
      const cluster = getClusterManager();
      const role = cluster.isLeader() ? "leader" : "follower";
      const leaderId = cluster.isLeader() ? cluster.getNodeId() : cluster.getKnownLeaderId();
      const nodes = cluster.getNodeCount();
      return {
        status: "pass",
        message: `role=${role} leader=${leaderId || "unknown"} nodes=${nodes}`,
      };
    });

    healthService.registerReadinessCheck(
      "write_proxy",
      createWriteProxyReadinessChecker({
        isClusterActive: () => opts.getClusterIsActive(),
        isLeader: () => getClusterManager().isLeader(),
        getProxyUrl: () =>
          String(process.env.RELAYER_LEADER_PROXY_URL || process.env.RELAYER_LEADER_URL || ""),
      })
    );

    try {
      const useClusteredWs = clusterEnabled;
      const wsPort = clampNumber(readIntEnv("WS_PORT", 3006), 1, 65535);
      const wsServer = useClusteredWs
        ? new ClusteredWebSocketServer(wsPort)
        : new MarketWebSocketServer(wsPort);
      await Promise.resolve(wsServer.start());
      opts.setWsServer(wsServer);
      opts.logger.info("WebSocket server started", { port: wsPort });
    } catch (e) {
      const error = e as Error;
      opts.setWsServer(null);
      opts.logger.error("WebSocket server failed to start", {}, error);
    }

    try {
      await opts.matchingEngine.recoverFromDb();
      opts.logger.info("Order books recovered from database");
    } catch (e) {
      const error = e as Error;
      opts.logger.error("Failed to recover order books", {}, error);
    }

    try {
      const result = await opts.matchingEngine.recoverFromEventLog();
      if (result.replayed > 0 || result.skipped > 0) {
        opts.logger.info("Order books replayed from matching event log", result);
      }
    } catch (e) {
      const error = e as Error;
      opts.logger.warn("Failed to replay matching event log", {}, error);
    }

    opts
      .startMarketExpiryLoop()
      .catch((e) => opts.logger.warn("Market expiry loop failed to start", {}, e as Error));

    opts
      .startAutoIngestLoop()
      .catch((e: any) => opts.logger.warn("Auto-ingest failed to start", {}, e));

    opts.logger.info("Relayer server started successfully", {
      port: opts.port,
      wsPort: clampNumber(readIntEnv("WS_PORT", 3006), 1, 65535),
      redisEnabled,
      clusterEnabled,
      reconciliationEnabled,
    });
  });
}
