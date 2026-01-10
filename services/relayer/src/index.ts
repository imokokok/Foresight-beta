import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });

// 🚀 Phase 1: 导入监控和日志模块
import { logger, matchingLogger } from "./monitoring/logger.js";
import {
  ordersTotal,
  matchesTotal,
  matchingLatency,
  matchedVolumeTotal,
  wsConnectionsActive,
  wsSubscriptionsActive,
  stopMetricsTimers,
} from "./monitoring/metrics.js";
import {
  healthService,
  createSupabaseHealthChecker,
  createRedisHealthChecker,
  createRpcHealthChecker,
  createMatchingEngineHealthChecker,
  createOrderbookReadinessChecker,
  createWriteProxyReadinessChecker,
} from "./monitoring/health.js";
import { initRedis, closeRedis, getRedisClient } from "./redis/client.js";
import { getOrderbookSnapshotService } from "./redis/orderbookSnapshot.js";
import { closeRateLimiter } from "./ratelimit/index.js";
import { healthRoutes, clusterRoutes } from "./routes/index.js";
import {
  metricsMiddleware,
  requestIdMiddleware,
  requestLoggerMiddleware,
} from "./middleware/index.js";

// 🚀 Phase 2: 导入集群和高可用模块
import { initClusterManager, closeClusterManager, getClusterManager } from "./cluster/index.js";
import { initDatabasePool, closeDatabasePool } from "./database/index.js";
import { initChainReconciler, closeChainReconciler } from "./reconciliation/index.js";

let clusterIsActive = false;

// 环境变量校验与读取
const EnvSchema = z.object({
  BUNDLER_PRIVATE_KEY: z
    .preprocess(
      (v) => {
        const s = typeof v === "string" ? v : "";
        if (/^[0-9a-fA-F]{64}$/.test(s)) return "0x" + s;
        return s;
      },
      z.string().regex(/^0x[0-9a-fA-F]{64}$/)
    )
    .optional(),
  RPC_URL: z.string().url().optional(),
  RELAYER_PORT: z
    .preprocess(
      (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v),
      z.number().int().positive()
    )
    .optional(),
  PORT: z
    .preprocess(
      (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v),
      z.number().int().positive()
    )
    .optional(),
});

const rawPriv = process.env.BUNDLER_PRIVATE_KEY || process.env.PRIVATE_KEY;
const privStr = typeof rawPriv === "string" ? rawPriv.trim() : "";
const maybePriv =
  /^[0-9a-fA-F]{64}$/.test(privStr) || /^0x[0-9a-fA-F]{64}$/.test(privStr) ? privStr : undefined;
const rawEnv = {
  BUNDLER_PRIVATE_KEY: maybePriv,
  RPC_URL: process.env.RPC_URL,
  RELAYER_PORT: process.env.RELAYER_PORT,
  PORT: process.env.PORT,
};

const parsed = EnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  console.warn("Relayer config invalid, bundler disabled:", parsed.error.flatten().fieldErrors);
}

export const BUNDLER_PRIVATE_KEY = parsed.success ? parsed.data.BUNDLER_PRIVATE_KEY : undefined;
export const RPC_URL =
  (parsed.success ? parsed.data.RPC_URL : undefined) || "http://127.0.0.1:8545";
export const RELAYER_PORT =
  (parsed.success ? (parsed.data.RELAYER_PORT ?? parsed.data.PORT) : undefined) ?? 3000;
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
  ingestTradesByLogs,
  getCandles,
} from "./orderbook.js";

// 🚀 导入新的撮合引擎
import { MatchingEngine, MarketWebSocketServer, type OrderInput } from "./matching/index.js";
import { clusterFollowerRejectedTotal } from "./monitoring/metrics.js";
import { proxyToLeader } from "./cluster/leaderProxy.js";
import { ClusteredWebSocketServer } from "./cluster/websocketCluster.js";

export const app = express();

// 🚀 初始化撮合引擎和 WebSocket 服务器
const matchingEngine = new MatchingEngine({
  makerFeeBps: Number(process.env.MAKER_FEE_BPS || "0"),
  takerFeeBps: Number(process.env.TAKER_FEE_BPS || "0"),
  maxMarketLongExposureUsdc: Number(process.env.RELAYER_MAX_MARKET_LONG_EXPOSURE_USDC || "0"),
  maxMarketShortExposureUsdc: Number(process.env.RELAYER_MAX_MARKET_SHORT_EXPOSURE_USDC || "0"),
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
    matchesTotal.inc({ market_key: trade.marketKey, outcome_index: String(trade.outcomeIndex) });
    const volumeBigInt = (trade.amount * trade.price) / 1_000_000_000_000_000_000n;
    const volume = Number(volumeBigInt) / 1000000;
    matchedVolumeTotal.inc(
      { market_key: trade.marketKey, outcome_index: String(trade.outcomeIndex) },
      volume
    );
  }
);

