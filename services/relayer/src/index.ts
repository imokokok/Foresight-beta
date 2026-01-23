import { z } from "zod";

import {
  BUNDLER_PRIVATE_KEY,
  OPERATOR_PRIVATE_KEY,
  RELAYER_GASLESS_SIGNER_PRIVATE_KEY,
  CUSTODIAL_SIGNER_PRIVATE_KEY,
  GASLESS_ENABLED,
  ENTRYPOINT_ADDRESS,
  CHAIN_ID,
  RPC_URL,
  RELAYER_PORT,
} from "./env.js";
import {
  AaUserOpDraftSchema,
  AaUserOpSimulateSchema,
  AaUserOpSubmitSchema,
  BigIntFromNumberishSchema,
  CancelV2Schema,
  CandlesQuerySchema,
  CustodialSignSchema,
  DepthQuerySchema,
  GaslessOrderSchema,
  HexAddressSchema,
  HexDataOrEmptySchema,
  HexDataSchema,
  QueueQuerySchema,
  TradeReportSchema,
  UserOperationSchema,
  V2CloseMarketSchema,
  V2DepthQuerySchema,
  V2RegisterSettlerSchema,
  V2StatsQuerySchema,
} from "./validation.js";

export {
  BUNDLER_PRIVATE_KEY,
  OPERATOR_PRIVATE_KEY,
  RELAYER_GASLESS_SIGNER_PRIVATE_KEY,
  CUSTODIAL_SIGNER_PRIVATE_KEY,
  AA_ENABLED,
  EMBEDDED_AUTH_ENABLED,
  GASLESS_ENABLED,
  RELAYER_GASLESS_PAYMASTER_URL,
  ENTRYPOINT_ADDRESS,
  CHAIN_ID,
  RELAYER_LEADER_PROXY_URL,
  RELAYER_LEADER_URL,
  PROXY_WALLET_TYPE,
  PROXY_WALLET_FACTORY_ADDRESS,
  SAFE_FACTORY_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  SAFE_FALLBACK_HANDLER_ADDRESS,
  RPC_URL,
  RELAYER_PORT,
} from "./env.js";

// 🚀 Phase 1: 导入监控和日志模块
import { logger, matchingLogger } from "./monitoring/logger.js";
import {
  matchesTotal,
  matchedVolumeTotal,
  apiKeyRequestsTotal,
  apiRateLimitHits,
  apiAuthFailuresTotal,
  adminActionsTotal,
  stopMetricsTimers,
} from "./monitoring/metrics.js";
import {
  initContractEventListener,
  closeContractEventListener,
} from "./monitoring/contractEvents.js";
import {
  marketsResolvedTotal,
  marketsInvalidatedTotal,
  marketsActive,
} from "./monitoring/contractEvents.js";
import { closeRedis, getRedisClient } from "./redis/client.js";
import { getOrderbookSnapshotService } from "./redis/orderbookSnapshot.js";
import { closeRateLimiter, createRateLimitMiddleware } from "./ratelimit/index.js";
import { RedisSlidingWindowLimiter, type RateLimitRequest } from "./ratelimit/slidingWindow.js";
import { healthRoutes, clusterRoutes } from "./routes/index.js";
import { registerRootRoutes } from "./routes/rootRoutes.js";
import {
  metricsMiddleware,
  requestIdMiddleware,
  requestLoggerMiddleware,
} from "./middleware/index.js";
import { createApiKeyAuth } from "./http/apiKeyAuth.js";
import { createIdempotency } from "./http/idempotency.js";
import { microCacheGet, microCacheSet, type MicroCacheEntry } from "./utils/microCache.js";
import {
  clampNumber,
  maybeNonEmptyString,
  pickFirstNonEmptyString,
  readIntEnv,
  readNumberEnv,
} from "./utils/envNumbers.js";
import { parseV2OrderInput } from "./utils/orderInput.js";
import {
  createGaslessQuotaStore,
  createIntentStore,
  type TradeIntentRecord,
} from "./utils/gaslessStore.js";

import { closeClusterManager, getClusterManager } from "./cluster/index.js";
import { closeDatabasePool } from "./database/index.js";
import { closeChainReconciler } from "./reconciliation/index.js";
import { closeBalanceChecker } from "./reconciliation/balanceChecker.js";
import { registerGracefulShutdown } from "./server/gracefulShutdown.js";
import { startRelayerServer } from "./server/serverStartup.js";
import { createBackgroundLoops } from "./server/backgroundLoops.js";

let clusterIsActive = false;
import express from "express";
import cors from "cors";
import { ethers, Contract } from "ethers";
import EntryPointAbi from "./abi/EntryPoint.json" with { type: "json" };
import { supabaseAdmin } from "./supabase.js";
import {
  placeSignedOrder,
  cancelSalt,
  getDepth,
  getQueue,
  getOrderTypes,
  ingestTrade,
  getCandles,
} from "./orderbook.js";

// 🚀 导入新的撮合引擎
import { MatchingEngine, type OrderInput } from "./matching/index.js";
import type { MarketWebSocketServer } from "./matching/index.js";
import { clusterFollowerRejectedTotal } from "./monitoring/metrics.js";
import {
  getCachedLeaderId,
  getLeaderProxyUrl,
  proxyToLeader,
  sendNotLeader,
} from "./cluster/leaderProxy.js";
import type { ClusteredWebSocketServer } from "./cluster/websocketCluster.js";
import {
  MetaTransactionHandler,
  type MetaTransactionRequest,
} from "./settlement/metaTransaction.js";

// 导入合约ABI
import MarketFactoryABI from "./abi/MarketFactory.json" with { type: "json" };
import OffchainMarketBaseABI from "./abi/OffchainMarketBase.json" with { type: "json" };
import OutcomeToken1155ABI from "./abi/OutcomeToken1155.json" with { type: "json" };
import UMAOracleAdapterV2ABI from "./abi/UMAOracleAdapterV2.json" with { type: "json" };

export const app = express();
const trustProxyHops = Math.max(0, readIntEnv("RELAYER_TRUST_PROXY_HOPS", 0));
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

// 🚀 初始化撮合引擎和 WebSocket 服务器
const matchingEngine = new MatchingEngine({
  makerFeeBps: Math.max(0, readIntEnv("MAKER_FEE_BPS", 0)),
  takerFeeBps: Math.max(0, readIntEnv("TAKER_FEE_BPS", 0)),
  maxMarketLongExposureUsdc: Math.max(0, readNumberEnv("RELAYER_MAX_MARKET_LONG_EXPOSURE_USDC", 0)),
  maxMarketShortExposureUsdc: Math.max(
    0,
    readNumberEnv("RELAYER_MAX_MARKET_SHORT_EXPOSURE_USDC", 0)
  ),
});

let wsServer: MarketWebSocketServer | ClusteredWebSocketServer | null = null;

// 🚀 连接撮合引擎事件到 WebSocket
matchingEngine.on("market_event", (event) => {
  void wsServer?.handleMarketEvent(event as any);
});

matchingEngine.on(
  "trade",
  (trade: {
    marketKey: string;
    outcomeIndex: number;
    amount: bigint;
    price: bigint;
    maker: string;
    taker: string;
  }) => {
    // 🚀 Phase 1: 结构化日志 + 指标
    matchingLogger.info("Trade executed", {
      marketKey: trade.marketKey,
      outcomeIndex: trade.outcomeIndex,
      amount: trade.amount.toString(),
      price: trade.price.toString(),
      maker: trade.maker,
      taker: trade.taker,
    });

    // 记录指标
    matchesTotal.inc({
      market_key: trade.marketKey,
      outcome_index: String(trade.outcomeIndex),
    });
    const volumeBigInt = (trade.amount * trade.price) / 1_000_000_000_000_000_000n;
    const volume = Number(volumeBigInt) / 1000000;
    if (Number.isFinite(volume) && volume >= 0) {
      matchedVolumeTotal.inc(
        {
          market_key: trade.marketKey,
          outcome_index: String(trade.outcomeIndex),
        },
        volume
      );
    }
  }
);

// 🚀 连接结算事件
matchingEngine.on("settlement_event", (event) => {
  logger.info("Settlement event", { type: event.type, ...event });
});

function sendApiError(
  req: express.Request,
  res: express.Response,
  status: number,
  payload: { message: string; detail?: any; errorCode?: string | null }
) {
  const requestId = String(req.headers["x-request-id"] || (req as any).requestId || "").trim();
  const body = {
    success: false,
    message: payload.message,
    ...(typeof payload.detail !== "undefined" ? { detail: payload.detail } : {}),
    ...(typeof payload.errorCode !== "undefined" ? { errorCode: payload.errorCode } : {}),
    ...(requestId ? { requestId } : {}),
  };
  res.status(status).json(body);
  return body;
}

