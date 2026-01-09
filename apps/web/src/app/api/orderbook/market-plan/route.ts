import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { logApiError } from "@/lib/serverUtils";

type MarketPlanItem = {
  orderId: number;
  fillAmount: string;
  maker: string;
  signature: string;
  req: {
    maker: string;
    outcomeIndex: number;
    isBuy: boolean;
    price: string;
    amount: string;
    expiry: string;
    salt: string;
  };
};

type OrdersRow = Database["public"]["Tables"]["orders"]["Row"];

type NormalizedOrder = {
  row: OrdersRow;
  price: bigint;
  remaining: bigint;
  sequence: bigint;
};

function isMissingMarketKeyColumn(
  error: { code?: string; message?: string | null } | null
): boolean {
  if (!error) return false;
  const code = String(error.code || "").toUpperCase();
  if (code === "42703") return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("market_key");
}

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const url = new URL(req.url);
    const contract = url.searchParams.get("contract");
    const chainIdRaw = url.searchParams.get("chainId");
    const outcomeRaw = url.searchParams.get("outcome");
    const sideRaw = url.searchParams.get("side");
    const marketKey = url.searchParams.get("marketKey") || url.searchParams.get("market_key");
    const amountRaw = url.searchParams.get("amount");

    if (!contract || !chainIdRaw || outcomeRaw === null || !sideRaw || !amountRaw) {
      return ApiResponses.invalidParameters("Missing parameters");
    }

    const chainId = Number(chainIdRaw);
    const outcome = Number(outcomeRaw);
    if (!Number.isFinite(chainId) || chainId <= 0 || !Number.isFinite(outcome) || outcome < 0) {
      return ApiResponses.badRequest("Invalid chainId or outcome");
    }

    let targetAmount18: bigint;
    try {
      // amount is in shares (1e18)
      const parsed = BigInt(String(amountRaw));
      if (parsed <= 0n) {
        return ApiResponses.badRequest("Invalid amount");
      }
      targetAmount18 = parsed;
    } catch {
      return ApiResponses.badRequest("Invalid amount");
    }

    const takerSide = sideRaw.toLowerCase() === "buy" ? "buy" : "sell";
    const makerIsBuy = takerSide === "sell";

    let query = client
      .from("orders")
      .select(
        "id, maker_address, maker_salt, outcome_index, is_buy, price, amount, remaining, expiry, signature, status, created_at, sequence"
      )
      .eq("verifying_contract", contract.toLowerCase())
      .eq("chain_id", chainId)
      .eq("outcome_index", outcome)
      .eq("is_buy", makerIsBuy)
      .in("status", ["open", "partially_filled", "filled_partial"]);

    if (marketKey) {
      query = query.eq("market_key", marketKey);
    }

    const initial = await query.limit(2000);
    let orders = (initial.data ?? []) as OrdersRow[];
    let error = initial.error;

    if (isMissingMarketKeyColumn(error) && marketKey) {
      const fallbackQuery = client
        .from("orders")
        .select(
          "id, maker_address, maker_salt, outcome_index, is_buy, price, amount, remaining, expiry, signature, status, created_at, sequence"
        )
        .eq("verifying_contract", contract.toLowerCase())
        .eq("chain_id", chainId)
        .eq("outcome_index", outcome)
        .eq("is_buy", makerIsBuy)
        .in("status", ["open", "partially_filled", "filled_partial"])
        .limit(2000);
      const fallback = await fallbackQuery;
      orders = (fallback.data ?? []) as OrdersRow[];
      error = fallback.error;
    }
    if (error) {
      return ApiResponses.databaseError("Order query failed", error.message);
    }

    const rows: OrdersRow[] = Array.isArray(orders) ? orders : [];
    const normalized = rows
      .map<NormalizedOrder | null>((row) => {
        try {
          const price = BigInt(String(row.price));
          const remaining = BigInt(String(row.remaining));
          const sequence = row.sequence != null ? BigInt(String(row.sequence)) : 0n;
          return {
            row,
            price,
            remaining,
            sequence,
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NormalizedOrder => item !== null);

    normalized.sort((a, b) => {
      if (a.price !== b.price) {
        if (makerIsBuy) return a.price > b.price ? -1 : 1; // 买盘：高价优先
        return a.price < b.price ? -1 : 1; // 卖盘：低价优先
      }
      if (a.sequence !== b.sequence) return a.sequence < b.sequence ? -1 : 1; // 时间优先
      return 0;
    });

    let remainingToFill = targetAmount18;
    let filledAmount = 0n;
    let totalCost = 0n;
    let bestPrice: bigint | null = null;
    let worstPrice: bigint | null = null;

    const fills: MarketPlanItem[] = [];

    for (const item of normalized) {
      if (remainingToFill <= 0n) break;
      if (item.remaining <= 0n) continue;

      const take = item.remaining >= remainingToFill ? remainingToFill : item.remaining;
      if (take <= 0n) continue;

      if (bestPrice === null) bestPrice = item.price;
      worstPrice = item.price;
      filledAmount += take;
      // totalCost (USDC6) = sum(amount18 * price6Per1e18 / 1e18)
      totalCost += (take * item.price) / 1_000_000_000_000_000_000n;
      remainingToFill -= take;

      const expiryUnix =
        item.row.expiry != null
          ? Math.floor(new Date(String(item.row.expiry)).getTime() / 1000)
          : 0;

      fills.push({
        orderId: Number(item.row.id),
        fillAmount: take.toString(),
        maker: String(item.row.maker_address),
        signature: String(item.row.signature),
        req: {
          maker: String(item.row.maker_address),
          outcomeIndex: Number(item.row.outcome_index),
          isBuy: Boolean(item.row.is_buy),
          price: String(item.row.price),
          amount: String(item.row.amount),
          expiry: String(expiryUnix),
          salt: String(item.row.maker_salt),
        },
      });
    }

    if (filledAmount === 0n || bestPrice === null || worstPrice === null) {
      return successResponse({
        side: takerSide,
        amount: targetAmount18.toString(),
        filledAmount: "0",
        total: "0",
        avgPrice: "0",
        bestPrice: null,
        worstPrice: null,
        slippageBps: "0",
        hasMoreDepth: false,
        fills: [],
      });
    }

    // avgPrice in price6Per1e18
    const avgPrice = (totalCost * 1_000_000_000_000_000_000n) / filledAmount;
    let slippageBps = 0n;
    if (takerSide === "buy") {
      if (worstPrice > bestPrice) slippageBps = ((worstPrice - bestPrice) * 10000n) / bestPrice;
    } else {
      if (worstPrice < bestPrice) slippageBps = ((bestPrice - worstPrice) * 10000n) / bestPrice;
    }

    const hasMoreDepth = remainingToFill > 0n;

    return successResponse({
      side: takerSide,
      amount: targetAmount18.toString(),
      filledAmount: filledAmount.toString(),
      total: totalCost.toString(),
      avgPrice: avgPrice.toString(),
      bestPrice: bestPrice.toString(),
      worstPrice: worstPrice.toString(),
      slippageBps: slippageBps.toString(),
      hasMoreDepth,
      fills,
    });
  } catch (e: unknown) {
    logApiError("GET /api/orderbook/market-plan", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "Failed to compute market plan",
      process.env.NODE_ENV === "development" ? message : undefined
    );
  }
}
