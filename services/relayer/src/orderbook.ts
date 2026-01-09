import { z } from "zod";
import { ethers } from "ethers";
import { supabaseAdmin } from "./supabase.js";

const asBigInt = (pos: "price" | "amount" | "expiry" | "salt") =>
  z.preprocess(
    (v) => (typeof v === "string" ? BigInt(v) : v),
    z.bigint().refine((x) => x >= 0n)
  );

export const OrderSchema = z.object({
  maker: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  outcomeIndex: z.number().int().min(0).max(255),
  isBuy: z.boolean(),
  price: asBigInt("price").refine((v) => v > 0n),
  amount: asBigInt("amount").refine((v) => v > 0n),
  expiry: asBigInt("expiry").optional(),
  salt: asBigInt("salt").refine((v) => v > 0n),
});

const SignatureSchema = z.string().regex(/^0x[0-9a-fA-F]+$/);

export const InputSchemaPlace = z.object({
  chainId: z.number().int().positive(),
  verifyingContract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  order: OrderSchema,
  signature: SignatureSchema,
  marketKey: z.string().optional(),
  market_key: z.string().optional(),
  eventId: z.number().int().positive().optional(),
  event_id: z.number().int().positive().optional(),
});

export const InputSchemaCancelSalt = z.object({
  chainId: z.number().int().positive(),
  verifyingContract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  maker: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  salt: asBigInt("salt"),
  signature: SignatureSchema,
});

function normalizeAddr(a: string) {
  return a.toLowerCase();
}

function domainFor(chainId: number, verifyingContract: string) {
  return { name: "Foresight Market", version: "1", chainId, verifyingContract };
}

