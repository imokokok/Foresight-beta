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
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to stop chain reconciler", {}, error);
      }

      try {
        await opts.stopBalanceChecker();
        opts.logger.info("Balance checker stopped");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to stop balance checker", {}, error);
      }

      try {
        await opts.stopContractEventListener();
        opts.logger.info("Contract event listener stopped");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to stop contract event listener", {}, error);
      }

      try {
        await opts.stopChaosEngineering();
        opts.logger.info("Chaos engineering stopped");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to stop chaos engineering", {}, error);
      }

      try {
        await opts.stopClusterManager();
        opts.logger.info("Cluster manager stopped");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to stop cluster manager", {}, error);
      }

      try {
        await opts.stopSnapshotService();
        opts.logger.info("Orderbook snapshot service stopped");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to stop snapshot service", {}, error);
      }

      try {
        await opts.stopMatchingEngine();
        opts.logger.info("Matching engine stopped");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to stop matching engine", {}, error);
      }

      try {
        await opts.stopWebSocket();
        opts.logger.info("WebSocket server stopped");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to stop WebSocket server", {}, error);
      }

      try {
        await opts.stopAutoIngest();
      } catch {}

      try {
        opts.stopMetrics();
      } catch (e) {
        const error = e as Error;
        opts.logger.warn("Failed to stop metrics timers", {}, error);
      }

      try {
        opts.stopRateLimiter();
      } catch (e) {
        const error = e as Error;
        opts.logger.warn("Failed to stop rate limiter", {}, error);
      }

      try {
        await opts.stopRedis();
        opts.logger.info("Redis connection closed");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to close Redis", {}, error);
      }

      try {
        await opts.stopDatabasePool();
        opts.logger.info("Database pool closed");
      } catch (e) {
        const error = e as Error;
        opts.logger.error("Failed to close database pool", {}, error);
      }

      clearTimeout(shutdownTimeout);
      opts.logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      const err = error as Error;
      opts.logger.error("Error during shutdown", {}, err);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}
