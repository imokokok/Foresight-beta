/**
 * Prometheus 监控指标系统
 * 提供撮合引擎、结算、WebSocket 等核心指标
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

// 创建独立的 Registry
export const metricsRegistry = new Registry();

// 收集默认的 Node.js 指标
collectDefaultMetrics({ register: metricsRegistry });

// ============================================================
// 订单相关指标
// ============================================================

export const ordersTotal = new Counter({
  name: "foresight_orders_total",
  help: "Total number of orders submitted",
  labelNames: ["market_key", "side", "status"] as const,
  registers: [metricsRegistry],
});

export const ordersActive = new Gauge({
  name: "foresight_orders_active",
  help: "Number of active orders in orderbook",
  labelNames: ["market_key", "outcome_index", "side"] as const,
  registers: [metricsRegistry],
});

export const orderAmountTotal = new Counter({
  name: "foresight_order_amount_total",
  help: "Total order amount submitted",
  labelNames: ["market_key", "side"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// 撮合相关指标
// ============================================================

export const matchingLatency = new Histogram({
  name: "foresight_matching_latency_ms",
  help: "Order matching latency in milliseconds",
  labelNames: ["market_key"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

export const matchesTotal = new Counter({
  name: "foresight_matches_total",
  help: "Total number of order matches",
  labelNames: ["market_key", "outcome_index"] as const,
  registers: [metricsRegistry],
});

export const matchedVolumeTotal = new Counter({
  name: "foresight_matched_volume_total",
  help: "Total matched volume (amount * price)",
  labelNames: ["market_key", "outcome_index"] as const,
  registers: [metricsRegistry],
});

export const partialFillsTotal = new Counter({
  name: "foresight_partial_fills_total",
  help: "Total number of partial fills",
  labelNames: ["market_key"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// 订单簿相关指标
// ============================================================

export const orderbookDepth = new Gauge({
  name: "foresight_orderbook_depth",
  help: "Orderbook depth (total quantity)",
  labelNames: ["market_key", "outcome_index", "side"] as const,
  registers: [metricsRegistry],
});

export const orderbookSpread = new Gauge({
  name: "foresight_orderbook_spread",
  help: "Orderbook spread (best ask - best bid)",
  labelNames: ["market_key", "outcome_index"] as const,
  registers: [metricsRegistry],
});

export const orderbookBestBid = new Gauge({
  name: "foresight_orderbook_best_bid",
  help: "Best bid price",
  labelNames: ["market_key", "outcome_index"] as const,
  registers: [metricsRegistry],
});

export const orderbookBestAsk = new Gauge({
  name: "foresight_orderbook_best_ask",
  help: "Best ask price",
  labelNames: ["market_key", "outcome_index"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// 结算相关指标
// ============================================================

export const settlementBatchesTotal = new Counter({
  name: "foresight_settlement_batches_total",
  help: "Total settlement batches",
  labelNames: ["status"] as const, // submitted, confirmed, failed
  registers: [metricsRegistry],
});

export const settlementFillsTotal = new Counter({
  name: "foresight_settlement_fills_total",
  help: "Total fills settled on-chain",
  labelNames: ["market_key"] as const,
  registers: [metricsRegistry],
});

export const settlementGasUsed = new Counter({
  name: "foresight_settlement_gas_used_total",
  help: "Total gas used for settlements",
  labelNames: ["market_key"] as const,
  registers: [metricsRegistry],
});

export const settlementLatency = new Histogram({
  name: "foresight_settlement_latency_ms",
  help: "Settlement confirmation latency in milliseconds",
  labelNames: ["market_key"] as const,
  buckets: [1000, 2000, 5000, 10000, 30000, 60000, 120000, 300000],
  registers: [metricsRegistry],
});

export const settlementPendingFills = new Gauge({
  name: "foresight_settlement_pending_fills",
  help: "Number of fills pending settlement",
  labelNames: ["market_key"] as const,
  registers: [metricsRegistry],
});

export const settlementPendingBatches = new Gauge({
  name: "foresight_settlement_pending_batches",
  help: "Number of batches pending confirmation",
  registers: [metricsRegistry],
});

// ============================================================
// WebSocket 相关指标
// ============================================================

export const wsConnectionsActive = new Gauge({
  name: "foresight_ws_connections_active",
  help: "Number of active WebSocket connections",
  registers: [metricsRegistry],
});

export const wsSubscriptionsActive = new Gauge({
  name: "foresight_ws_subscriptions_active",
  help: "Number of active WebSocket subscriptions",
  registers: [metricsRegistry],
});

export const wsMessagesTotal = new Counter({
  name: "foresight_ws_messages_total",
  help: "Total WebSocket messages",
  labelNames: ["direction", "type"] as const, // direction: in/out
  registers: [metricsRegistry],
});

export const wsBroadcastLatency = new Histogram({
  name: "foresight_ws_broadcast_latency_ms",
  help: "WebSocket broadcast latency in milliseconds",
  labelNames: ["channel_type"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50],
  registers: [metricsRegistry],
});

// ============================================================
// API 相关指标
// ============================================================

export const apiRequestsTotal = new Counter({
  name: "foresight_api_requests_total",
  help: "Total API requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [metricsRegistry],
});

export const apiRequestLatency = new Histogram({
  name: "foresight_api_request_latency_ms",
  help: "API request latency in milliseconds",
  labelNames: ["method", "path"] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

export const apiRateLimitHits = new Counter({
  name: "foresight_api_rate_limit_hits_total",
  help: "Total rate limit hits",
  labelNames: ["path"] as const,
  registers: [metricsRegistry],
});

export const apiAuthFailuresTotal = new Counter({
  name: "foresight_api_auth_failures_total",
  help: "Total API authentication failures",
  labelNames: ["path", "reason"] as const,
  registers: [metricsRegistry],
});

export const adminActionsTotal = new Counter({
  name: "foresight_admin_actions_total",
  help: "Total admin actions",
  labelNames: ["action", "result"] as const,
  registers: [metricsRegistry],
});

export const apiKeyRequestsTotal = new Counter({
  name: "foresight_api_key_requests_total",
  help: "Total requests gated by API keys",
  labelNames: ["action", "path", "result", "key_id"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// Redis 相关指标
// ============================================================

export const redisOperationsTotal = new Counter({
  name: "foresight_redis_operations_total",
  help: "Total Redis operations",
  labelNames: ["operation", "status"] as const, // operation: get/set/hget/hset, status: success/error
  registers: [metricsRegistry],
});

export const redisOperationLatency = new Histogram({
  name: "foresight_redis_operation_latency_ms",
  help: "Redis operation latency in milliseconds",
  labelNames: ["operation"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100],
  registers: [metricsRegistry],
});

export const redisConnectionStatus = new Gauge({
  name: "foresight_redis_connection_status",
  help: "Redis connection status (1=connected, 0=disconnected)",
  registers: [metricsRegistry],
});

// ============================================================
// 集群/一致性/快照相关指标
// ============================================================

export const clusterFollowerRejectedTotal = new Counter({
  name: "foresight_cluster_follower_rejected_total",
  help: "Total requests rejected because node is not leader",
  labelNames: ["path"] as const,
  registers: [metricsRegistry],
});

export const clusterFollowerProxiedTotal = new Counter({
  name: "foresight_cluster_follower_proxied_total",
  help: "Total requests proxied to leader from follower",
  labelNames: ["path", "status"] as const, // status: success/error
  registers: [metricsRegistry],
});

export const clusterFollowerProxyLatency = new Histogram({
  name: "foresight_cluster_follower_proxy_latency_ms",
  help: "Follower proxy-to-leader latency in milliseconds",
  labelNames: ["path", "status"] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [metricsRegistry],
});

export const clusterFollowerProxyErrorsTotal = new Counter({
  name: "foresight_cluster_follower_proxy_errors_total",
  help: "Total follower proxy errors by type",
  labelNames: ["path", "error_type"] as const,
  registers: [metricsRegistry],
});

export const clusterFollowerProxyUpstreamResponsesTotal = new Counter({
  name: "foresight_cluster_follower_proxy_upstream_responses_total",
  help: "Total follower proxy upstream responses",
  labelNames: ["path", "status_code", "status_class"] as const,
  registers: [metricsRegistry],
});

export const clusterFollowerProxyCircuitOpenTotal = new Counter({
  name: "foresight_cluster_follower_proxy_circuit_open_total",
  help: "Total requests blocked by proxy circuit breaker",
  labelNames: ["path"] as const,
  registers: [metricsRegistry],
});

export const clusterFollowerProxyCircuitOpen = new Gauge({
  name: "foresight_cluster_follower_proxy_circuit_open",
  help: "Proxy circuit open state (1=open, 0=closed)",
  labelNames: ["path"] as const,
  registers: [metricsRegistry],
});

export const orderbookLockBusyTotal = new Counter({
  name: "foresight_orderbook_lock_busy_total",
  help: "Total orderbook operations rejected due to distributed lock busy",
  labelNames: ["market_key", "outcome_index", "operation"] as const,
  registers: [metricsRegistry],
});

export const orderbookSnapshotLoadTotal = new Counter({
  name: "foresight_orderbook_snapshot_load_total",
  help: "Total Redis orderbook snapshot load attempts",
  labelNames: ["result"] as const, // hit/miss/error
  registers: [metricsRegistry],
});

export const orderbookSnapshotLoadLatency = new Histogram({
  name: "foresight_orderbook_snapshot_load_latency_ms",
  help: "Redis orderbook snapshot load latency in milliseconds",
  labelNames: ["result"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

export const orderbookSnapshotQueueThrottledTotal = new Counter({
  name: "foresight_orderbook_snapshot_queue_throttled_total",
  help: "Total snapshot queue operations skipped due to throttling",
  labelNames: ["market_key", "outcome_index"] as const,
  registers: [metricsRegistry],
});

export const orderbookSnapshotFlushTotal = new Counter({
  name: "foresight_orderbook_snapshot_flush_total",
  help: "Total Redis snapshot flush attempts",
  labelNames: ["snapshot_type", "result"] as const, // full/public success/error
  registers: [metricsRegistry],
});

export const orderbookSnapshotFlushLatency = new Histogram({
  name: "foresight_orderbook_snapshot_flush_latency_ms",
  help: "Redis snapshot flush latency in milliseconds",
  labelNames: ["snapshot_type", "result"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

// ============================================================
// 数据库相关指标
// ============================================================

export const dbOperationsTotal = new Counter({
  name: "foresight_db_operations_total",
  help: "Total database operations",
  labelNames: ["table", "operation", "status"] as const,
  registers: [metricsRegistry],
});

export const dbOperationLatency = new Histogram({
  name: "foresight_db_operation_latency_ms",
  help: "Database operation latency in milliseconds",
  labelNames: ["table", "operation"] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [metricsRegistry],
});

// ============================================================
// 系统健康指标
// ============================================================

export const systemUptime = new Gauge({
  name: "foresight_system_uptime_seconds",
  help: "System uptime in seconds",
  registers: [metricsRegistry],
});

export const systemHealthy = new Gauge({
  name: "foresight_system_healthy",
  help: "System health status (1=healthy, 0=unhealthy)",
  registers: [metricsRegistry],
});

export const readinessCheckReady = new Gauge({
  name: "foresight_readiness_check_ready",
  help: "Readiness checks (1=ready, 0=not ready)",
  labelNames: ["check"] as const,
  registers: [metricsRegistry],
});

// 启动时间
const startTime = Date.now();
let uptimeTimer: NodeJS.Timeout | null = null;

// 定期更新 uptime
uptimeTimer = setInterval(() => {
  systemUptime.set((Date.now() - startTime) / 1000);
}, 5000);

// ============================================================
// 辅助函数
// ============================================================

/**
 * 获取所有指标 (Prometheus 格式)
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * 获取指标内容类型
 */
export function getContentType(): string {
  return metricsRegistry.contentType;
}

/**
 * 重置所有指标 (用于测试)
 */
export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}

export function stopMetricsTimers(): void {
  if (uptimeTimer) {
    clearInterval(uptimeTimer);
    uptimeTimer = null;
  }
}