// 🚀 连接结算事件
matchingEngine.on("settlement_event", (event) => {
  logger.info("Settlement event", { type: event.type, ...event });
});

type RateLimitBucket = {
  count: number;
  windowStart: number;
};

function createRateLimiter(envPrefix: string, defaultMax: number, defaultWindowMs: number) {
  const max = Math.max(1, Number(process.env[`${envPrefix}_MAX`] || String(defaultMax)));
  const windowMs = Math.max(
    100,
    Number(process.env[`${envPrefix}_WINDOW_MS`] || String(defaultWindowMs))
  );
  const buckets = new Map<string, RateLimitBucket>();
  return function rateLimit(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const ip = (req.ip || "").toString() || "unknown";
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(ip, { count: 1, windowStart: now });
      return next();
    }
    if (bucket.count < max) {
      bucket.count += 1;
      return next();
    }
    res.status(429).json({ success: false, message: "Too many requests" });
  };
}

const limitOrders = createRateLimiter("RELAYER_RATE_LIMIT_ORDERS", 30, 60000);
const limitReportTrade = createRateLimiter("RELAYER_RATE_LIMIT_REPORT_TRADE", 60, 60000);

type IdempotencyEntry = {
  expiresAtMs: number;
  status: number;
  body: any;
};

const idempotencyStore = new Map<string, IdempotencyEntry>();

function getIdempotencyKey(req: express.Request, extra: string): string | null {
  const headerKey = String(req.headers["x-idempotency-key"] || "").trim();
  const requestId = String(req.headers["x-request-id"] || (req as any).requestId || "").trim();
  const base = headerKey || requestId;
  if (!base) return null;
  return `${req.method}:${extra}:${base}`;
}

function getIdempotencyRedisKey(key: string): string {
  return `idempotency:${key}`;
}

async function getIdempotencyEntry(key: string): Promise<IdempotencyEntry | null> {
  const entry = idempotencyStore.get(key);
  if (entry) {
    if (entry.expiresAtMs <= Date.now()) {
      idempotencyStore.delete(key);
    } else {
      return entry;
    }
  }

  if (process.env.RELAYER_IDEMPOTENCY_REDIS === "false") return null;

  const redis = getRedisClient();
  if (!redis.isReady()) return null;

  const raw = await redis.get(getIdempotencyRedisKey(key));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IdempotencyEntry;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.expiresAtMs !== "number" ||
      typeof parsed.status !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAtMs <= Date.now()) return null;
    idempotencyStore.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function setIdempotencyEntry(key: string, status: number, body: any): Promise<void> {
  const ttlMs = Math.max(1000, Number(process.env.RELAYER_IDEMPOTENCY_TTL_MS || "60000"));
  const entry: IdempotencyEntry = { expiresAtMs: Date.now() + ttlMs, status, body };
  idempotencyStore.set(key, entry);
  if (idempotencyStore.size > 5000) {
    const now = Date.now();
    for (const [k, v] of idempotencyStore.entries()) {
      if (v.expiresAtMs <= now) idempotencyStore.delete(k);
    }
  }

  if (process.env.RELAYER_IDEMPOTENCY_REDIS === "false") return;
  const redis = getRedisClient();
  if (!redis.isReady()) return;

  const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
  try {
    await redis.set(getIdempotencyRedisKey(key), JSON.stringify(entry), ttlSeconds);
  } catch {}
}

function getLeaderProxyUrl(): string {
  return String(
    process.env.RELAYER_LEADER_PROXY_URL || process.env.RELAYER_LEADER_URL || ""
  ).trim();
}

function sendNotLeader(
  res: express.Response,
  payload: { leaderId: string | null; nodeId?: string; path: string }
) {
  const proxyUrl = getLeaderProxyUrl();
  res.status(503).json({
    success: false,
    message: "Not leader",
    leaderId: payload.leaderId,
    nodeId: payload.nodeId || null,
    path: payload.path,
    retryable: true,
    suggestedWaitMs: 1000,
    proxyUrlConfigured: !!proxyUrl,
  });
}

function sendApiError(
  req: express.Request,
  res: express.Response,
  status: number,
  payload: { message: string; detail?: any }
) {
  const requestId = String(req.headers["x-request-id"] || (req as any).requestId || "").trim();
  return res.status(status).json({
    success: false,
    message: payload.message,
    ...(typeof payload.detail !== "undefined" ? { detail: payload.detail } : {}),
    ...(requestId ? { requestId } : {}),
  });
}

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