const {
  requireApiKey,
  resolveApiKey,
  getApiKeyFromRequest,
  getClientIp,
  getRateLimitIdentityFromResolvedKey,
  getRateTierFromScopes,
} = createApiKeyAuth(readIntEnv, sendApiError);

function createRoleBasedLimiter(
  envPrefix: string,
  defaults: { admin: number; trader: number; anon: number; windowMs: number }
) {
  const windowMs = Math.max(100, readIntEnv(`${envPrefix}_WINDOW_MS`, defaults.windowMs));
  const adminMax = Math.max(1, readIntEnv(`${envPrefix}_ADMIN_MAX`, defaults.admin));
  const traderMax = Math.max(1, readIntEnv(`${envPrefix}_TRADER_MAX`, defaults.trader));
  const anonMax = Math.max(1, readIntEnv(`${envPrefix}_ANON_MAX`, defaults.anon));

  const adminLimiter = new RedisSlidingWindowLimiter({
    windowMs,
    maxRequests: adminMax,
    keyPrefix: `ratelimit:${envPrefix}:admin:`,
  });
  const traderLimiter = new RedisSlidingWindowLimiter({
    windowMs,
    maxRequests: traderMax,
    keyPrefix: `ratelimit:${envPrefix}:trader:`,
  });
  const anonLimiter = new RedisSlidingWindowLimiter({
    windowMs,
    maxRequests: anonMax,
    keyPrefix: `ratelimit:${envPrefix}:anon:`,
  });

  return async function roleBasedRateLimit(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) return next();
    }

    const raw = getApiKeyFromRequest(req);
    const resolved = raw ? await resolveApiKey(raw) : null;
    const identity = getRateLimitIdentityFromResolvedKey(resolved, req);
    const tier = getRateTierFromScopes(resolved?.scopes || null);

    const rateReq: RateLimitRequest = {
      ip: identity,
      path: req.path,
      method: req.method,
    };
    const limiter =
      tier === "admin" ? adminLimiter : tier === "trader" ? traderLimiter : anonLimiter;
    const result = await limiter.check(rateReq);
    res.setHeader(
      "X-RateLimit-Limit",
      tier === "admin" ? adminMax : tier === "trader" ? traderMax : anonMax
    );
    res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
    res.setHeader("X-RateLimit-Reset", result.resetAt ? Math.ceil(result.resetAt / 1000) : 0);
    if (!result.allowed) {
      if (result.retryAfter) res.setHeader("Retry-After", result.retryAfter);
      apiRateLimitHits.inc({ path: req.path });
      return res.status(429).json({
        success: false,
        message: "Too many requests",
        retryAfter: result.retryAfter,
      });
    }
    return next();
  };
}

const limitOrders = createRoleBasedLimiter("RELAYER_RATE_LIMIT_ORDERS", {
  admin: 1000,
  trader: 120,
  anon: 30,
  windowMs: 60000,
});
const limitReportTrade = createRoleBasedLimiter("RELAYER_RATE_LIMIT_REPORT_TRADE", {
  admin: 2000,
  trader: 240,
  anon: 60,
  windowMs: 60000,
});
const limitGasless = createRoleBasedLimiter("RELAYER_RATE_LIMIT_GASLESS", {
  admin: 200,
  trader: 60,
  anon: 20,
  windowMs: 60000,
});

const { getIdempotencyKey, getIdempotencyEntry, setIdempotencyEntry, setIdempotencyIfPresent } =
  createIdempotency(readIntEnv);

const depthMicroCache = new Map<string, MicroCacheEntry<any>>();
const statsMicroCache = new Map<string, MicroCacheEntry<any>>();
const { getGaslessQuotaUsage, addGaslessQuotaUsage } = createGaslessQuotaStore();
const { saveTradeIntent, loadIntent } = createIntentStore();

const allowedOriginsRaw = process.env.RELAYER_CORS_ORIGINS || "";
const allowedOrigins = allowedOriginsRaw
  .split(",")
  .map((v) => v.trim())
  .filter((v) => v.length > 0);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  })
);
app.use(express.json({ limit: "1mb" }));

// 🚀 Phase 1: 添加监控中间件
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(metricsMiddleware);
app.use(createRateLimitMiddleware());

// 🚀 Phase 1: 添加健康检查路由
app.use(healthRoutes);

// 🚀 Phase 2: 添加集群管理路由
app.use(clusterRoutes);

const PORT = RELAYER_PORT;

let provider: ethers.JsonRpcProvider | null = null;
let bundlerWallet: ethers.Wallet | null = null;
try {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  if (BUNDLER_PRIVATE_KEY) {
    bundlerWallet = new ethers.Wallet(BUNDLER_PRIVATE_KEY, provider);
    console.log(`Bundler address: ${bundlerWallet.address}`);
  }
} catch {
  provider = null;
  bundlerWallet = null;
}

const parseOutcomeIndex = (value: unknown): number | null => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof (value as any).toString === "function") {
    const n = Number((value as any).toString());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const syncMarketResolution = async (
  marketAddressRaw: string,
  status: "resolved" | "invalidated",
  outcomeIndex: number | null
) => {
  if (!supabaseAdmin) return;
  const marketAddress = String(marketAddressRaw || "").toLowerCase();
  if (!marketAddress) return;
  const { data, error } = await supabaseAdmin
    .from("markets_map")
    .select("event_id,chain_id")
    .eq("market", marketAddress)
    .eq("chain_id", CHAIN_ID)
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error("Failed to load market map for resolution sync", {
      marketAddress,
      chainId: CHAIN_ID,
      error: error.message,
    });
    return;
  }
  if (!data) return;

  const nowIso = new Date().toISOString();
  const marketUpdate = await supabaseAdmin
    .from("markets_map")
    .update({ status })
    .eq("event_id", data.event_id)
    .eq("chain_id", data.chain_id);
  if (marketUpdate.error) {
    logger.error("Failed to update markets_map status", {
      marketAddress,
      eventId: data.event_id,
      chainId: data.chain_id,
      error: marketUpdate.error.message,
    });
  }

  const predictionUpdate: Record<string, any> = {
    status: status === "resolved" ? "completed" : "cancelled",
    settled_at: nowIso,
  };
  if (status === "resolved" && outcomeIndex !== null) {
    predictionUpdate.winning_outcome = String(outcomeIndex);
  }
  if (status === "invalidated") {
    predictionUpdate.winning_outcome = null;
  }
  const predictionRes = await supabaseAdmin
    .from("predictions")
    .update(predictionUpdate)
    .eq("id", data.event_id);
  if (predictionRes.error) {
    logger.error("Failed to update prediction status", {
      eventId: data.event_id,
      status: predictionUpdate.status,
      error: predictionRes.error.message,
    });
  }

  const marketKey = `${data.chain_id}:${data.event_id}`;
  try {
    await matchingEngine.closeMarket(marketKey, { reason: status });
  } catch (error: any) {
    logger.error("Failed to close market orderbook", {
      marketKey,
      reason: status,
      error: String(error?.message || error),
    });
  }
};

// 初始化合约事件监听器
async function initContractListener() {
  try {
    const marketFactoryAddress = process.env.MARKET_FACTORY_ADDRESS;
    if (!marketFactoryAddress) {
      logger.warn("MARKET_FACTORY_ADDRESS 未配置，跳过合约事件监听器初始化");
      return;
    }

    await initContractEventListener({
      marketFactoryAddress,
      marketFactoryAbi: MarketFactoryABI,
      offchainMarketAbi: OffchainMarketBaseABI,
      outcomeTokenAbi: OutcomeToken1155ABI,
      eventHandlers: {
        Resolved: async (event: any) => {
          marketsResolvedTotal.inc();
          marketsActive.dec();
          const outcomeIndex = parseOutcomeIndex(event?.args?.outcomeIndex);
          logger.info("Market resolved", {
            marketAddress: event.address,
            outcomeIndex: outcomeIndex === null ? null : String(outcomeIndex),
          });
          await syncMarketResolution(event.address, "resolved", outcomeIndex);
        },
        Invalidated: async (event: any) => {
          marketsInvalidatedTotal.inc();
          marketsActive.dec();
          logger.warn("Market invalidated", {
            marketAddress: event.address,
          });
          await syncMarketResolution(event.address, "invalidated", null);
        },
      },
    });

    logger.info("合约事件监听器初始化成功");
  } catch (error) {
    logger.error("合约事件监听器初始化失败", {
      error: String(error),
    });
  }
}

// 混沌工程实例
let chaosInstance: any = null;

registerRootRoutes(app, {
  isClusterActive: () => clusterIsActive,
  getClusterManager,
  getCachedLeaderId,
  getLeaderProxyUrl,
  proxyToLeader,
  sendNotLeader,
  getIdempotencyKey,
  getIdempotencyEntry,
  setIdempotencyEntry,
  getBundlerWallet: () => bundlerWallet,
  entryPointAbi: EntryPointAbi,
});