const Types = {
  Order: [
    { name: "maker", type: "address" },
    { name: "outcomeIndex", type: "uint256" },
    { name: "isBuy", type: "bool" },
    { name: "price", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "salt", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
  CancelSaltRequest: [
    { name: "maker", type: "address" },
    { name: "salt", type: "uint256" },
  ],
};

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);

const clobIface = new ethers.Interface([
  "event OrderFilledSigned(address maker, address taker, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 fee, uint256 salt)",
]);
const orderFilledTopic = ethers.id(
  "OrderFilledSigned(address,address,uint256,bool,uint256,uint256,uint256,uint256)"
);

export async function placeSignedOrder(input: z.infer<typeof InputSchemaPlace>) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const parsed = InputSchemaPlace.parse(input);
  const order = parsed.order;
  const sig = parsed.signature;
  const maker = normalizeAddr(order.maker);
  const vc = normalizeAddr(parsed.verifyingContract);
  const chainId = parsed.chainId;

  const mkRaw =
    (parsed as any).marketKey && typeof (parsed as any).marketKey === "string"
      ? (parsed as any).marketKey
      : (parsed as any).market_key && typeof (parsed as any).market_key === "string"
        ? (parsed as any).market_key
        : "";
  const eidRaw =
    typeof (parsed as any).eventId === "number"
      ? (parsed as any).eventId
      : typeof (parsed as any).event_id === "number"
        ? (parsed as any).event_id
        : undefined;
  const eid =
    typeof eidRaw === "number" && Number.isFinite(eidRaw) && eidRaw > 0 ? eidRaw : undefined;
  const derivedMk = eid ? `${chainId}:${eid}` : "";
  const marketKey = (mkRaw && mkRaw.trim()) || (derivedMk && derivedMk.trim()) || undefined;

  const recovered = ethers.verifyTypedData(
    domainFor(chainId, vc),
    { Order: [...Types.Order] },
    {
      maker: maker,
      outcomeIndex: order.outcomeIndex,
      isBuy: order.isBuy,
      price: order.price,
      amount: order.amount,
      salt: order.salt,
      expiry: order.expiry ?? 0n,
    },
    sig
  );
  if (normalizeAddr(recovered) !== maker) throw new Error("Invalid signature");

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const expSec = order.expiry ?? 0n;
  if (expSec !== 0n && expSec <= nowSec) throw new Error("Order expired");

  const upsertRow: Record<string, any> = {
    verifying_contract: vc,
    chain_id: chainId,
    maker_address: maker,
    maker_salt: order.salt.toString(),
    outcome_index: order.outcomeIndex,
    is_buy: order.isBuy,
    price: order.price.toString(),
    amount: order.amount.toString(),
    remaining: order.amount.toString(),
    expiry: expSec === 0n ? null : new Date(Number(expSec) * 1000).toISOString(),
    signature: sig,
    status: "open",
  };
  if (marketKey) upsertRow.market_key = marketKey;

  const { data, error } = await supabaseAdmin
    .from("orders")
    .upsert(upsertRow, {
      onConflict: "verifying_contract,chain_id,maker_address,maker_salt",
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("[placeSignedOrder] Supabase Error:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function cancelSalt(input: z.infer<typeof InputSchemaCancelSalt>) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const parsed = InputSchemaCancelSalt.parse(input);
  const maker = normalizeAddr(parsed.maker);
  const vc = normalizeAddr(parsed.verifyingContract);
  const chainId = parsed.chainId;
  const sig = parsed.signature;

  const recovered = ethers.verifyTypedData(
    domainFor(chainId, vc),
    { CancelSaltRequest: [...Types.CancelSaltRequest] },
    {
      maker,
      salt: parsed.salt,
    },
    sig
  );
  if (normalizeAddr(recovered) !== maker) throw new Error("Invalid signature");

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: "canceled", remaining: "0" })
    .eq("verifying_contract", vc)
    .eq("chain_id", chainId)
    .eq("maker_address", maker)
    .eq("maker_salt", parsed.salt.toString());

  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getDepth(
  verifyingContract: string,
  chainId: number,
  outcomeIndex: number,
  isBuy: boolean,
  limit: number,
  marketKey?: string
) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const client = supabaseAdmin!;
  const vc = normalizeAddr(verifyingContract);

  const runView = async (useMarketKey: boolean) => {
    let q = client
      .from("depth_levels")
      .select("price, qty")
      .eq("verifying_contract", vc)
      .eq("chain_id", chainId)
      .eq("outcome_index", outcomeIndex)
      .eq("is_buy", isBuy);
    if (useMarketKey && marketKey) q = q.eq("market_key", marketKey);
    return q.order("price", { ascending: !isBuy }).limit(limit);
  };

  let view = await runView(true);
  if (view.error && marketKey) {
    const code = (view.error as any).code;
    const msg = String((view.error as any).message || "");
    if (code === "42703" || /market_key/i.test(msg)) {
      view = await runView(false);
    }
  }
  if (!view.error && view.data && view.data.length > 0) return view.data;

  const runAgg = async (useMarketKey: boolean) => {
    let q = client
      .from("orders")
      .select("price, remaining")
      .eq("verifying_contract", vc)
      .eq("chain_id", chainId)
      .eq("outcome_index", outcomeIndex)
      .eq("is_buy", isBuy)
      .in("status", ["open", "partially_filled"]);
    if (useMarketKey && marketKey) q = q.eq("market_key", marketKey);
    return q;
  };

  let agg = await runAgg(true);
  if (agg.error && marketKey) {
    const code = (agg.error as any).code;
    const msg = String((agg.error as any).message || "");
    if (code === "42703" || /market_key/i.test(msg)) {
      agg = await runAgg(false);
    }
  }
  if (agg.error) throw new Error(agg.error.message);

  const map = new Map<string, bigint>();
  for (const row of agg.data || []) {
    const p = String((row as any).price);
    const r = BigInt(String((row as any).remaining));
    map.set(p, (map.get(p) || 0n) + r);
  }
  const entries = Array.from(map.entries()).map(([price, qty]) => ({ price, qty: qty.toString() }));
  entries.sort((a, b) => {
    const pa = BigInt(a.price);
    const pb = BigInt(b.price);
    if (pa === pb) return 0;
    if (isBuy) {
      return pa < pb ? 1 : -1;
    }
    return pa < pb ? -1 : 1;
  });
  return entries.slice(0, limit);
}

export async function getQueue(
  verifyingContract: string,
  chainId: number,
  outcomeIndex: number,
  isBuy: boolean,
  price: bigint,
  limit: number,
  offset: number,
  marketKey?: string
) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const client = supabaseAdmin!;
  const vc = normalizeAddr(verifyingContract);
  const run = async (useMarketKey: boolean) => {
    let q = client
      .from("orders")
      .select("id, maker_address, maker_salt, remaining, created_at, sequence")
      .eq("verifying_contract", vc)
      .eq("chain_id", chainId)
      .eq("outcome_index", outcomeIndex)
      .eq("is_buy", isBuy)
      .eq("price", price.toString())
      .in("status", ["open", "partially_filled"])
      .order("sequence", { ascending: true })
      .range(offset, offset + limit - 1);
    if (useMarketKey && marketKey) q = q.eq("market_key", marketKey);
    return q;
  };

  let { data, error } = await run(true);
  if (error && marketKey) {
    const code = (error as any).code;
    const msg = String((error as any).message || "");
    if (code === "42703" || /market_key/i.test(msg)) {
      ({ data, error } = await run(false));
    }
  }
  if (error) throw new Error(error.message);
  return data;
}

