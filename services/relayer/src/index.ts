import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });

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

export const app = express();

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

// Off-chain orderbook API
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
  app.listen(PORT, () => {
    console.log(`Relayer server listening on port ${PORT}`);
    startAutoIngestLoop().catch((e) => console.warn("[auto-ingest] failed:", e));
  });
}

export default app;