app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.send("Foresight Relayer is running!");
});

app.post("/", async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await cluster.getLeaderId().catch(() => null);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/");
          if (ok) return;
        }
        sendNotLeader(res, { leaderId, nodeId: cluster.getNodeId(), path: "/" });
        return;
      }
    }
    const idemKey = getIdempotencyKey(req, "/");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }
    if (!bundlerWallet) {
      return res.status(501).json({
        jsonrpc: "2.0",
        id: req.body?.id,
        error: { code: -32601, message: "Bundler disabled" },
      });
    }
    const { userOp, entryPointAddress } = req.body;
    if (!userOp || !entryPointAddress) {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: { code: -32602, message: "Invalid params" },
      });
    }
    const entryPoint = new Contract(entryPointAddress, EntryPointAbi, bundlerWallet);
    const tx = await entryPoint.handleOps([userOp], bundlerWallet.address);
    const receipt = await tx.wait();
    const responseBody = { jsonrpc: "2.0", id: req.body.id, result: receipt.hash };
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (error: any) {
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body.id,
      error: { code: -32602, message: "Internal error", data: error.message },
    });
  }
});

// Off-chain orderbook API (legacy - 保留兼容)
app.post("/orderbook/orders", limitOrders, async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await cluster.getLeaderId().catch(() => null);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/orderbook/orders");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/orderbook/orders" });
        sendNotLeader(res, { leaderId, nodeId: cluster.getNodeId(), path: "/orderbook/orders" });
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
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (e: any) {
    return sendApiError(req, res, 400, {
      message: "place order failed",
      detail: String(e?.message || e),
    });
  }
});

// ============================================================
// 🚀 新撮合引擎 API v2 - 高性能链下撮合
// ============================================================

/**
 * POST /v2/orders - 提交订单并撮合
 * 新的撮合引擎入口，支持即时撮合
 */
app.post("/v2/orders", limitOrders, async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await cluster.getLeaderId().catch(() => null);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/v2/orders");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/v2/orders" });
        sendNotLeader(res, { leaderId, nodeId: cluster.getNodeId(), path: "/v2/orders" });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/v2/orders");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    const body = req.body || {};
    const orderBody = body.order || body.order_data || {};

    // 构建订单输入
    const orderInput: OrderInput = {
      marketKey:
        body.marketKey ||
        body.market_key ||
        `${body.chainId || body.chain_id}:${body.eventId || body.event_id || "unknown"}`,
      maker: String(orderBody?.maker || body.maker || ""),
      outcomeIndex: Number(
        orderBody?.outcomeIndex ?? orderBody?.outcome_index ?? body.outcomeIndex ?? 0
      ),
      isBuy: Boolean(orderBody?.isBuy ?? orderBody?.is_buy ?? body.isBuy),
      price: BigInt(String(orderBody?.price ?? body.price ?? "0")),
      amount: BigInt(String(orderBody?.amount ?? body.amount ?? "0")),
      salt: String(orderBody?.salt || body.salt || ""),
      expiry: Number(orderBody?.expiry ?? orderBody?.expiresAt ?? body.expiry ?? 0),
      signature: String(body.signature || orderBody?.signature || ""),
      chainId: Number(
        body.chainId || body.chain_id || orderBody?.chainId || orderBody?.chain_id || 0
      ),
      verifyingContract: String(
        body.verifyingContract ||
          orderBody?.verifyingContract ||
          body.verifying_contract ||
          orderBody?.verifying_contract ||
          body.verifying_contract_address ||
          orderBody?.verifying_contract_address ||
          body.contract ||
          orderBody?.contract ||
          body.contractAddress ||
          orderBody?.contractAddress ||
          body.marketAddress ||
          orderBody?.marketAddress ||
          ""
      ),
      tif: (orderBody?.tif as "IOC" | "FOK" | undefined) ?? undefined,
      postOnly: Boolean(orderBody?.postOnly ?? orderBody?.post_only),
    };

    // 提交到撮合引擎
    const result = await matchingEngine.submitOrder(orderInput);

    if (!result.success) {
      return sendApiError(req, res, 400, {
        message: result.error || "Order submission failed",
      });
    }

    const filledAmount = result.matches.reduce<bigint>((acc, m) => acc + m.matchedAmount, 0n);

    let status: string;
    if (orderInput.tif === "FOK") {
      status = filledAmount === orderInput.amount ? "filled" : "canceled";
    } else if (orderInput.tif === "IOC") {
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
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (e: any) {
    console.error("[v2/orders] Error:", e);
    return sendApiError(req, res, 400, {
      message: "Order submission failed",
      detail: String(e?.message || e),
    });
  }
});