const DEFAULT_ENTRYPOINT_ADDRESSES: Record<number, string> = {
  80002: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  137: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  11155111: "0x0000000071727de22e5e9d8baf0edac6f37da032",
};

function maybeEthAddress(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return undefined;
  if (/^[0-9a-fA-F]{40}$/.test(s)) return "0x" + s;
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s;
  return undefined;
}

function resolveEntryPointAddress(raw: unknown): string | null {
  const body = raw && typeof raw === "object" ? (raw as any) : {};
  const candidate = maybeEthAddress(
    body.entryPointAddress || body.entryPoint || body.entryPoint_address
  );
  if (candidate) return candidate.toLowerCase();
  if (ENTRYPOINT_ADDRESS) return ENTRYPOINT_ADDRESS.toLowerCase();
  const fallback = DEFAULT_ENTRYPOINT_ADDRESSES[CHAIN_ID];
  return fallback ? fallback.toLowerCase() : null;
}

app.post("/aa/userop/draft", requireApiKey("aa", "aa_userop_draft"), async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/aa/userop/draft");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/aa/userop/draft" });
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/aa/userop/draft",
        });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/aa/userop/draft");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    if (!provider) {
      const body = sendApiError(req, res, 503, {
        message: "RPC provider unavailable",
        errorCode: "RPC_UNAVAILABLE",
      });
      setIdempotencyIfPresent(idemKey, 503, body);
      return;
    }

    const parsed = AaUserOpDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      const body = sendApiError(req, res, 400, {
        message: "Invalid params",
        detail: parsed.error.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPointAddress =
      (parsed.data.entryPointAddress || resolveEntryPointAddress(req.body))?.toLowerCase() || "";
    if (!entryPointAddress) {
      const body = sendApiError(req, res, 400, {
        message: "EntryPoint not configured",
        errorCode: "ENTRYPOINT_MISSING",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPoint = new Contract(entryPointAddress, EntryPointAbi, provider);
    const userOpHash = await entryPoint.getUserOpHash(parsed.data.userOp);

    const responseBody = {
      success: true,
      owner: parsed.data.owner,
      entryPointAddress,
      userOp: parsed.data.userOp,
      userOpHash,
    };
    res.json(responseBody);
    setIdempotencyIfPresent(idemKey, 200, responseBody);
  } catch (error: any) {
    const body = sendApiError(req, res, 500, {
      message: "Internal error",
      detail: String(error?.message || error),
    });
    return body;
  }
});

app.post("/aa/userop/simulate", requireApiKey("aa", "aa_userop_simulate"), async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/aa/userop/simulate");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/aa/userop/simulate" });
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/aa/userop/simulate",
        });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/aa/userop/simulate");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    if (!provider) {
      const body = sendApiError(req, res, 503, {
        message: "RPC provider unavailable",
        errorCode: "RPC_UNAVAILABLE",
      });
      setIdempotencyIfPresent(idemKey, 503, body);
      return;
    }

    const parsed = AaUserOpSimulateSchema.safeParse(req.body);
    if (!parsed.success) {
      const body = sendApiError(req, res, 400, {
        message: "Invalid params",
        detail: parsed.error.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPointAddress =
      (parsed.data.entryPointAddress || resolveEntryPointAddress(req.body))?.toLowerCase() || "";
    if (!entryPointAddress) {
      const body = sendApiError(req, res, 400, {
        message: "EntryPoint not configured",
        errorCode: "ENTRYPOINT_MISSING",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPoint = new Contract(entryPointAddress, EntryPointAbi, provider);
    const userOpHash = await entryPoint.getUserOpHash(parsed.data.userOp);

    let gasEstimate: string | null = null;
    try {
      const estimate = await entryPoint.handleOps.estimateGas(
        [parsed.data.userOp],
        bundlerWallet?.address || parsed.data.owner,
        bundlerWallet?.address ? { from: bundlerWallet.address } : undefined
      );
      gasEstimate = estimate ? estimate.toString() : null;
    } catch {
      gasEstimate = null;
    }

    const responseBody = {
      success: true,
      owner: parsed.data.owner,
      entryPointAddress,
      userOpHash,
      gasEstimate,
    };
    res.json(responseBody);
    setIdempotencyIfPresent(idemKey, 200, responseBody);
  } catch (error: any) {
    const body = sendApiError(req, res, 500, {
      message: "Internal error",
      detail: String(error?.message || error),
    });
    return body;
  }
});

app.post("/aa/userop/submit", requireApiKey("aa", "aa_userop_submit"), async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/aa/userop/submit");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/aa/userop/submit" });
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/aa/userop/submit",
        });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/aa/userop/submit");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    if (!bundlerWallet) {
      const body = sendApiError(req, res, 501, {
        message: "Bundler disabled",
        errorCode: "BUNDLER_DISABLED",
      });
      setIdempotencyIfPresent(idemKey, 501, body);
      return;
    }

    const parsed = AaUserOpSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      const body = sendApiError(req, res, 400, {
        message: "Invalid params",
        detail: parsed.error.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPointAddress =
      (parsed.data.entryPointAddress || resolveEntryPointAddress(req.body))?.toLowerCase() || "";
    if (!entryPointAddress) {
      const body = sendApiError(req, res, 400, {
        message: "EntryPoint not configured",
        errorCode: "ENTRYPOINT_MISSING",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const opParsed = UserOperationSchema.safeParse(parsed.data.userOp);
    if (!opParsed.success) {
      const body = sendApiError(req, res, 400, {
        message: "Invalid userOp",
        detail: opParsed.error.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const userOp = opParsed.data as any;
    if (parsed.data.signature && (!userOp.signature || userOp.signature === "0x")) {
      userOp.signature = parsed.data.signature;
    }

    const entryPoint = new Contract(entryPointAddress, EntryPointAbi, bundlerWallet);
    const tx = await entryPoint.handleOps([userOp], bundlerWallet.address);
    const receipt = await tx.wait();

    const responseBody = {
      success: true,
      txHash: receipt?.hash ?? tx.hash,
    };
    res.json(responseBody);
    setIdempotencyIfPresent(idemKey, 200, responseBody);
  } catch (error: any) {
    const body = sendApiError(req, res, 500, {
      message: "Internal error",
      detail: String(error?.message || error),
    });
    return body;
  }
});

app.post("/aa/custodial/sign", requireApiKey("admin", "custodial_sign"), async (req, res) => {
  try {
    if (!CUSTODIAL_SIGNER_PRIVATE_KEY) {
      return sendApiError(req, res, 503, {
        message: "Custodial signing not configured",
        errorCode: "CUSTODIAL_DISABLED",
      });
    }

    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/aa/custodial/sign");
          if (ok) return;
        }
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/aa/custodial/sign",
        });
        return;
      }
    }

    const parsed = CustodialSignSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendApiError(req, res, 400, {
        message: "Invalid params",
        detail: parsed.error.flatten(),
      });
    }

    const { userOp, owner } = parsed.data;

    // 这里可以添加更多校验：比如确认 owner 是我们系统内注册的邮箱托管地址
    // 简单起见，我们假设调用方（Web API）已经验证了权限

    // 计算 UserOp Hash 并签名
    // 注意：UserOp 的打包和哈希计算通常需要 chainId 和 entryPoint
    // 为了简化，我们假设前端或上游传来的 userOp 已经是需要签名的结构，或者我们需要自己重新计算
    // 这里为了演示，我们使用 ethers 直接对 hash 进行签名，假设 userOp 包含预计算的 hash
    // 或者我们需要重新构建 UserOpHash

    // 更正：UserOp 签名需要对 UserOpHash 进行签名
    // UserOpHash = keccak256(pack(userOp, entryPoint, chainId))
    // 由于我们没有 entryPoint 和 chainId 参数传入，我们假设调用方传递了 userOpHash
    // 或者我们可以从 userOp 中提取并自行计算（但这需要 ABI 编码）

    // 为了稳健，我们要求请求体直接包含 userOpHash，或者我们在这里只做 "Message Signing"
    // 真正的 UserOp 签名是 signMessage(arrayify(userOpHash))

    const userOpHash = req.body.userOpHash;
    if (!userOpHash || typeof userOpHash !== "string" || !userOpHash.startsWith("0x")) {
      return sendApiError(req, res, 400, { message: "Missing userOpHash" });
    }

    const signer = new ethers.Wallet(CUSTODIAL_SIGNER_PRIVATE_KEY);
    // 对 hash 进行签名（Ethereum Signed Message）
    const signature = await signer.signMessage(ethers.getBytes(userOpHash));

    res.json({ success: true, signature });
  } catch (error: any) {
    logger.error("Custodial sign error", { error: String(error) });
    sendApiError(req, res, 500, {
      message: "Internal error",
      detail: error.message,
    });
  }
});

