import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { logApiError } from "@/lib/serverUtils";

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

    let targetAmount: bigint;
    try {
      const parsedAmount = Math.floor(Number(amountRaw));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return ApiResponses.badRequest("Invalid amount");
      }
      targetAmount = BigInt(parsedAmount);
    } catch {
      return ApiResponses.badRequest("Invalid amount");
    }

    const takerSide = sideRaw.toLowerCase() === "buy" ? "buy" : "sell";
    const makerIsBuy = takerSide === "sell";

    let query = client
      .from("orders")
      .select("price, remaining")
      .eq("verifying_contract", contract.toLowerCase())
      .eq("chain_id", chainId)
      .eq("outcome_index", outcome)
      .eq("is_buy", makerIsBuy)
      .in("status", ["open", "filled_partial"]);

    if (marketKey) {
      query = query.eq("market_key", marketKey);
    }

    const initial = await query;
    let orders = initial.data ?? [];
    let error = initial.error;

    if (isMissingMarketKeyColumn(error) && marketKey) {
      const fallbackQuery = client
        .from("orders")
        .select("price, remaining")
        .eq("verifying_contract", contract.toLowerCase())
        .eq("chain_id", chainId)
        .eq("outcome_index", outcome)
        .eq("is_buy", makerIsBuy)
        .in("status", ["open", "filled_partial"]);

      const fallback = await fallbackQuery;
      orders = fallback.data ?? [];
      error = fallback.error;
    }

    if (error) {
      return ApiResponses.databaseError("Depth query failed", error.message);
    }

    if (!orders.length) {
      return successResponse({
        side: takerSide,
        amount: targetAmount.toString(),
        filledAmount: "0",
        total: "0",
        avgPrice: "0",
        bestPrice: null,
        worstPrice: null,
        slippageBps: "0",
        levels: [],
        hasMoreDepth: false,
      });
    }

    const aggregated = new Map<string, bigint>();
    for (const row of orders as Array<{ price: string; remaining: string }>) {
      const priceStr = String(row.price);
      const remainingStr = String(row.remaining);
      let remaining: bigint;
      try {
        remaining = BigInt(remainingStr);
      } catch {
        continue;
      }
      if (remaining <= 0n) continue;
      aggregated.set(priceStr, (aggregated.get(priceStr) || 0n) + remaining);
    }

    const levelsSorted = Array.from(aggregated.entries())
      .map(([price, qty]) => ({ price, qty }))
      .sort((a, b) => {
        const pa = BigInt(a.price);
        const pb = BigInt(b.price);
        if (makerIsBuy) {
          return pa > pb ? -1 : pa < pb ? 1 : 0;
        }
        return pa < pb ? -1 : pa > pb ? 1 : 0;
      });

    if (levelsSorted.length === 0) {
      return successResponse({
        side: takerSide,
        amount: targetAmount.toString(),
        filledAmount: "0",
        total: "0",
        avgPrice: "0",
        bestPrice: null,
        worstPrice: null,
        slippageBps: "0",
        levels: [],
        hasMoreDepth: false,
      });
    }

    let remainingToFill = targetAmount;
    let filledAmount = 0n;
    let totalCost = 0n;
    let bestPrice: bigint | null = null;
    let worstPrice: bigint | null = null;
    const levelsOut: Array<{ price: string; qty: string; takeQty: string }> = [];

    for (const level of levelsSorted) {
      if (remainingToFill <= 0n) break;
      const price = BigInt(level.price);
      const qty = level.qty;
      const takeQty = qty >= remainingToFill ? remainingToFill : qty;
      if (takeQty <= 0n) continue;
      if (bestPrice === null) bestPrice = price;
      worstPrice = price;
      filledAmount += takeQty;
      totalCost += takeQty * price;
      remainingToFill -= takeQty;
      levelsOut.push({
        price: level.price,
        qty: qty.toString(),
        takeQty: takeQty.toString(),
      });
    }

    if (filledAmount === 0n || !bestPrice || !worstPrice) {
      return NextResponse.json({
        success: true,
        data: {
          side: takerSide,
          amount: targetAmount.toString(),
          filledAmount: "0",
          total: "0",
          avgPrice: "0",
          bestPrice: null,
          worstPrice: null,
          slippageBps: "0",
          levels: [],
          hasMoreDepth: false,
        },
      });
    }

    // 防御：避免任何情况下出现 BigInt 除 0（同时规避部分构建期静态分析误判导致的 /0n）
    let avgPrice = 0n;
    if (filledAmount > 0n) {
      avgPrice = totalCost / filledAmount;
    }
    let slippageBps = 0n;
    if (takerSide === "buy") {
      if (worstPrice > bestPrice) {
        slippageBps = ((worstPrice - bestPrice) * 10000n) / bestPrice;
      }
    } else {
      if (worstPrice < bestPrice) {
        slippageBps = ((bestPrice - worstPrice) * 10000n) / bestPrice;
      }
    }

    const hasMoreDepth = remainingToFill > 0n;

    return successResponse({
      side: takerSide,
      amount: targetAmount.toString(),
      filledAmount: filledAmount.toString(),
      total: totalCost.toString(),
      avgPrice: avgPrice.toString(),
      bestPrice: bestPrice.toString(),
      worstPrice: worstPrice.toString(),
      slippageBps: slippageBps.toString(),
      levels: levelsOut,
      hasMoreDepth,
    });
  } catch (e: unknown) {
    logApiError("GET /api/orderbook/quote", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "Failed to fetch quote",
      process.env.NODE_ENV === "development" ? message : undefined
    );
  }
}
