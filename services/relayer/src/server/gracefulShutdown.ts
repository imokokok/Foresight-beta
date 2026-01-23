type LoggerLike = {
  info: (message: string, context?: any) => void;
  warn: (message: string, context?: any, error?: any) => void;
  error: (message: string, context?: any, error?: any) => void;
};

type ShutdownStep = () => Promise<void> | void;

export function registerGracefulShutdown(opts: {
  logger: LoggerLike;
  stopChainReconciler: ShutdownStep;
  stopBalanceChecker: ShutdownStep;
  stopContractEventListener: ShutdownStep;
  stopChaosEngineering: ShutdownStep;
  stopClusterManager: ShutdownStep;
  stopSnapshotService: ShutdownStep;
  stopMatchingEngine: ShutdownStep;
  stopWebSocket: ShutdownStep;
  stopAutoIngest: ShutdownStep;
  stopMetrics: ShutdownStep;
  stopRateLimiter: ShutdownStep;
  stopRedis: ShutdownStep;
  stopDatabasePool: ShutdownStep;
  shutdownTimeoutMs?: number;
}) {
  async function gracefulShutdown(signal: string) {
    opts.logger.info("Graceful shutdown initiated", { signal });

    try {
      const shutdownTimeout = setTimeout(() => {
        opts.logger.error("Shutdown timeout, forcing exit");
        process.exit(1);
      }, opts.shutdownTimeoutMs ?? 30000);

      try {
        await opts.stopChainReconciler();
        opts.logger.info("Chain reconciler stopped");
      } catch (e: any) {
        opts.logger.error("Failed to stop chain reconciler", {}, e);
      }

      try {
        await opts.stopBalanceChecker();
        opts.logger.info("Balance checker stopped");
      } catch (e: any) {
        opts.logger.error("Failed to stop balance checker", {}, e);
      }

      try {
        await opts.stopContractEventListener();
        opts.logger.info("Contract event listener stopped");
      } catch (e: any) {
        opts.logger.error("Failed to stop contract event listener", {}, e);
      }

      try {
        await opts.stopChaosEngineering();
        opts.logger.info("Chaos engineering stopped");
      } catch (e: any) {
        opts.logger.error("Failed to stop chaos engineering", {}, e);
      }

      try {
        await opts.stopClusterManager();
        opts.logger.info("Cluster manager stopped");
      } catch (e: any) {
        opts.logger.error("Failed to stop cluster manager", {}, e);
      }

      try {
        await opts.stopSnapshotService();
        opts.logger.info("Orderbook snapshot service stopped");
      } catch (e: any) {
        opts.logger.error("Failed to stop snapshot service", {}, e);
      }

      try {
        await opts.stopMatchingEngine();
        opts.logger.info("Matching engine stopped");
      } catch (e: any) {
        opts.logger.error("Failed to stop matching engine", {}, e);
      }

      try {
        await opts.stopWebSocket();
        opts.logger.info("WebSocket server stopped");
      } catch (e: any) {
        opts.logger.error("Failed to stop WebSocket server", {}, e);
      }

      try {
        await opts.stopAutoIngest();
      } catch {}

      try {
        opts.stopMetrics();
      } catch (e: any) {
        opts.logger.warn("Failed to stop metrics timers", {}, e);
      }

      try {
        opts.stopRateLimiter();
      } catch (e: any) {
        opts.logger.warn("Failed to stop rate limiter", {}, e);
      }

      try {
        await opts.stopRedis();
        opts.logger.info("Redis connection closed");
      } catch (e: any) {
        opts.logger.error("Failed to close Redis", {}, e);
      }

      try {
        await opts.stopDatabasePool();
        opts.logger.info("Database pool closed");
      } catch (e: any) {
        opts.logger.error("Failed to close database pool", {}, e);
      }

      clearTimeout(shutdownTimeout);
      opts.logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error: any) {
      opts.logger.error("Error during shutdown", {}, error);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
