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
} from "./monitoring/metrics.js";
import {
  healthService,
  createSupabaseHealthChecker,
  createRedisHealthChecker,
  createRpcHealthChecker,
  createMatchingEngineHealthChecker,
  createOrderbookReadinessChecker,
} from "./monitoring/health.js";
import { initRedis, closeRedis, getRedisClient } from "./redis/client.js";
import { getOrderbookSnapshotService } from "./redis/orderbookSnapshot.js";
import { healthRoutes, clusterRoutes } from "./routes/index.js";
import {
  metricsMiddleware,
  requestIdMiddleware,
  requestLoggerMiddleware,
} from "./middleware/index.js";

// 🚀 Phase 2: 导入集群和高可用模块
import { 
  initClusterManager, 
  closeClusterManager, 
  getClusterManager 
} from "./cluster/index.js";
import { 
  initDatabasePool, 
  closeDatabasePool 
} from "./database/index.js";
import { 
  initChainReconciler, 
  closeChainReconciler 
} from "./reconciliation/index.js";

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

export const app = express();

// 🚀 初始化撮合引擎和 WebSocket 服务器
const matchingEngine = new MatchingEngine({
  makerFeeBps: Number(process.env.MAKER_FEE_BPS || "0"),
  takerFeeBps: Number(process.env.TAKER_FEE_BPS || "50"),
});

const wsServer = new MarketWebSocketServer(
  Number(process.env.WS_PORT || "3006")
);

// 🚀 连接撮合引擎事件到 WebSocket
matchingEngine.on("market_event", (event) => {
  wsServer.handleMarketEvent(event);
});

matchingEngine.on("trade", (trade: { marketKey: string; outcomeIndex: number; amount: bigint; price: bigint; maker: string; taker: string }) => {
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
  const volumeBigInt = trade.amount * trade.price / 1_000_000_000_000_000_000n;
  const volume = Number(volumeBigInt) / 1000000;
  matchedVolumeTotal.inc({ market_key: trade.marketKey, outcome_index: String(trade.outcomeIndex) }, volume);
});

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
if (BUNDLER_PRIVATE_KEY) {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    bundlerWallet = new ethers.Wallet(BUNDLER_PRIVATE_KEY, provider);
    console.log(`Bundler address: ${bundlerWallet.address}`);
  } catch (e) {
    bundlerWallet = null;
  }
}

app.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.send("Foresight Relayer is running!");
});

