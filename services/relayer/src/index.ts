// relayer/src/config.ts
import { z } from "zod";
import 'dotenv/config'

// 环境变量校验与读取
const EnvSchema = z.object({
  BUNDLER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
  RPC_URL: z
    .string()
    .url()
    .optional(),
  PORT: z
    .preprocess((v) => (typeof v === "string" && v.length > 0 ? Number(v) : v), z.number().int().positive())
    .optional(),
});

const rawEnv = {
  BUNDLER_PRIVATE_KEY: process.env.BUNDLER_PRIVATE_KEY || process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL,
  PORT: process.env.PORT,
};

const parsed = EnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  console.error("Relayer config validation failed:", parsed.error.flatten());
  throw new Error("Invalid relayer environment configuration");
}

export const BUNDLER_PRIVATE_KEY = parsed.data.BUNDLER_PRIVATE_KEY;
export const RPC_URL = parsed.data.RPC_URL || "http://127.0.0.1:8545";
export const RELAYER_PORT = parsed.data.PORT ?? 3000;
import express from "express";
import { ethers, Contract } from "ethers";
import EntryPointAbi from './abi/EntryPoint.json' with { type: 'json' };
import { supabaseAdmin } from './supabase.js'
import { placeSignedOrder, cancelSalt, getDepth, getQueue, getOrderTypes } from './orderbook.js'

const app = express();
app.use(express.json());

const PORT = process.env.PORT || RELAYER_PORT;

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
    if (!supabaseAdmin) return res.status(500).json({ message: 'Supabase not configured' })
    const body = req.body || {}
    const data = await placeSignedOrder(body)
    res.json({ message: 'ok', data })
  } catch (e: any) {
    res.status(400).json({ message: 'place order failed', detail: String(e?.message || e) })
  }
})

app.post("/orderbook/cancel-salt", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ message: 'Supabase not configured' })
    const body = req.body || {}
    const data = await cancelSalt(body)
    res.json({ message: 'ok', data })
  } catch (e: any) {
    res.status(400).json({ message: 'cancel salt failed', detail: String(e?.message || e) })
  }
})

app.get("/orderbook/depth", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ message: 'Supabase not configured' })
    const vc = String(req.query.contract || '')
    const chainId = Number(req.query.chainId || 0)
    const outcome = Number(req.query.outcome || 0)
    const side = String(req.query.side || 'buy').toLowerCase() === 'buy'
    const levels = Math.max(1, Math.min(50, Number(req.query.levels || 10)))
    const data = await getDepth(vc, chainId, outcome, side, levels)
    res.json({ message: 'ok', data })
  } catch (e: any) {
    res.status(400).json({ message: 'depth query failed', detail: String(e?.message || e) })
  }
})

app.get("/orderbook/queue", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ message: 'Supabase not configured' })
    const vc = String(req.query.contract || '')
    const chainId = Number(req.query.chainId || 0)
    const outcome = Number(req.query.outcome || 0)
    const side = String(req.query.side || 'buy').toLowerCase() === 'buy'
    const price = BigInt(String(req.query.price || '0'))
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)))
    const offset = Math.max(0, Number(req.query.offset || 0))
    const data = await getQueue(vc, chainId, outcome, side, price, limit, offset)
    res.json({ message: 'ok', data })
  } catch (e: any) {
    res.status(400).json({ message: 'queue query failed', detail: String(e?.message || e) })
  }
})

app.get('/orderbook/types', (req, res) => {
  res.json({ types: getOrderTypes() })
})

app.listen(PORT, () => {
  console.log(`Relayer server listening on port ${PORT}`);
});