export function getOrderTypes() {
  return Types;
}

export async function ingestTrade(chainId: number, txHash: string, blockTimestamp?: string) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");

  const receipt = await rpcProvider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction not found");

  let blockTsIso = blockTimestamp;
  if (!blockTsIso) {
    const block = await rpcProvider.getBlock(receipt.blockNumber);
    if (!block) throw new Error("Block not found for trade tx");
    const ts = (block as any).timestamp;
    const tsNum = typeof ts === "bigint" ? Number(ts) : Number(ts || 0);
    blockTsIso = new Date(tsNum * 1000).toISOString();
  }
  const ingested: any[] = [];

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i] as any;
    let parsed;
    try {
      parsed = clobIface.parseLog(log);
    } catch {
      continue;
    }
    if (!parsed || parsed.name !== "OrderFilledSigned") continue;

    const maker = normalizeAddr(String((parsed.args as any).maker));
    const taker = normalizeAddr(String((parsed.args as any).taker));
    const outcomeIndex = Number((parsed.args as any).outcomeIndex);
    const isBuy = Boolean((parsed.args as any).isBuy);
    const price = BigInt((parsed.args as any).price).toString();
    const amount = BigInt((parsed.args as any).amount).toString();
    const fee = BigInt((parsed.args as any).fee).toString();
    const salt = BigInt((parsed.args as any).salt).toString();

    const logIndexRaw =
      typeof log.logIndex === "number"
        ? log.logIndex
        : typeof log.index === "number"
          ? log.index
          : i;
    const logIndex = Number.isFinite(logIndexRaw) ? Number(logIndexRaw) : i;

    try {
      const { data, error } = await (supabaseAdmin as any).rpc("ingest_trade_event", {
        p_network_id: chainId,
        p_market_address: normalizeAddr(log.address),
        p_outcome_index: outcomeIndex,
        p_price: price,
        p_amount: amount,
        p_taker_address: taker,
        p_maker_address: maker,
        p_is_buy: isBuy,
        p_tx_hash: normalizeAddr(txHash),
        p_log_index: logIndex,
        p_block_number: BigInt(receipt.blockNumber).toString(),
        p_block_timestamp: blockTsIso,
        p_fee: fee,
        p_salt: salt,
      });
      if (error) {
        console.warn(
          "[ingestTrade] supabase error",
          String(error.message || String(error)),
          chainId,
          txHash,
          logIndex
        );
        continue;
      }
      ingested.push({
        logIndex,
        maker,
        taker,
        outcomeIndex,
        isBuy,
        price,
        amount,
        fee,
        salt,
        result: data,
      });
    } catch (e: any) {
      console.warn("[ingestTrade] rpc error", String(e?.message || e), chainId, txHash, logIndex);
      continue;
    }
  }

  if (ingested.length === 0) {
    throw new Error("No OrderFilledSigned events found in transaction");
  }

  return { txHash, blockTimestamp: blockTsIso, ingestedCount: ingested.length, ingested };
}