const CancelV2Schema = z
  .object({
    marketKey: z.string().min(1),
    outcomeIndex: z
      .preprocess(
        (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
        z.number().int().min(0)
      )
      .optional(),
    outcome_index: z
      .preprocess(
        (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
        z.number().int().min(0)
      )
      .optional(),
    chainId: z.preprocess(
      (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
      z.number().int().positive()
    ),
    verifyingContract: z.string().optional(),
    verifying_contract: z.string().optional(),
    verifying_contract_address: z.string().optional(),
    contract: z.string().optional(),
    contractAddress: z.string().optional(),
    maker: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    salt: z.preprocess((v) => (typeof v === "string" ? v : String(v)), z.string().min(1)),
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  })
  .refine((v) => typeof v.outcomeIndex === "number" || typeof v.outcome_index === "number", {
    message: "outcomeIndex is required",
    path: ["outcomeIndex"],
  })
  .transform((v) => ({
    marketKey: v.marketKey,
    outcomeIndex: (v.outcomeIndex ?? v.outcome_index) as number,
    chainId: v.chainId,
    verifyingContract:
      v.verifyingContract ||
      v.verifying_contract ||
      v.verifying_contract_address ||
      v.contract ||
      v.contractAddress ||
      "",
    maker: v.maker,
    salt: v.salt,
    signature: v.signature,
  }))
  .refine((v) => /^0x[0-9a-fA-F]{40}$/.test(v.verifyingContract), {
    message: "Invalid verifyingContract",
    path: ["verifyingContract"],
  });

app.post("/v2/cancel-salt", limitOrders, async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await cluster.getLeaderId().catch(() => null);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/v2/cancel-salt");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/v2/cancel-salt" });
        sendNotLeader(res, { leaderId, nodeId: cluster.getNodeId(), path: "/v2/cancel-salt" });
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
      parsed.signature
    );
    if (!result.success) {
      const responseBody = {
        success: false,
        message: result.error || "Cancel failed",
      };
      res.status(400).json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 400, responseBody);
      return;
    }
    const responseBody = { success: true, data: { ok: true } };
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "cancel validation failed",
        detail: e.flatten(),
      });
    }
    return sendApiError(req, res, 400, {
      message: "Cancel failed",
      detail: String(e?.message || e),
    });
  }
});

/**
 * GET /v2/depth - 获取订单簿深度 (从内存)
 * 比数据库查询快 10-100 倍
 */
app.get("/v2/depth", async (req, res) => {
  try {
    const marketKey = String(req.query.marketKey || req.query.market_key || "");
    const outcomeIndex = Number(req.query.outcome || 0);
    const levels = Math.min(50, Math.max(1, Number(req.query.levels || 20)));

    if (!marketKey) {
      return res.status(400).json({ success: false, message: "marketKey required" });
    }

    if (clusterIsActive) {
      const cluster = getClusterManager();
      const redis = getRedisClient();
      if (!cluster.isLeader() && redis.isReady()) {
        try {
          const snapshotService = getOrderbookSnapshotService();
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
                map.set(key, { price: o.price, qty: o.remainingAmount, count: 1 });
              }
            }

            const bids = [...bidLevels.values()].sort((a, b) =>
              a.price > b.price ? -1 : a.price < b.price ? 1 : 0
            );
            const asks = [...askLevels.values()].sort((a, b) =>
              a.price < b.price ? -1 : a.price > b.price ? 1 : 0
            );

            res.setHeader("Cache-Control", "public, max-age=1");
            return res.json({
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
            });
          }
        } catch {}
      }
    }

    try {
      await matchingEngine.warmupOrderBook(marketKey, outcomeIndex);
    } catch {}

    const snapshot = matchingEngine.getOrderBookSnapshot(marketKey, outcomeIndex, levels);

    if (!snapshot) {
      return res.json({
        success: true,
        data: { bids: [], asks: [], timestamp: Date.now() },
      });
    }

    res.setHeader("Cache-Control", "public, max-age=1");
    res.json({
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
    });
  } catch (e: any) {
    res.status(400).json({
      success: false,
      message: "Depth query failed",
      detail: String(e?.message || e),
    });
  }
});

/**
 * GET /v2/stats - 获取订单簿统计
 */
