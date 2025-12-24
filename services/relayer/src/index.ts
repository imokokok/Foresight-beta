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
  getCandles,
} from "./orderbook.js";

export const app = express();
app.use(cors());
app.use(express.json());

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

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Relayer server listening on port ${PORT}`);
  });
}

export default app;