app.post("/", async (req, res) => {
  try {
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
    res.json({ jsonrpc: "2.0", id: req.body.id, result: receipt.hash });
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
    const body = req.body || {};
    const data = await placeSignedOrder(body);
    res.json({ success: true, data });
  } catch (e: any) {
    res
      .status(400)
      .json({ success: false, message: "place order failed", detail: String(e?.message || e) });
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
    const body = req.body || {};
    
    // 构建订单输入
    const orderInput: OrderInput = {
      marketKey: body.marketKey || body.market_key || `${body.chainId}:${body.eventId || body.event_id || 'unknown'}`,
      maker: String(body.order?.maker || ""),
      outcomeIndex: Number(body.order?.outcomeIndex || 0),
      isBuy: Boolean(body.order?.isBuy),
      price: BigInt(String(body.order?.price || "0")),
      amount: BigInt(String(body.order?.amount || "0")),
      salt: String(body.order?.salt || ""),
      expiry: Number(body.order?.expiry || 0),
      signature: String(body.signature || ""),
      chainId: Number(body.chainId || 0),
      verifyingContract: String(body.verifyingContract || body.contract || ""),
    };

    // 提交到撮合引擎
    const result = await matchingEngine.submitOrder(orderInput);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || "Order submission failed",
      });
    }

    res.json({
      success: true,
      data: {
        orderId: orderInput.salt,
        matchesCount: result.matches.length,
        matches: result.matches.map(m => ({
          matchId: m.id,
          matchedAmount: m.matchedAmount.toString(),
          matchedPrice: m.matchedPrice.toString(),
          makerFee: m.makerFee.toString(),
          takerFee: m.takerFee.toString(),
        })),
        remainingAmount: result.remainingOrder?.remainingAmount.toString() || "0",
        status: result.remainingOrder ? "partially_filled" : "filled",
      },
    });
  } catch (e: any) {
    console.error("[v2/orders] Error:", e);
    res.status(400).json({
      success: false,
      message: "Order submission failed",
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
        bids: snapshot.bids.map(l => ({
          price: l.price.toString(),
          qty: l.totalQuantity.toString(),
          count: l.orderCount,
        })),
        asks: snapshot.asks.map(l => ({
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
  const stats = wsServer.getStats();
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
    const { marketKey, chainId, marketAddress } = req.body;
    
    // 验证必要参数
    if (!marketKey || !chainId || !marketAddress) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: marketKey, chainId, marketAddress",
      });
    }

    // 从环境变量获取 Operator 配置
    const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.BUNDLER_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";

    if (!operatorKey) {
      return res.status(500).json({
        success: false,
        message: "Operator private key not configured",
      });
    }

    const settler = matchingEngine.registerSettler(
      marketKey,
      Number(chainId),
      marketAddress,
      operatorKey,
      rpcUrl
    );

    res.json({
      success: true,
      data: {
        marketKey,
        operatorAddress: settler.getOperatorAddress(),
        status: "registered",
      },
    });
  } catch (e: any) {
    res.status(400).json({
      success: false,
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
    const body = req.body || {};
    const data = await cancelSalt(body);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(400).json({
      success: false,
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
    const body = TradeReportSchema.parse(req.body || {});
    const data = await ingestTrade(body.chainId, body.txHash);
    res.json({ success: true, data });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({
      success: false,
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

  let last = Number(process.env.RELAYER_AUTO_INGEST_FROM_BLOCK || "0") || 0;
  const confirmations = Math.max(0, Number(process.env.RELAYER_AUTO_INGEST_CONFIRMATIONS || "1"));
  const pollMs = Math.max(2000, Number(process.env.RELAYER_AUTO_INGEST_POLL_MS || "5000"));
  const maxConcurrent = Math.max(1, Number(process.env.RELAYER_AUTO_INGEST_CONCURRENCY || "3"));
  const blockConcurrency = Math.max(
    1,
    Number(process.env.RELAYER_AUTO_INGEST_BLOCK_CONCURRENCY || "4")
  );

  const loop = async () => {
    try {
      const head = await provider!.getBlockNumber();
      const target = Math.max(0, head - confirmations);
      if (last === 0) last = target;
      if (target <= last) return;

      const maxStep = Math.max(1, Number(process.env.RELAYER_AUTO_INGEST_MAX_STEP || "20"));
      const to = Math.min(target, last + maxStep);

      const fromBlock = last + 1;
      if (fromBlock > to) return;

      const blocks: number[] = [];
      for (let b = fromBlock; b <= to; b++) {
        blocks.push(b);
      }

      const startTime = Date.now();
      let totalIngested = 0;
      let index = 0;
      while (index < blocks.length) {
        const slice = blocks.slice(index, index + blockConcurrency);
        const results = await Promise.all(
          slice.map(async (b) => {
            try {
              const r = await ingestTradesByLogs(chainId, b, b, maxConcurrent);
              return { block: b, ingested: r.ingestedCount || 0 };
            } catch (e: any) {
              console.warn(
                "[auto-ingest] ingestTradesByLogs error:",
                String(e?.message || e),
                chainId,
                b
              );
              return { block: b, ingested: 0 };
            }
          })
        );
        for (const r of results) {
          totalIngested += r.ingested;
        }
        index += blockConcurrency;
      }
      last = to;
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
  setInterval(loop, pollMs);
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
    if (clusterEnabled) {
      try {
        const cluster = await initClusterManager({
          enableLeaderElection: true,
          enablePubSub: true,
        });
        
        // 监听 Leader 事件
        cluster.on("became_leader", () => {
          logger.info("This node became the leader, starting matching engine");
          // 可以在这里添加 Leader 专属逻辑
        });
        
        cluster.on("lost_leadership", () => {
          logger.warn("This node lost leadership");
          // 可以在这里添加 Follower 逻辑
        });
        
        logger.info("Cluster manager initialized", { 
          nodeId: cluster.getNodeId(),
          isLeader: cluster.isLeader(),
        });
      } catch (e: any) {
        logger.warn("Cluster manager initialization failed, running in standalone mode", {}, e);
      }
    }

    // 🚀 Phase 2: 初始化链上对账系统 (可选)
    const reconciliationEnabled = process.env.RECONCILIATION_ENABLED === "true";
    if (reconciliationEnabled && process.env.RPC_URL && process.env.MARKET_ADDRESS) {
      try {
        await initChainReconciler({
          rpcUrl: process.env.RPC_URL,
          marketAddress: process.env.MARKET_ADDRESS,
          chainId: Number(process.env.CHAIN_ID || "80002"),
          intervalMs: Number(process.env.RECONCILIATION_INTERVAL_MS || "300000"),
          autoFix: process.env.RECONCILIATION_AUTO_FIX === "true",
        });
        logger.info("Chain reconciler initialized");
      } catch (e: any) {
        logger.warn("Chain reconciler initialization failed", {}, e);
      }
    }

    // 🚀 Phase 1: 注册健康检查器
    healthService.registerHealthCheck("supabase", createSupabaseHealthChecker(supabaseAdmin));
    healthService.registerHealthCheck("matching_engine", createMatchingEngineHealthChecker(matchingEngine));
    
    if (redisEnabled) {
      healthService.registerHealthCheck("redis", createRedisHealthChecker(getRedisClient()));
    }
    
    if (provider) {
      healthService.registerHealthCheck("rpc", createRpcHealthChecker(provider));
    }
    
    healthService.registerReadinessCheck("orderbook", createOrderbookReadinessChecker(matchingEngine));
    
    // 🚀 启动 WebSocket 服务器
    try {
      wsServer.start();
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
      wsServer.stop();
      logger.info("WebSocket server stopped");
    } catch (e: any) {
      logger.error("Failed to stop WebSocket server", {}, e);
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