app.get("/v2/stats", async (req, res) => {
  try {
    const marketKey = String(req.query.marketKey || req.query.market_key || "");
    const outcomeIndex = Number(req.query.outcome || 0);

    if (!marketKey) {
      return res.status(400).json({ success: false, message: "marketKey required" });
    }

    if (clusterIsActive) {
      const cluster = getClusterManager();
      const redis = getRedisClient();
      if (!cluster.isLeader() && redis.isReady()) {
        try {
          const snapshotService = getOrderbookSnapshotService();
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
            return res.json({
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
            });
          }
        } catch {}
      }
    }

    const stats = matchingEngine.getOrderBookStats(marketKey, outcomeIndex);

    if (!stats) {
      return res.json({
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
      });
    }

    res.setHeader("Cache-Control", "public, max-age=1");
    res.json({
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
    });
  } catch (e: any) {
    res.status(400).json({
      success: false,
      message: "Stats query failed",
      detail: String(e?.message || e),
    });
  }
});

/**
 * GET /v2/ws-info - WebSocket 连接信息
 */
app.get("/v2/ws-info", (req, res) => {
  const stats = wsServer ? (wsServer as any).getStats?.() : { connections: 0, subscriptions: 0 };
  res.json({
    success: true,
    data: {
      wsPort: Number(process.env.WS_PORT || "3006"),
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
app.post("/v2/register-settler", async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await cluster.getLeaderId().catch(() => null);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/v2/register-settler");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/v2/register-settler" });
        sendNotLeader(res, { leaderId, nodeId: cluster.getNodeId(), path: "/v2/register-settler" });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/v2/register-settler");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    const { marketKey, chainId, marketAddress } = req.body;

    // 验证必要参数
    if (!marketKey || !chainId || !marketAddress) {
      return sendApiError(req, res, 400, {
        message: "Missing required fields: marketKey, chainId, marketAddress",
      });
    }

    // 从环境变量获取 Operator 配置
    const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.BUNDLER_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";

    if (!operatorKey) {
      return sendApiError(req, res, 500, { message: "Operator private key not configured" });
    }

    const settler = matchingEngine.registerSettler(
      marketKey,
      Number(chainId),
      marketAddress,
      operatorKey,
      rpcUrl
    );

    const responseBody = {
      success: true,
      data: {
        marketKey,
        operatorAddress: settler.getOperatorAddress(),
        status: "registered",
      },
    };
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (e: any) {
    return sendApiError(req, res, 400, {
      message: "Failed to register settler",
      detail: String(e?.message || e),
    });
  }
});

/**
 * GET /v2/settlement-stats - 获取结算统计
 */
app.get("/v2/settlement-stats", (req, res) => {
  const stats = matchingEngine.getSettlementStats();
  res.json({ success: true, data: stats });
});

/**
 * GET /v2/operator-status - 获取 Operator 状态
 */
app.get("/v2/operator-status", async (req, res) => {
  try {
    const marketKey = String(req.query.marketKey || "");
    const settler = matchingEngine.getSettler(marketKey);

    if (!settler) {
      return res.status(404).json({
        success: false,
        message: "Settler not found for this market",
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
    res.status(400).json({
      success: false,
      message: "Failed to get operator status",
      detail: String(e?.message || e),
    });
  }
});

app.post("/orderbook/cancel-salt", async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await cluster.getLeaderId().catch(() => null);
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
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (e: any) {
    return sendApiError(req, res, 400, {
      message: "cancel salt failed",
      detail: String(e?.message || e),
    });
  }
});

const DepthQuerySchema = z.object({
  contract: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((v) => v.toLowerCase()),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  side: z
    .string()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "buy" || v === "sell", {
      message: "side must be buy or sell",
    }),
  levels: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 10;
    return Math.max(1, Math.min(50, n));
  }, z.number().int().min(1).max(50)),
  marketKey: z.string().optional(),
  market_key: z.string().optional(),
});

const QueueQuerySchema = z.object({
  contract: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((v) => v.toLowerCase()),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  side: z
    .string()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "buy" || v === "sell", {
      message: "side must be buy or sell",
    }),
  price: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? BigInt(String(v)) : v),
    z.bigint()
  ),
  limit: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(200, n));
  }, z.number().int().min(1).max(200)),
  offset: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  }, z.number().int().min(0)),
  marketKey: z.string().optional(),
  market_key: z.string().optional(),
});

const CandlesQuerySchema = z.object({
  market: z.string(),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  resolution: z.string().default("15m"),
  limit: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 100;
    return Math.max(1, Math.min(1000, n));
  }, z.number().int().min(1).max(1000)),
});

const TradeReportSchema = z.object({
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

app.get("/orderbook/depth", async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
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
      return res.status(400).json({
        success: false,
        message: "depth query validation failed",
        detail: e.flatten(),
      });
    }
    res
      .status(400)
      .json({ success: false, message: "depth query failed", detail: String(e?.message || e) });
  }
});

app.get("/orderbook/queue", async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
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
      return res.status(400).json({
        success: false,
        message: "queue query validation failed",
        detail: e.flatten(),
      });
    }
    res
      .status(400)
      .json({ success: false, message: "queue query failed", detail: String(e?.message || e) });
  }
});