export async function ingestTradesByLogs(
  chainId: number,
  fromBlock: number,
  toBlock: number,
  maxConcurrent: number
) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");

  const maxAttempts = Math.max(1, Number(process.env.RELAYER_INGEST_RETRY_ATTEMPTS || "3"));
  const baseDelayMs = Math.max(50, Number(process.env.RELAYER_INGEST_RETRY_DELAY_MS || "200"));

  const logs = await rpcProvider.getLogs({
    fromBlock,
    toBlock,
    topics: [orderFilledTopic],
  });

  if (logs.length === 0) {
    return { fromBlock, toBlock, ingestedCount: 0, ingested: [] as any[] };
  }

  const block = await rpcProvider.getBlock(fromBlock);
  if (!block) throw new Error("Block not found for trade logs");
  const ts = (block as any).timestamp;
  const tsNum = typeof ts === "bigint" ? Number(ts) : Number(ts || 0);
  const blockTsIso = new Date(tsNum * 1000).toISOString();

  const ingested: any[] = [];
  const jobs: Promise<void>[] = [];
  const limit = Math.max(1, maxConcurrent);

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i] as any;
    const job = (async () => {
      let parsed;
      try {
        parsed = clobIface.parseLog(log);
      } catch {
        return;
      }
      if (!parsed || parsed.name !== "OrderFilledSigned") return;

      const maker = normalizeAddr(String((parsed.args as any).maker));
      const taker = normalizeAddr(String((parsed.args as any).taker));
      const outcomeIndex = Number((parsed.args as any).outcomeIndex);
      const isBuy = Boolean((parsed.args as any).isBuy);
      const price = BigInt((parsed.args as any).price).toString();
      const amount = BigInt((parsed.args as any).amount).toString();
      const fee = BigInt((parsed.args as any).fee).toString();
      const salt = BigInt((parsed.args as any).salt).toString();

      const logIndexRaw =
        typeof log.logIndex === "number"
          ? log.logIndex
          : typeof log.index === "number"
            ? log.index
            : i;
      const logIndex = Number.isFinite(logIndexRaw) ? Number(logIndexRaw) : i;

      const txHash = String(log.transactionHash || "");

      let attempt = 0;
      let done = false;
      while (!done && attempt < maxAttempts) {
        attempt += 1;
        try {
          const { data, error } = await (supabaseAdmin as any).rpc("ingest_trade_event", {
            p_network_id: chainId,
            p_market_address: normalizeAddr(log.address),
            p_outcome_index: outcomeIndex,
            p_price: price,
            p_amount: amount,
            p_taker_address: taker,
            p_maker_address: maker,
            p_is_buy: isBuy,
            p_tx_hash: normalizeAddr(txHash),
            p_log_index: logIndex,
            p_block_number: BigInt(log.blockNumber).toString(),
            p_block_timestamp: blockTsIso,
            p_fee: fee,
            p_salt: salt,
          });
          if (error) {
            console.warn(
              "[ingestTradesByLogs] supabase error",
              String(error.message || String(error)),
              chainId,
              txHash,
              logIndex,
              "attempt",
              attempt
            );
          } else {
            ingested.push({
              logIndex,
              maker,
              taker,
              outcomeIndex,
              isBuy,
              price,
              amount,
              fee,
              salt,
              result: data,
            });
            done = true;
          }
        } catch (e: any) {
          console.warn(
            "[ingestTradesByLogs] rpc error",
            String(e?.message || e),
            chainId,
            txHash,
            logIndex,
            "attempt",
            attempt
          );
        }
        if (!done && attempt < maxAttempts) {
          const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    })();
    jobs.push(job);
    if (jobs.length >= limit) {
      await Promise.all(jobs);
      jobs.length = 0;
    }
  }
  if (jobs.length > 0) {
    await Promise.all(jobs);
  }

  return { fromBlock, toBlock, ingestedCount: ingested.length, ingested };
}

export async function getCandles(
  market: string,
  chainId: number,
  outcomeIndex: number,
  resolution: string,
  limit: number
) {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const { data, error } = await supabaseAdmin
    .from("candles")
    .select("open,high,low,close,volume,time")
    .eq("network_id", chainId)
    .eq("market_address", normalizeAddr(market))
    .eq("outcome_index", outcomeIndex)
    .eq("resolution", resolution)
    .order("time", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}