app.post(
  "/v2/gasless/order",
  limitGasless,
  requireApiKey("orders", "v2_gasless_order"),
  async (req, res) => {
    try {
      if (!GASLESS_ENABLED || !RELAYER_GASLESS_SIGNER_PRIVATE_KEY) {
        return sendApiError(req, res, 503, {
          message: "Gasless disabled",
          errorCode: "GASLESS_DISABLED",
        });
      }

      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/v2/gasless/order");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/v2/gasless/order" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/v2/gasless/order",
          });
          return;
        }
      }

      const idemKey = getIdempotencyKey(req, "/v2/gasless/order");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }

      let parsed: z.infer<typeof GaslessOrderSchema>;
      try {
        parsed = GaslessOrderSchema.parse(req.body || {});
      } catch (e: any) {
        if (e instanceof z.ZodError) {
          const responseBody = sendApiError(req, res, 400, {
            message: "gasless order validation failed",
            detail: e.flatten(),
            errorCode: "VALIDATION_ERROR",
          });
          setIdempotencyIfPresent(idemKey, 400, responseBody);
          return;
        }
        const responseBody = sendApiError(req, res, 400, {
          message: "gasless order validation failed",
          detail: String(e?.message || e),
          errorCode: "VALIDATION_ERROR",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }

      const userAddress = parsed.userAddress.toLowerCase();
      const quota = await getGaslessQuotaUsage(userAddress);
      if (quota.remaining <= 0) {
        const responseBody = sendApiError(req, res, 429, {
          message: "Gasless quota exceeded",
          errorCode: "GASLESS_QUOTA_EXCEEDED",
        });
        setIdempotencyIfPresent(idemKey, 429, responseBody);
        return;
      }

      const intentCostUsd =
        typeof parsed.meta?.maxCostUsd === "number" && parsed.meta.maxCostUsd > 0
          ? parsed.meta.maxCostUsd
          : Number(process.env.RELAYER_GASLESS_DEFAULT_COST_USD || "0.1");
      if (Number.isFinite(intentCostUsd) && intentCostUsd > 0 && quota.remaining < intentCostUsd) {
        const responseBody = sendApiError(req, res, 429, {
          message: "Gasless quota insufficient for intent",
          errorCode: "GASLESS_QUOTA_EXCEEDED",
        });
        setIdempotencyIfPresent(idemKey, 429, responseBody);
        return;
      }

      const marketKey = parsed.marketKey;
      const marketKeyParts = marketKey.split(":");
      if (marketKeyParts.length < 2) {
        const responseBody = sendApiError(req, res, 400, {
          message: "Invalid marketKey",
          errorCode: "INVALID_MARKET_KEY",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }

      const redis = getRedisClient();
      if (!redis.isReady()) {
        return sendApiError(req, res, 503, {
          message: "Redis not ready",
          errorCode: "REDIS_UNAVAILABLE",
        });
      }

      const riskKeyUser = `risk:blacklist:user:${userAddress}`;
      const riskKeyIp = `risk:blacklist:ip:${getClientIp(req)}`;
      const [userFlag, ipFlag] = await Promise.all([redis.get(riskKeyUser), redis.get(riskKeyIp)]);
      if (userFlag === "1" || ipFlag === "1") {
        const responseBody = sendApiError(req, res, 403, {
          message: "Gasless blocked by risk control",
          errorCode: "GASLESS_BLOCKED",
        });
        setIdempotencyIfPresent(idemKey, 403, responseBody);
        return;
      }

      const marketKeyPrefix = `${parsed.chainId}:`;
      if (!marketKey.startsWith(marketKeyPrefix)) {
        const responseBody = sendApiError(req, res, 400, {
          message: "marketKey does not match chainId",
          errorCode: "INVALID_MARKET_KEY",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }

      const fillAmount = parsed.fillAmount;
      const order: MetaTransactionRequest["order"] = {
        maker: parsed.order.maker,
        outcomeIndex: parsed.order.outcomeIndex,
        isBuy: parsed.order.isBuy,
        price: parsed.order.price,
        amount: parsed.order.amount,
        salt: parsed.order.salt,
        expiry: parsed.order.expiry,
      };

      const permit = parsed.permit
        ? {
            owner: parsed.permit.owner,
            spender: parsed.permit.spender,
            value: parsed.permit.value,
            nonce: parsed.permit.nonce,
            deadline: parsed.permit.deadline,
            signature: parsed.permit.signature,
          }
        : undefined;

      const metaTxRequest: MetaTransactionRequest = {
        order,
        orderSignature: parsed.orderSignature,
        fillAmount,
        permit,
        requestedAt: Date.now(),
        userAddress,
      };

      const usdcAddress =
        parsed.usdcAddress ||
        (process.env.COLLATERAL_TOKEN_ADDRESS as string | undefined) ||
        (process.env.USDC_ADDRESS as string | undefined) ||
        (process.env.NEXT_PUBLIC_USDC_ADDRESS as string | undefined) ||
        "";
      if (!usdcAddress) {
        return sendApiError(req, res, 500, {
          message: "USDC address not configured",
          errorCode: "USDC_NOT_CONFIGURED",
        });
      }

      if (!provider) {
        return sendApiError(req, res, 503, {
          message: "RPC provider not available",
          errorCode: "RPC_UNAVAILABLE",
        });
      }

      const handler = new MetaTransactionHandler(
        parsed.chainId,
        parsed.marketAddress,
        usdcAddress,
        RELAYER_GASLESS_SIGNER_PRIVATE_KEY,
        RPC_URL
      );

      const intentId = `intent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const now = Date.now();
      const baseIntent: TradeIntentRecord = {
        id: intentId,
        type: "trade",
        userAddress,
        marketKey,
        chainId: parsed.chainId,
        createdAt: now,
        updatedAt: now,
        status: "pending",
        txHash: null,
        error: null,
      };
      await saveTradeIntent(baseIntent);

      const result = await handler.processMetaTransaction(metaTxRequest);
      if (!result.success) {
        const failedIntent: TradeIntentRecord = {
          ...baseIntent,
          status: "failed",
          updatedAt: Date.now(),
          error: result.error || "Gasless order failed",
        };
        await saveTradeIntent(failedIntent);
        const responseBody = sendApiError(req, res, 400, {
          message: result.error || "Gasless order failed",
          errorCode: "GASLESS_FAILED",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }

      const confirmingIntent: TradeIntentRecord = {
        ...baseIntent,
        status: "confirming",
        updatedAt: Date.now(),
        txHash: result.txHash || null,
      };
      await saveTradeIntent(confirmingIntent);

      if (Number.isFinite(intentCostUsd) && intentCostUsd > 0) {
        void addGaslessQuotaUsage(userAddress, intentCostUsd).catch(() => {});
      }

      const responseBody = {
        success: true,
        data: {
          intentId,
          txHash: result.txHash || null,
          marketKey,
          userAddress,
          chainId: parsed.chainId,
        },
      };
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      logger.error("v2 gasless order failed", { path: "/v2/gasless/order" }, e);
      return sendApiError(req, res, 500, {
        message: "Gasless order failed",
        detail: String(e?.message || e),
        errorCode: "INTERNAL_ERROR",
      });
    }
  }
);

app.get("/v2/intents/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return sendApiError(req, res, 400, {
        message: "Intent id is required",
        errorCode: "INTENT_ID_REQUIRED",
      });
    }
    const record = await loadIntent(id);
    if (!record) {
      return sendApiError(req, res, 404, {
        message: "Intent not found",
        errorCode: "INTENT_NOT_FOUND",
      });
    }
    res.json({
      success: true,
      data: record,
    });
  } catch (e: any) {
    return sendApiError(req, res, 500, {
      message: "Failed to load intent",
      detail: String(e?.message || e),
      errorCode: "INTERNAL_ERROR",
    });
  }
});

// Off-chain orderbook API (legacy - 保留兼容)
app.post(
  "/orderbook/orders",
  limitOrders,
  requireApiKey("orders", "orderbook_orders"),
  async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return sendApiError(req, res, 500, {
          message: "Supabase not configured",
          errorCode: "SUPABASE_NOT_CONFIGURED",
        });
      }
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/orderbook/orders");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/orderbook/orders" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/orderbook/orders",
          });
          return;
        }
      }
      const idemKey = getIdempotencyKey(req, "/orderbook/orders");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }
      const body = req.body || {};
      const data = await placeSignedOrder(body);
      const responseBody = { success: true, data };
      logger.info("orderbook order accepted", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      return sendApiError(req, res, 400, {
        message: "place order failed",
        detail: String(e?.message || e),
      });
    }
  }
);

/**
 * POST /v2/orders - 提交订单并撮合
 * 新的撮合引擎入口，支持即时撮合
 */
app.post("/v2/orders", limitOrders, requireApiKey("orders", "v2_orders"), async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/v2/orders");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/v2/orders" });
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/v2/orders",
        });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/v2/orders");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    let orderInput: OrderInput;
    try {
      orderInput = parseV2OrderInput(req.body);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        const responseBody = sendApiError(req, res, 400, {
          message: "order validation failed",
          detail: e.flatten(),
          errorCode: "VALIDATION_ERROR",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }
      const responseBody = sendApiError(req, res, 400, {
        message: "order validation failed",
        detail: String(e?.message || e),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, responseBody);
      return;
    }

    if (supabaseAdmin) {
      const marketKeyRaw = String(orderInput.marketKey || "").trim();
      const [mkChain, mkEvent] = marketKeyRaw.split(":");
      const eventId = Number(mkEvent);
      const chainId = Number(mkChain);
      let marketStatus: string | null = null;
      let statusError: string | null = null;

      if (Number.isFinite(eventId) && Number.isFinite(chainId)) {
        const { data, error } = await supabaseAdmin
          .from("markets_map")
          .select("status")
          .eq("event_id", eventId)
          .eq("chain_id", chainId)
          .limit(1)
          .maybeSingle();
        if (error) statusError = error.message;
        if (data?.status != null) marketStatus = String(data.status);
      } else if (orderInput.verifyingContract) {
        const { data, error } = await supabaseAdmin
          .from("markets_map")
          .select("status")
          .eq("market", orderInput.verifyingContract.toLowerCase())
          .eq("chain_id", orderInput.chainId)
          .limit(1)
          .maybeSingle();
        if (error) statusError = error.message;
        if (data?.status != null) marketStatus = String(data.status);
      }

      if (statusError) {
        logger.error("Failed to load market status", {
          marketKey: orderInput.marketKey,
          chainId: orderInput.chainId,
          verifyingContract: orderInput.verifyingContract,
          error: statusError,
        });
      } else if (marketStatus && marketStatus.toLowerCase() !== "open") {
        const responseBody = sendApiError(req, res, 400, {
          message: "Market closed",
          errorCode: "MARKET_CLOSED",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }
    }

    // 提交到撮合引擎
    const result = await matchingEngine.submitOrder(orderInput);

    if (!result.success) {
      const responseBody = sendApiError(req, res, 400, {
        message: result.error || "Order submission failed",
        errorCode: result.errorCode || null,
      });
      setIdempotencyIfPresent(idemKey, 400, responseBody);
      return;
    }

    const filledAmount = result.matches.reduce<bigint>((acc, m) => acc + m.matchedAmount, 0n);

    let status: string;
    if (orderInput.tif === "FOK") {
      status = filledAmount === orderInput.amount ? "filled" : "canceled";
    } else if (orderInput.tif === "IOC" || orderInput.tif === "FAK") {
      if (filledAmount === 0n) {
        status = "canceled";
      } else if (filledAmount < orderInput.amount) {
        status = "partially_filled";
      } else {
        status = "filled";
      }
    } else {
      if (!result.remainingOrder) {
        status = "filled";
      } else if (filledAmount === 0n) {
        status = "open";
      } else {
        status = "partially_filled";
      }
    }

    const responseBody = {
      success: true,
      data: {
        orderId: orderInput.salt,
        matchesCount: result.matches.length,
        matches: result.matches.map((m) => ({
          matchId: m.id,
          matchedAmount: m.matchedAmount.toString(),
          matchedPrice: m.matchedPrice.toString(),
          makerFee: m.makerFee.toString(),
          takerFee: m.takerFee.toString(),
        })),
        remainingAmount: result.remainingOrder?.remainingAmount.toString() || "0",
        status,
        tif: orderInput.tif || null,
        postOnly: !!orderInput.postOnly,
        requestedAmount: orderInput.amount.toString(),
        filledAmount: filledAmount.toString(),
      },
    };
    logger.info("v2 order accepted", {
      requestId: (req as any).requestId || null,
      apiKeyId: (req as any).apiKeyId || null,
      marketKey: orderInput.marketKey,
      outcomeIndex: orderInput.outcomeIndex,
      maker: orderInput.maker,
      isBuy: orderInput.isBuy,
      amount: orderInput.amount.toString(),
      price: orderInput.price.toString(),
      status,
    });
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (e: any) {
    logger.error("v2 orders failed", { path: "/v2/orders" }, e);
    return sendApiError(req, res, 500, {
      message: "Order submission failed",
      detail: String(e?.message || e),
      errorCode: "INTERNAL_ERROR",
    });
  }
});

app.post(
  "/v2/cancel-salt",
  limitOrders,
  requireApiKey("orders", "v2_cancel_salt"),
  async (req, res) => {
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/v2/cancel-salt");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/v2/cancel-salt" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/v2/cancel-salt",
          });
          return;
        }
      }

      const idemKey = getIdempotencyKey(req, "/v2/cancel-salt");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }

      const parsed = CancelV2Schema.parse(req.body || {});
      const result = await matchingEngine.cancelOrder(
        parsed.marketKey,
        parsed.outcomeIndex,
        parsed.chainId,
        parsed.verifyingContract,
        parsed.maker,
        parsed.salt,
        parsed.signature,
        parsed.ownerEoa || undefined
      );
      if (!result.success) {
        const responseBody = sendApiError(req, res, 400, {
          message: result.error || "Cancel failed",
          errorCode: result.errorCode || "CANCEL_FAILED",
        });
        if (idemKey) void setIdempotencyEntry(idemKey, 400, responseBody);
        return;
      }
      const responseBody = { success: true, data: { ok: true } };
      logger.info("v2 cancel salt accepted", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        marketKey: parsed.marketKey,
        outcomeIndex: parsed.outcomeIndex,
        chainId: parsed.chainId,
        maker: parsed.maker,
        salt: parsed.salt,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        const responseBody = sendApiError(req, res, 400, {
          message: "cancel validation failed",
          detail: e.flatten(),
          errorCode: "VALIDATION_ERROR",
        });
        const idemKey = getIdempotencyKey(req, "/v2/cancel-salt");
        if (idemKey) void setIdempotencyEntry(idemKey, 400, responseBody);
        return;
      }
      const responseBody = sendApiError(req, res, 400, {
        message: "Cancel failed",
        detail: String(e?.message || e),
        errorCode: "CANCEL_FAILED",
      });
      const idemKey = getIdempotencyKey(req, "/v2/cancel-salt");
      if (idemKey) void setIdempotencyEntry(idemKey, 400, responseBody);
      return;
    }
  }
);

/**
 * GET /v2/depth - 获取订单簿深度 (从内存)
 * 比数据库查询快 10-100 倍
 */
app.get("/v2/depth", async (req, res) => {
  try {
    const parsed = V2DepthQuerySchema.parse({
      marketKey: req.query.marketKey || req.query.market_key,
      outcomeIndex: req.query.outcomeIndex ?? req.query.outcome_index ?? req.query.outcome ?? 0,
      levels: req.query.levels ?? 20,
    });
    const marketKey = parsed.marketKey;
    const outcomeIndex = parsed.outcomeIndex;
    const levels = parsed.levels;
    const microCacheMs = clampNumber(readIntEnv("RELAYER_MICROCACHE_MS", 200), 0, 1000);
    const roleKey =
      clusterIsActive && !getClusterManager().isLeader()
        ? "follower"
        : clusterIsActive
          ? "leader"
          : "standalone";
    const cacheKey = `${roleKey}:${marketKey}:${outcomeIndex}:${levels}`;
    const cached = microCacheGet(depthMicroCache, cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=1");
      return res.json(cached);
    }

    if (clusterIsActive) {
      const cluster = getClusterManager();
      const redis = getRedisClient();
      if (!cluster.isLeader() && redis.isReady()) {
        try {
          const snapshotService = getOrderbookSnapshotService();
          const pub = await snapshotService.loadPublicSnapshot(marketKey, outcomeIndex);
          if (pub) {
            const responseBody = {
              success: true,
              data: {
                marketKey,
                outcomeIndex,
                bids: pub.bids.slice(0, levels),
                asks: pub.asks.slice(0, levels),
                timestamp: pub.updatedAt || Date.now(),
                source: "redis_public_snapshot",
              },
            };
            res.setHeader("Cache-Control", "public, max-age=1");
            res.json(responseBody);
            microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
            return;
          }
          const loaded = await snapshotService.loadSnapshot(marketKey, outcomeIndex);
          if (loaded) {
            const bidLevels = new Map<string, { price: bigint; qty: bigint; count: number }>();
            const askLevels = new Map<string, { price: bigint; qty: bigint; count: number }>();

            for (const o of loaded.orders) {
              if (!o || o.remainingAmount <= 0n) continue;
              const key = o.price.toString();
              const map = o.isBuy ? bidLevels : askLevels;
              const existing = map.get(key);
              if (existing) {
                existing.qty += o.remainingAmount;
                existing.count += 1;
              } else {
                map.set(key, {
                  price: o.price,
                  qty: o.remainingAmount,
                  count: 1,
                });
              }
            }

            const bids = [...bidLevels.values()].sort((a, b) =>
              a.price > b.price ? -1 : a.price < b.price ? 1 : 0
            );
            const asks = [...askLevels.values()].sort((a, b) =>
              a.price < b.price ? -1 : a.price > b.price ? 1 : 0
            );

            res.setHeader("Cache-Control", "public, max-age=1");
            const responseBody = {
              success: true,
              data: {
                marketKey,
                outcomeIndex,
                bids: bids.slice(0, levels).map((l) => ({
                  price: l.price.toString(),
                  qty: l.qty.toString(),
                  count: l.count,
                })),
                asks: asks.slice(0, levels).map((l) => ({
                  price: l.price.toString(),
                  qty: l.qty.toString(),
                  count: l.count,
                })),
                timestamp: Date.now(),
                source: "redis_snapshot",
              },
            };
            res.json(responseBody);
            microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
            return;
          }
        } catch {}
      }
    }

    try {
      let snapshot = matchingEngine.getOrderBookSnapshot(marketKey, outcomeIndex, levels);
      if (!snapshot) {
        await matchingEngine.warmupOrderBook(marketKey, outcomeIndex);
        snapshot = matchingEngine.getOrderBookSnapshot(marketKey, outcomeIndex, levels);
      }

      if (!snapshot) {
        const responseBody = {
          success: true,
          data: { bids: [], asks: [], timestamp: Date.now() },
        };
        res.setHeader("Cache-Control", "public, max-age=1");
        res.json(responseBody);
        microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
        return;
      }

      const responseBody = {
        success: true,
        data: {
          marketKey: snapshot.marketKey,
          outcomeIndex: snapshot.outcomeIndex,
          bids: snapshot.bids.map((l) => ({
            price: l.price.toString(),
            qty: l.totalQuantity.toString(),
            count: l.orderCount,
          })),
          asks: snapshot.asks.map((l) => ({
            price: l.price.toString(),
            qty: l.totalQuantity.toString(),
            count: l.orderCount,
          })),
          timestamp: snapshot.timestamp,
        },
      };
      res.setHeader("Cache-Control", "public, max-age=1");
      res.json(responseBody);
      microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
      return;
    } catch {
      const responseBody = {
        success: true,
        data: { bids: [], asks: [], timestamp: Date.now() },
      };
      res.setHeader("Cache-Control", "public, max-age=1");
      res.json(responseBody);
      microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
      return;
    }
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "Depth query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "Depth query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

/**
 * GET /v2/stats - 获取订单簿统计
 */
app.get("/v2/stats", async (req, res) => {
  try {
    const parsed = V2StatsQuerySchema.parse({
      marketKey: req.query.marketKey || req.query.market_key,
      outcomeIndex: req.query.outcomeIndex ?? req.query.outcome_index ?? req.query.outcome ?? 0,
    });
    const marketKey = parsed.marketKey;
    const outcomeIndex = parsed.outcomeIndex;
    const microCacheMs = clampNumber(readIntEnv("RELAYER_MICROCACHE_MS", 200), 0, 1000);
    const roleKey =
      clusterIsActive && !getClusterManager().isLeader()
        ? "follower"
        : clusterIsActive
          ? "leader"
          : "standalone";
    const cacheKey = `${roleKey}:${marketKey}:${outcomeIndex}`;
    const cached = microCacheGet(statsMicroCache, cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=1");
      return res.json(cached);
    }

    if (clusterIsActive) {
      const cluster = getClusterManager();
      const redis = getRedisClient();
      if (!cluster.isLeader() && redis.isReady()) {
        try {
          const snapshotService = getOrderbookSnapshotService();
          const pub = await snapshotService.loadPublicSnapshot(marketKey, outcomeIndex);
          if (pub) {
            const responseBody = {
              success: true,
              data: {
                marketKey,
                outcomeIndex,
                bestBid: pub.bestBid,
                bestAsk: pub.bestAsk,
                spread: pub.spread,
                bidDepth: pub.bidDepth,
                askDepth: pub.askDepth,
                lastTradePrice: pub.lastTradePrice,
                volume24h: pub.volume24h,
                source: "redis_public_snapshot",
              },
            };
            res.setHeader("Cache-Control", "public, max-age=1");
            res.json(responseBody);
            microCacheSet(statsMicroCache, cacheKey, microCacheMs, responseBody, 500);
            return;
          }
          const loaded = await snapshotService.loadSnapshot(marketKey, outcomeIndex);
          if (loaded) {
            let bestBid: bigint | null = null;
            let bestAsk: bigint | null = null;
            let bidDepth = 0n;
            let askDepth = 0n;

            for (const o of loaded.orders) {
              if (!o || o.remainingAmount <= 0n) continue;
              if (o.isBuy) {
                bidDepth += o.remainingAmount;
                if (bestBid === null || o.price > bestBid) bestBid = o.price;
              } else {
                askDepth += o.remainingAmount;
                if (bestAsk === null || o.price < bestAsk) bestAsk = o.price;
              }
            }

            const lastTradePrice =
              typeof loaded.stats.lastTradePrice === "bigint" ? loaded.stats.lastTradePrice : null;
            const volume24h =
              typeof loaded.stats.volume24h === "bigint" ? loaded.stats.volume24h : 0n;
            const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

            res.setHeader("Cache-Control", "public, max-age=1");
            const responseBody = {
              success: true,
              data: {
                marketKey,
                outcomeIndex,
                bestBid: bestBid?.toString() || null,
                bestAsk: bestAsk?.toString() || null,
                spread: spread?.toString() || null,
                bidDepth: bidDepth.toString(),
                askDepth: askDepth.toString(),
                lastTradePrice: lastTradePrice?.toString() || null,
                volume24h: volume24h.toString(),
                source: "redis_snapshot",
              },
            };
            res.json(responseBody);
            microCacheSet(statsMicroCache, cacheKey, microCacheMs, responseBody, 500);
            return;
          }
        } catch {}
      }
    }

    let stats = matchingEngine.getOrderBookStats(marketKey, outcomeIndex);
    if (!stats) {
      try {
        await matchingEngine.warmupOrderBook(marketKey, outcomeIndex);
        stats = matchingEngine.getOrderBookStats(marketKey, outcomeIndex);
      } catch {}
    }

    if (!stats) {
      const responseBody = {
        success: true,
        data: {
          bestBid: null,
          bestAsk: null,
          spread: null,
          bidDepth: "0",
          askDepth: "0",
          lastTradePrice: null,
          volume24h: "0",
        },
      };
      res.setHeader("Cache-Control", "public, max-age=1");
      res.json(responseBody);
      microCacheSet(statsMicroCache, cacheKey, microCacheMs, responseBody, 500);
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=1");
    const responseBody = {
      success: true,
      data: {
        marketKey: stats.marketKey,
        outcomeIndex: stats.outcomeIndex,
        bestBid: stats.bestBid?.toString() || null,
        bestAsk: stats.bestAsk?.toString() || null,
        spread: stats.spread?.toString() || null,
        bidDepth: stats.bidDepth.toString(),
        askDepth: stats.askDepth.toString(),
        lastTradePrice: stats.lastTradePrice?.toString() || null,
        volume24h: stats.volume24h.toString(),
      },
    };
    res.json(responseBody);
    microCacheSet(statsMicroCache, cacheKey, microCacheMs, responseBody, 500);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "Stats query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "Stats query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

/**
 * GET /v2/ws-info - WebSocket 连接信息
 */
app.get("/v2/ws-info", (_req, res) => {
  const stats = wsServer ? (wsServer as any).getStats?.() : { connections: 0, subscriptions: 0 };
  const wsPort = clampNumber(readIntEnv("WS_PORT", 3006), 1, 65535);
  res.json({
    success: true,
    data: {
      wsPort,
      connections: stats.connections,
      subscriptions: stats.subscriptions,
      channels: [
        "depth:{marketKey}:{outcomeIndex}",
        "trades:{marketKey}:{outcomeIndex}",
        "stats:{marketKey}:{outcomeIndex}",
        "orders:{marketKey}:{outcomeIndex}",
      ],
    },
  });
});

/**
 * POST /v2/register-settler - 注册市场结算器
 * 由管理员调用,为市场配置 Operator
 */
app.post(
  "/v2/register-settler",
  limitOrders,
  requireApiKey("admin", "v2_register_settler"),
  async (req, res) => {
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/v2/register-settler");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/v2/register-settler" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/v2/register-settler",
          });
          return;
        }
      }

      const idemKey = getIdempotencyKey(req, "/v2/register-settler");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }

      const parsed = V2RegisterSettlerSchema.parse(req.body || {});

      // 从环境变量获取 Operator 配置
      const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.BUNDLER_PRIVATE_KEY;
      const rpcUrl = RPC_URL;

      if (!operatorKey) {
        return sendApiError(req, res, 500, {
          message: "Operator private key not configured",
          errorCode: "CONFIG_ERROR",
        });
      }

      const settler = matchingEngine.registerSettler(
        parsed.marketKey,
        parsed.chainId,
        parsed.marketAddress,
        operatorKey,
        rpcUrl
      );

      const responseBody = {
        success: true,
        data: {
          marketKey: parsed.marketKey,
          operatorAddress: settler.getOperatorAddress(),
          status: "registered",
        },
      };
      logger.info("settler registered", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        marketKey: parsed.marketKey,
        chainId: parsed.chainId,
        marketAddress: parsed.marketAddress,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return sendApiError(req, res, 400, {
          message: "register settler validation failed",
          detail: e.flatten(),
          errorCode: "VALIDATION_ERROR",
        });
      }
      logger.error("register settler failed", { path: "/v2/register-settler" }, e);
      return sendApiError(req, res, 500, {
        message: "Failed to register settler",
        detail: String(e?.message || e),
        errorCode: "INTERNAL_ERROR",
      });
    }
  }
);

/**
 * GET /v2/settlement-stats - 获取结算统计
 */
app.get("/v2/settlement-stats", (_req, res) => {
  const stats = matchingEngine.getSettlementStats();
  res.json({ success: true, data: stats });
});

/**
 * POST /v2/market/close - 关闭市场并清理订单簿
 */
app.post(
  "/v2/market/close",
  limitOrders,
  requireApiKey("admin", "v2_market_close"),
  async (req, res) => {
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/v2/market/close");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/v2/market/close" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/v2/market/close",
          });
          return;
        }
      }

      const idemKey = getIdempotencyKey(req, "/v2/market/close");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }

      const parsed = V2CloseMarketSchema.parse(req.body || {});
      const result = await matchingEngine.closeMarket(parsed.marketKey, {
        reason: parsed.reason,
      });

      const responseBody = { success: true, data: result };
      logger.info("market closed", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        marketKey: parsed.marketKey,
        outcomes: result.outcomes.length,
        canceledOrders: result.canceledOrders,
        clearedBooks: result.clearedBooks,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return sendApiError(req, res, 400, {
          message: "market close validation failed",
          detail: e.flatten(),
          errorCode: "VALIDATION_ERROR",
        });
      }
      logger.error("market close failed", { path: "/v2/market/close" }, e);
      return sendApiError(req, res, 500, {
        message: "Failed to close market",
        detail: String(e?.message || e),
        errorCode: "INTERNAL_ERROR",
      });
    }
  }
);

/**
 * GET /v2/operator-status - 获取 Operator 状态
 */
app.get("/v2/operator-status", async (req, res) => {
  try {
    const marketKey = z
      .string()
      .min(1)
      .parse(req.query.marketKey || "");
    const settler = matchingEngine.getSettler(marketKey);

    if (!settler) {
      return sendApiError(req, res, 404, {
        message: "Settler not found for this market",
        errorCode: "NOT_FOUND",
      });
    }

    const balance = await settler.getOperatorBalance();
    const stats = settler.getStats();

    res.json({
      success: true,
      data: {
        marketKey,
        operatorAddress: settler.getOperatorAddress(),
        balance,
        stats,
      },
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "operator status validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "Failed to get operator status",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

app.post(
  "/orderbook/cancel-salt",
  limitOrders,
  requireApiKey("orders", "orderbook_cancel_salt"),
  async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return sendApiError(req, res, 500, {
          message: "Supabase not configured",
          errorCode: "SUPABASE_NOT_CONFIGURED",
        });
      }
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/orderbook/cancel-salt");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/orderbook/cancel-salt" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/orderbook/cancel-salt",
          });
          return;
        }
      }
      const idemKey = getIdempotencyKey(req, "/orderbook/cancel-salt");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }
      const body = req.body || {};
      const data = await cancelSalt(body);
      const responseBody = { success: true, data };
      logger.info("orderbook cancel salt accepted", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      return sendApiError(req, res, 400, {
        message: "cancel salt failed",
        detail: String(e?.message || e),
        errorCode: "BAD_REQUEST",
      });
    }
  }
);

app.get("/orderbook/depth", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return sendApiError(req, res, 500, {
        message: "Supabase not configured",
        errorCode: "SUPABASE_NOT_CONFIGURED",
      });
    }
    const parsed = DepthQuerySchema.parse({
      contract: req.query.contract,
      chainId: req.query.chainId,
      outcome: req.query.outcome,
      side: req.query.side || "buy",
      levels: req.query.levels,
      marketKey: req.query.marketKey,
      market_key: req.query.market_key,
    });
    const isBuy = parsed.side === "buy";
    const marketKey =
      typeof parsed.marketKey === "string"
        ? parsed.marketKey
        : typeof parsed.market_key === "string"
          ? parsed.market_key
          : undefined;
    const data = await getDepth(
      parsed.contract,
      parsed.chainId as number,
      parsed.outcome as number,
      isBuy,
      parsed.levels as number,
      marketKey
    );
    res.setHeader("Cache-Control", "public, max-age=2");
    res.json({ success: true, data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "depth query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "depth query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

app.get("/orderbook/queue", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return sendApiError(req, res, 500, {
        message: "Supabase not configured",
        errorCode: "SUPABASE_NOT_CONFIGURED",
      });
    }
    const parsed = QueueQuerySchema.parse({
      contract: req.query.contract,
      chainId: req.query.chainId,
      outcome: req.query.outcome,
      side: req.query.side || "buy",
      price: req.query.price || "0",
      limit: req.query.limit,
      offset: req.query.offset,
      marketKey: req.query.marketKey,
      market_key: req.query.market_key,
    });
    const isBuy = parsed.side === "buy";
    const marketKey =
      typeof parsed.marketKey === "string"
        ? parsed.marketKey
        : typeof parsed.market_key === "string"
          ? parsed.market_key
          : undefined;
    const data = await getQueue(
      parsed.contract,
      parsed.chainId as number,
      parsed.outcome as number,
      isBuy,
      parsed.price,
      parsed.limit as number,
      parsed.offset as number,
      marketKey
    );
    res.setHeader("Cache-Control", "public, max-age=2");
    res.json({ success: true, data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "queue query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "queue query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

app.post(
  "/orderbook/report-trade",
  limitReportTrade,
  requireApiKey("report_trade", "orderbook_report_trade"),
  async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return sendApiError(req, res, 500, {
          message: "Supabase not configured",
          errorCode: "SUPABASE_NOT_CONFIGURED",
        });
      }
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/orderbook/report-trade");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/orderbook/report-trade" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/orderbook/report-trade",
          });
          return;
        }
      }
      const idemKey = getIdempotencyKey(req, "/orderbook/report-trade");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }
      const body = TradeReportSchema.parse(req.body || {});
      const data = await ingestTrade(body.chainId, body.txHash);
      const responseBody = { success: true, data };
      logger.info("orderbook trade reported", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        chainId: body.chainId,
        txHash: body.txHash,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      logger.error("orderbook report trade failed", { path: "/orderbook/report-trade" }, e);
      return sendApiError(req, res, 400, {
        message: "trade report failed",
        detail: String(e?.message || e),
        errorCode: "BAD_REQUEST",
      });
    }
  }
);

app.get("/orderbook/candles", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return sendApiError(req, res, 500, {
        message: "Supabase not configured",
        errorCode: "SUPABASE_NOT_CONFIGURED",
      });
    }
    const parsed = CandlesQuerySchema.parse({
      market: req.query.market,
      chainId: req.query.chainId,
      outcome: req.query.outcome,
      resolution: req.query.resolution || "15m",
      limit: req.query.limit,
    });
    const data = await getCandles(
      parsed.market,
      parsed.chainId as number,
      parsed.outcome as number,
      parsed.resolution,
      parsed.limit as number
    );
    res.setHeader("Cache-Control", "public, max-age=5");
    res.json({ success: true, data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "candles query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "candles query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

app.get("/orderbook/types", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ success: true, types: getOrderTypes() });
});

let marketSettlementTimer: NodeJS.Timeout | null = null;
const marketSettlementAttempts = new Map<
  string,
  {
    lastAssertAt?: number;
    lastSettleAt?: number;
    lastResolveAt?: number;
    lastOutcomeSetAt?: number;
  }
>();

async function startMarketSettlementLoop() {
  if (String(process.env.RELAYER_MARKET_SETTLEMENT_ENABLED || "").toLowerCase() === "false") return;
  if (!supabaseAdmin) {
    logger.warn("Market settlement loop disabled: Supabase not configured");
    return;
  }
  if (!provider) {
    logger.warn("Market settlement loop disabled: Provider not configured");
    return;
  }
  if (!OPERATOR_PRIVATE_KEY) {
    logger.warn("Market settlement loop disabled: OPERATOR_PRIVATE_KEY not configured");
    return;
  }

  const supabase = supabaseAdmin;
  const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);
  const pollMs = Math.max(10000, readIntEnv("RELAYER_MARKET_SETTLEMENT_POLL_MS", 60000));
  const cooldownMs = Math.max(10000, readIntEnv("RELAYER_MARKET_SETTLEMENT_COOLDOWN_MS", 60000));
  let running = false;

  if (marketSettlementTimer) {
    clearInterval(marketSettlementTimer);
    marketSettlementTimer = null;
  }

  const canAttempt = (
    key: string,
    field: "lastAssertAt" | "lastSettleAt" | "lastResolveAt" | "lastOutcomeSetAt"
  ) => {
    const now = Date.now();
    const record = marketSettlementAttempts.get(key) || {};
    const last = record[field] || 0;
    if (now - last < cooldownMs) return false;
    record[field] = now;
    marketSettlementAttempts.set(key, record);
    return true;
  };

  const loop = async () => {
    if (running) return;
    running = true;
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) return;
      }

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("markets_map")
        .select("event_id,chain_id,market,resolution_time,status")
        .in("status", ["open", "closed"])
        .not("resolution_time", "is", null)
        .lte("resolution_time", nowIso)
        .limit(200);

      if (error) {
        logger.warn("Market settlement loop query failed", { error: error.message });
        return;
      }
      if (!data || data.length === 0) return;

      for (const row of data as any[]) {
        const eventId = Number(row.event_id);
        const chainId = Number(row.chain_id);
        const marketAddress = String(row.market || "").toLowerCase();
        if (!Number.isFinite(eventId) || !Number.isFinite(chainId)) continue;
        if (!ethers.isAddress(marketAddress)) continue;
        if (chainId !== CHAIN_ID) continue;

        const marketKey = `${chainId}:${eventId}`;
        const marketContract = new Contract(marketAddress, OffchainMarketBaseABI, wallet);

        let marketStateNum = 0;
        try {
          const marketState = await marketContract.state();
          marketStateNum = Number(marketState);
        } catch (e: any) {
          logger.warn("Failed to read market state", {
            marketKey,
            error: String(e?.message || e),
          });
          continue;
        }
        if (marketStateNum === 1 || marketStateNum === 2) {
          const status = marketStateNum === 1 ? "resolved" : "invalidated";
          let resolvedOutcomeIndex: number | null = null;
          if (marketStateNum === 1) {
            try {
              const resolvedOutcome = await marketContract.resolvedOutcome();
              resolvedOutcomeIndex = parseOutcomeIndex(resolvedOutcome);
            } catch {}
          }
          await syncMarketResolution(marketAddress, status, resolvedOutcomeIndex);
          continue;
        }
        if (marketStateNum !== 0) continue;

        const { data: prediction, error: predictionError } = await supabase
          .from("predictions")
          .select("id,title,criteria,winning_outcome,status,outcome_count")
          .eq("id", eventId)
          .limit(1)
          .maybeSingle();

        if (predictionError || !prediction) continue;
        const winningRaw = prediction.winning_outcome;
        if (winningRaw === null || winningRaw === undefined) continue;
        const outcomeIndex = Number(winningRaw);
        if (!Number.isFinite(outcomeIndex) || outcomeIndex < 0) continue;
        const outcomeCount = Number(prediction.outcome_count || 0);
        if (Number.isFinite(outcomeCount) && outcomeCount > 0 && outcomeIndex >= outcomeCount)
          continue;

        let marketId: string;
        let oracleAddress: string;
        try {
          marketId = await marketContract.marketId();
          oracleAddress = await marketContract.oracle();
        } catch (e: any) {
          logger.warn("Failed to read market oracle info", {
            marketKey,
            error: String(e?.message || e),
          });
          continue;
        }
        if (!ethers.isAddress(oracleAddress)) continue;

        const { data: outcomeRow } = await supabase
          .from("prediction_outcomes")
          .select("label")
          .eq("prediction_id", eventId)
          .eq("outcome_index", outcomeIndex)
          .limit(1)
          .maybeSingle();

        const outcomeLabel = String(
          outcomeRow?.label || `Outcome ${Number.isFinite(outcomeIndex) ? outcomeIndex : "?"}`
        );
        const title = String(prediction.title || "");
        const criteria = String(prediction.criteria || "");
        const claim = `I assert outcome "${outcomeLabel}" for prediction ${eventId}${
          title ? ` (${title})` : ""
        }.${criteria ? ` Criteria: ${criteria}` : ""}`;
        const claimBytes = ethers.toUtf8Bytes(claim);

        const oracleContract = new Contract(oracleAddress, UMAOracleAdapterV2ABI, wallet);
        let oracleStatus: number | null = null;

        try {
          const status = await oracleContract.getMarketStatus(marketId);
          oracleStatus = Number(status?.[0]);
        } catch {}

        if (oracleStatus === null) {
          const manualOracle = new Contract(
            oracleAddress,
            [
              "function getOutcome(bytes32 marketId) view returns (uint256)",
              "function setOutcome(uint256 outcome) external",
            ],
            wallet
          );
          let hasOutcome = false;
          try {
            const currentOutcome = await manualOracle.getOutcome(marketId);
            hasOutcome = Number(currentOutcome) === outcomeIndex;
          } catch {}
          if (!hasOutcome && canAttempt(marketKey, "lastOutcomeSetAt")) {
            try {
              const tx = await manualOracle.setOutcome(outcomeIndex);
              await tx.wait();
            } catch (e: any) {
              logger.warn("Manual oracle setOutcome failed", {
                marketKey,
                error: String(e?.message || e),
              });
              continue;
            }
          }
          if (canAttempt(marketKey, "lastResolveAt")) {
            try {
              const tx = await marketContract.resolve();
              await tx.wait();
            } catch (e: any) {
              logger.warn("Market resolve failed", {
                marketKey,
                error: String(e?.message || e),
              });
            }
          }
          continue;
        }

        if (oracleStatus === 0 && canAttempt(marketKey, "lastAssertAt")) {
          try {
            const tx = await oracleContract.requestOutcome(marketId, outcomeIndex, claimBytes);
            await tx.wait();
            continue;
          } catch (e: any) {
            logger.warn("Oracle requestOutcome failed", {
              marketKey,
              error: String(e?.message || e),
            });
          }
        }

        if (oracleStatus === 1 && canAttempt(marketKey, "lastSettleAt")) {
          try {
            const tx = await oracleContract.settleOutcome(marketId);
            await tx.wait();
          } catch (e: any) {
            logger.warn("Oracle settleOutcome failed", {
              marketKey,
              error: String(e?.message || e),
            });
          }
        }

        if ((oracleStatus === 2 || oracleStatus === 3) && canAttempt(marketKey, "lastResolveAt")) {
          try {
            const tx = await marketContract.resolve();
            await tx.wait();
          } catch (e: any) {
            logger.warn("Market resolve failed", {
              marketKey,
              error: String(e?.message || e),
            });
          }
        }
      }
    } catch (e: any) {
      logger.warn("Market settlement loop failed", { error: String(e?.message || e) });
    } finally {
      running = false;
    }
  };

  await loop();
  marketSettlementTimer = setInterval(loop, pollMs);
  logger.info("Market settlement loop enabled", { pollMs });
}

const backgroundLoops = createBackgroundLoops({
  logger,
  matchingEngine,
  provider,
  isClusterActive: () => clusterIsActive,
});

startRelayerServer({
  app,
  port: PORT,
  logger,
  matchingEngine,
  provider,
  initContractListener,
  startMarketExpiryLoop: backgroundLoops.startMarketExpiryLoop,
  startAutoIngestLoop: backgroundLoops.startAutoIngestLoop,
  setChaosInstance: (instance) => {
    chaosInstance = instance;
  },
  setWsServer: (server) => {
    wsServer = server;
  },
  setClusterIsActive: (active) => {
    clusterIsActive = active;
  },
  getClusterIsActive: () => clusterIsActive,
});

registerGracefulShutdown({
  logger,
  stopChainReconciler: async () => {
    await closeChainReconciler();
  },
  stopBalanceChecker: async () => {
    await closeBalanceChecker();
  },
  stopContractEventListener: async () => {
    await closeContractEventListener();
  },
  stopChaosEngineering: async () => {
    if (!chaosInstance) return;
    const { closeChaosEngineering } = await import("./chaos/chaosInit.js");
    await closeChaosEngineering(chaosInstance);
    chaosInstance = null;
  },
  stopClusterManager: async () => {
    await closeClusterManager();
  },
  stopSnapshotService: async () => {
    const snapshotService = getOrderbookSnapshotService();
    await snapshotService.shutdown();
  },
  stopMatchingEngine: async () => {
    await matchingEngine.shutdown();
  },
  stopWebSocket: async () => {
    if (wsServer) {
      await Promise.resolve(wsServer.stop());
    }
  },
  stopAutoIngest: backgroundLoops.stopAutoIngestLoop,
  stopMetrics: () => {
    stopMetricsTimers();
  },
  stopRateLimiter: () => {
    closeRateLimiter();
  },
  stopRedis: async () => {
    await closeRedis();
  },
  stopDatabasePool: async () => {
    await closeDatabasePool();
  },
});

export default app;