app.post("/orderbook/report-trade", limitReportTrade, async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await cluster.getLeaderId().catch(() => null);
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
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (e: any) {
    console.error(e);
    return sendApiError(req, res, 400, {
      message: "trade report failed",
      detail: String(e?.message || e),
    });
  }
});

app.get("/orderbook/candles", async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
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
      return res.status(400).json({
        success: false,
        message: "candles query validation failed",
        detail: e.flatten(),
      });
    }
    res.status(400).json({
      success: false,
      message: "candles query failed",
      detail: String(e?.message || e),
    });
  }
});

app.get("/orderbook/types", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ success: true, types: getOrderTypes() });
});

/**
 * Optional: background indexer to ingest trades automatically (no need to call /report-trade manually).
 * Enabled via RELAYER_AUTO_INGEST=1 and requires RPC_URL + SUPABASE service role key.
 *
 * Implementation strategy:
 * - This minimal version watches recent blocks and ingests any tx that contains OrderFilledSigned.
 * - It is conservative and idempotent because SQL function `ingest_trade_event` is idempotent.
 *
 * NOTE: For production, persist lastProcessedBlock (e.g. in Supabase) and use getLogs by topic.
 */
let autoIngestTimer: NodeJS.Timeout | null = null;

async function startAutoIngestLoop() {
  if (process.env.RELAYER_AUTO_INGEST !== "1") return;
  if (!supabaseAdmin) {
    console.warn("[auto-ingest] Supabase not configured, disabled");
    return;
  }
  if (!provider) {
    console.warn("[auto-ingest] Provider not configured (RPC_URL), disabled");
    return;
  }

  let chainId: number;
  try {
    const net = await provider.getNetwork();
    chainId = Number(net.chainId);
  } catch (e: any) {
    console.warn("[auto-ingest] failed to get network:", String(e?.message || e));
    return;
  }

  const cursorKey = "order_filled_signed";
  const configuredFrom = Number(process.env.RELAYER_AUTO_INGEST_FROM_BLOCK || "0") || 0;
  const lookback = Math.max(0, Number(process.env.RELAYER_AUTO_INGEST_REORG_LOOKBACK || "20"));
  let last = 0;
  const confirmations = Math.max(0, Number(process.env.RELAYER_AUTO_INGEST_CONFIRMATIONS || "1"));
  const pollMs = Math.max(2000, Number(process.env.RELAYER_AUTO_INGEST_POLL_MS || "5000"));
  const maxConcurrent = Math.max(1, Number(process.env.RELAYER_AUTO_INGEST_CONCURRENCY || "3"));

  if (autoIngestTimer) {
    clearInterval(autoIngestTimer);
    autoIngestTimer = null;
  }

  const loadCursor = async (): Promise<number> => {
    try {
      const { data, error } = await supabaseAdmin!
        .from("relayer_ingest_cursors")
        .select("last_processed_block")
        .eq("chain_id", chainId)
        .eq("cursor_key", cursorKey)
        .maybeSingle();
      if (error) {
        const code = (error as any).code;
        if (code === "42P01" || code === "42703") return 0;
        console.warn("[auto-ingest] cursor load error:", String(error.message || error));
        return 0;
      }
      const raw = (data as any)?.last_processed_block;
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch (e: any) {
      console.warn("[auto-ingest] cursor load exception:", String(e?.message || e));
      return 0;
    }
  };

  const saveCursor = async (blockNumber: number): Promise<void> => {
    try {
      const { error } = await supabaseAdmin!.from("relayer_ingest_cursors").upsert(
        {
          chain_id: chainId,
          cursor_key: cursorKey,
          last_processed_block: blockNumber,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "chain_id,cursor_key" }
      );
      if (error) {
        const code = (error as any).code;
        if (code === "42P01" || code === "42703") return;
        console.warn("[auto-ingest] cursor save error:", String(error.message || error));
      }
    } catch (e: any) {
      console.warn("[auto-ingest] cursor save exception:", String(e?.message || e));
    }
  };

  const persistedLast = await loadCursor();
  if (configuredFrom > 0) {
    last = configuredFrom;
  } else {
    last = persistedLast > 0 ? Math.max(0, persistedLast - lookback) : 0;
  }

  const loop = async () => {
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) return;
      }

      const head = await provider!.getBlockNumber();
      const target = Math.max(0, head - confirmations);
      if (last === 0) last = target;
      if (target <= last) return;

      const maxStep = Math.max(1, Number(process.env.RELAYER_AUTO_INGEST_MAX_STEP || "20"));
      const to = Math.min(target, last + maxStep);

      const fromBlock = last + 1;
      if (fromBlock > to) return;

      const startTime = Date.now();
      let totalIngested = 0;
      let processedTo = last;
      for (let b = fromBlock; b <= to; b++) {
        try {
          const r = await ingestTradesByLogs(chainId, b, b, maxConcurrent);
          totalIngested += r.ingestedCount || 0;
          processedTo = b;
          last = processedTo;
          await saveCursor(processedTo);
        } catch (e: any) {
          console.warn(
            "[auto-ingest] ingestTradesByLogs error:",
            String(e?.message || e),
            chainId,
            b
          );
          break;
        }
      }
      const duration = Date.now() - startTime;
      console.log(
        "[auto-ingest] window",
        fromBlock,
        "to",
        to,
        "events",
        totalIngested,
        "durationMs",
        duration
      );
    } catch (e: any) {
      console.warn("[auto-ingest] loop error:", String(e?.message || e));
    }
  };

  // initial tick + interval
  await loop();
  autoIngestTimer = setInterval(loop, pollMs);
  console.log("[auto-ingest] enabled");
}

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, async () => {
    logger.info("Relayer server starting", { port: PORT });

    // 🚀 Phase 1: 初始化 Redis
    const redisEnabled = process.env.REDIS_ENABLED !== "false";
    if (redisEnabled) {
      try {
        const connected = await initRedis();
        if (connected) {
          logger.info("Redis connected successfully");
          // 启动订单簿快照同步
          const snapshotService = getOrderbookSnapshotService();
          snapshotService.startSync(5000);
        } else {
          logger.warn("Redis connection failed, running without Redis");
        }
      } catch (e: any) {
        logger.warn("Redis initialization failed", {}, e);
      }
    }

    // 🚀 Phase 2: 初始化数据库连接池
    try {
      await initDatabasePool();
      logger.info("Database pool initialized");
    } catch (e: any) {
      logger.warn("Database pool initialization failed, using single connection", {}, e);
    }

    // 🚀 Phase 2: 初始化集群管理器 (需要 Redis)
    const clusterEnabled = process.env.CLUSTER_ENABLED === "true" && redisEnabled;
    const reconciliationEnabled = process.env.RECONCILIATION_ENABLED === "true";
    const shouldInitReconciler =
      reconciliationEnabled && !!process.env.RPC_URL && !!process.env.MARKET_ADDRESS;
    let reconcilerStarted = false;

    const startReconciler = async () => {
      if (!shouldInitReconciler) return;
      if (reconcilerStarted) return;
      try {
        await initChainReconciler({
          rpcUrl: process.env.RPC_URL!,
          marketAddress: process.env.MARKET_ADDRESS!,
          chainId: Number(process.env.CHAIN_ID || "80002"),
          intervalMs: Number(process.env.RECONCILIATION_INTERVAL_MS || "300000"),
          autoFix: process.env.RECONCILIATION_AUTO_FIX === "true",
        });
        reconcilerStarted = true;
        logger.info("Chain reconciler initialized");
      } catch (e: any) {
        logger.warn("Chain reconciler initialization failed", {}, e);
      }
    };

    const stopReconciler = async () => {
      if (!reconcilerStarted) return;
      try {
        await closeChainReconciler();
      } catch {}
      reconcilerStarted = false;
    };

    if (clusterEnabled) {
      try {
        const cluster = await initClusterManager({
          enableLeaderElection: true,
          enablePubSub: true,
        });
        clusterIsActive = true;

        // 监听 Leader 事件
        cluster.on("became_leader", () => {
          logger.info("This node became the leader, starting matching engine");
          void startReconciler();
        });

        cluster.on("lost_leadership", () => {
          logger.warn("This node lost leadership");
          void stopReconciler();
        });

        logger.info("Cluster manager initialized", {
          nodeId: cluster.getNodeId(),
          isLeader: cluster.isLeader(),
        });

        if (cluster.isLeader()) {
          await startReconciler();
        }
      } catch (e: any) {
        logger.warn("Cluster manager initialization failed, running in standalone mode", {}, e);
      }
    }
    if (!clusterEnabled) {
      await startReconciler();
    }

    // 🚀 Phase 1: 注册健康检查器
    healthService.registerHealthCheck("supabase", createSupabaseHealthChecker(supabaseAdmin));
    healthService.registerHealthCheck(
      "matching_engine",
      createMatchingEngineHealthChecker(matchingEngine)
    );

    if (redisEnabled) {
      healthService.registerHealthCheck("redis", createRedisHealthChecker(getRedisClient()));
    }

    if (provider) {
      healthService.registerHealthCheck("rpc", createRpcHealthChecker(provider));
    }

    healthService.registerReadinessCheck(
      "orderbook",
      createOrderbookReadinessChecker(matchingEngine)
    );

    healthService.registerHealthCheck("cluster", async () => {
      if (!clusterIsActive) return { status: "pass", message: "Cluster disabled" };
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
        isClusterActive: () => clusterIsActive,
        isLeader: () => getClusterManager().isLeader(),
        getProxyUrl: () =>
          String(process.env.RELAYER_LEADER_PROXY_URL || process.env.RELAYER_LEADER_URL || ""),
      })
    );

    // 🚀 启动 WebSocket 服务器
    try {
      const useClusteredWs = clusterEnabled;
      if (useClusteredWs) {
        wsServer = new ClusteredWebSocketServer(Number(process.env.WS_PORT || "3006"));
      } else {
        wsServer = new MarketWebSocketServer(Number(process.env.WS_PORT || "3006"));
      }
      await Promise.resolve(wsServer.start());
      logger.info("WebSocket server started", { port: process.env.WS_PORT || 3006 });
    } catch (e: any) {
      logger.error("WebSocket server failed to start", {}, e);
    }

    // 🚀 从数据库恢复订单簿
    try {
      await matchingEngine.recoverFromDb();
      logger.info("Order books recovered from database");
    } catch (e: any) {
      logger.error("Failed to recover order books", {}, e);
    }

    try {
      const result = await matchingEngine.recoverFromEventLog();
      if (result.replayed > 0 || result.skipped > 0) {
        logger.info("Order books replayed from matching event log", result);
      }
    } catch (e: any) {
      logger.warn("Failed to replay matching event log", {}, e);
    }

    // 启动自动交易摄入
    startAutoIngestLoop().catch((e: any) => logger.warn("Auto-ingest failed to start", {}, e));

    logger.info("Relayer server started successfully", {
      port: PORT,
      wsPort: process.env.WS_PORT || 3006,
      redisEnabled,
      clusterEnabled,
      reconciliationEnabled,
    });
  });
}

