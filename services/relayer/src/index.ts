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
app.post("/orderbook/orders", async (req, res) => {
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

app.get("/orderbook/depth", async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
    const vc = String(req.query.contract || "");
    const chainId = Number(req.query.chainId || 0);
    const outcome = Number(req.query.outcome || 0);
    const side = String(req.query.side || "buy").toLowerCase() === "buy";
    const levels = Math.max(1, Math.min(50, Number(req.query.levels || 10)));
    const marketKey =
      typeof req.query.marketKey === "string"
        ? req.query.marketKey
        : typeof req.query.market_key === "string"
          ? req.query.market_key
          : undefined;
    const data = await getDepth(vc, chainId, outcome, side, levels, marketKey);
    res.json({ success: true, data });
  } catch (e: any) {
    res
      .status(400)
      .json({ success: false, message: "depth query failed", detail: String(e?.message || e) });
  }
});

app.get("/orderbook/queue", async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
    const vc = String(req.query.contract || "");
    const chainId = Number(req.query.chainId || 0);
    const outcome = Number(req.query.outcome || 0);
    const side = String(req.query.side || "buy").toLowerCase() === "buy";
    const price = BigInt(String(req.query.price || "0"));
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const marketKey =
      typeof req.query.marketKey === "string"
        ? req.query.marketKey
        : typeof req.query.market_key === "string"
          ? req.query.market_key
          : undefined;
    const data = await getQueue(vc, chainId, outcome, side, price, limit, offset, marketKey);
    res.json({ success: true, data });
  } catch (e: any) {
    res
      .status(400)
      .json({ success: false, message: "queue query failed", detail: String(e?.message || e) });
  }
});

app.post("/orderbook/report-trade", async (req, res) => {
  try {
    if (!supabaseAdmin)
      return res.status(500).json({ success: false, message: "Supabase not configured" });
    const chainId = Number(req.body.chainId);
    const txHash = String(req.body.txHash);
    if (!chainId || !txHash) throw new Error("Missing chainId or txHash");
    const data = await ingestTrade(chainId, txHash);
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
    const market = String(req.query.market || "");
    const chainId = Number(req.query.chainId || 0);
    const outcome = Number(req.query.outcome || 0);
    const resolution = String(req.query.resolution || "15m");
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit || 100)));
    const data = await getCandles(market, chainId, outcome, resolution, limit);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(400).json({
      success: false,
      message: "candles query failed",
      detail: String(e?.message || e),
    });
  }
});

app.get("/orderbook/types", (req, res) => {
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