// 🚀 Phase 1 & 2: 优雅关闭 (增加 Redis、集群、对账服务关闭)
async function gracefulShutdown(signal: string) {
  logger.info("Graceful shutdown initiated", { signal });

  try {
    // 停止接收新请求的时间
    const shutdownTimeout = setTimeout(() => {
      logger.error("Shutdown timeout, forcing exit");
      process.exit(1);
    }, 30000);

    // 🚀 Phase 2: 关闭链上对账服务
    try {
      await closeChainReconciler();
      logger.info("Chain reconciler stopped");
    } catch (e: any) {
      logger.error("Failed to stop chain reconciler", {}, e);
    }

    // 🚀 Phase 2: 关闭集群管理器
    try {
      await closeClusterManager();
      logger.info("Cluster manager stopped");
    } catch (e: any) {
      logger.error("Failed to stop cluster manager", {}, e);
    }

    // 关闭订单簿快照服务
    try {
      const snapshotService = getOrderbookSnapshotService();
      await snapshotService.shutdown();
      logger.info("Orderbook snapshot service stopped");
    } catch (e: any) {
      logger.error("Failed to stop snapshot service", {}, e);
    }

    // 关闭撮合引擎
    try {
      await matchingEngine.shutdown();
      logger.info("Matching engine stopped");
    } catch (e: any) {
      logger.error("Failed to stop matching engine", {}, e);
    }

    // 关闭 WebSocket
    try {
      if (wsServer) {
        await Promise.resolve(wsServer.stop());
      }
      logger.info("WebSocket server stopped");
    } catch (e: any) {
      logger.error("Failed to stop WebSocket server", {}, e);
    }

    // 停止 auto-ingest 定时器
    if (autoIngestTimer) {
      clearInterval(autoIngestTimer);
      autoIngestTimer = null;
    }

    // 停止 metrics 定时器
    try {
      stopMetricsTimers();
    } catch (e: any) {
      logger.warn("Failed to stop metrics timers", {}, e);
    }

    // 停止限流器定时器
    try {
      closeRateLimiter();
    } catch (e: any) {
      logger.warn("Failed to stop rate limiter", {}, e);
    }

    // 关闭 Redis
    try {
      await closeRedis();
      logger.info("Redis connection closed");
    } catch (e: any) {
      logger.error("Failed to close Redis", {}, e);
    }

    // 🚀 Phase 2: 关闭数据库连接池
    try {
      await closeDatabasePool();
      logger.info("Database pool closed");
    } catch (e: any) {
      logger.error("Failed to close database pool", {}, e);
    }

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error: any) {
    logger.error("Error during shutdown", {}, error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
