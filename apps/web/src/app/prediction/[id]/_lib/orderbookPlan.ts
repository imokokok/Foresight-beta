import { ethers } from "ethers";
import { API_BASE, buildMarketKey } from "./constants";
import { safeJson } from "./http";
import type { MarketInfo } from "./marketTypes";

export type MarketPlanPayload = {
  filledBN: bigint;
  totalCostBN: bigint;
  avgPriceBN: bigint;
  worstPriceBN: bigint;
  bestPriceBN: bigint;
  slippageBpsNum: number;
  fills: any[];
};

export type MarketPlanPreview = {
  slippagePercent: number;
  avgPrice: number;
  worstPrice: number;
  totalCost: number;
  filledAmount: number;
  partialFill: boolean;
};

type Translator = (key: string) => string;
type FormatTranslation = (template: string, vars: Record<string, string>) => string;

export function formatUnitsNumber(value: bigint, decimals: number) {
  try {
    return Number(ethers.formatUnits(value, decimals));
  } catch {
    return Number(value);
  }
}

export function buildOrdersFromFills(fills: any[]) {
  const ordersArr: any[] = [];
  const sigArr: string[] = [];
  const fillArr: bigint[] = [];
  for (const f of fills) {
    const fillAmount = BigInt(String(f?.fillAmount || "0"));
    if (fillAmount <= 0n) continue;
    const req = f?.req || {};
    ordersArr.push({
      maker: String(req.maker),
      outcomeIndex: Number(req.outcomeIndex),
      isBuy: Boolean(req.isBuy),
      price: BigInt(String(req.price)),
      amount: BigInt(String(req.amount)),
      salt: BigInt(String(req.salt)),
      expiry: BigInt(String(req.expiry || "0")),
    });
    sigArr.push(String(f.signature));
    fillArr.push(fillAmount);
  }
  return { ordersArr, sigArr, fillArr };
}

export function buildMarketPlanPreview(
  payload: MarketPlanPayload,
  amountBN: bigint
): MarketPlanPreview {
  const filledAmount = Number(payload.filledBN) / 1e18;
  const totalCost = Number(payload.totalCostBN) / 1e6;
  const avgPriceFromTotal = filledAmount > 0 && totalCost > 0 ? totalCost / filledAmount : 0;
  const avgPrice = avgPriceFromTotal > 0 ? avgPriceFromTotal : Number(payload.avgPriceBN) / 1e6;
  const worstPrice = Number(payload.worstPriceBN) / 1e6;
  const slippagePercent = (payload.slippageBpsNum || 0) / 100;
  const partialFill = payload.filledBN < amountBN;
  return {
    slippagePercent,
    avgPrice,
    worstPrice,
    totalCost,
    filledAmount,
    partialFill,
  };
}

export function buildMarketConfirmMessage(args: {
  payload: MarketPlanPayload;
  amountBN: bigint;
  decimals: number;
  tradeSide: "buy" | "sell";
  maxSlippage: number;
  tTrading: Translator;
  formatTranslation: FormatTranslation;
}) {
  const { payload, amountBN, decimals, tradeSide, maxSlippage, tTrading, formatTranslation } = args;
  const filledHuman = formatUnitsNumber(payload.filledBN, 18);
  const avgPriceHuman = formatUnitsNumber(payload.avgPriceBN, decimals);
  const worstPriceHuman = formatUnitsNumber(payload.worstPriceBN, decimals);
  const totalHuman = formatUnitsNumber(payload.totalCostBN, decimals);

  const slippagePercent = (payload.slippageBpsNum || 0) / 100;
  const isSlippageTooHigh = slippagePercent > maxSlippage;

  const sideLabel = tradeSide === "buy" ? tTrading("buy") : tTrading("sell");
  const avgPriceStr = Number.isFinite(avgPriceHuman)
    ? avgPriceHuman.toFixed(4)
    : String(avgPriceHuman);
  const worstPriceStr = Number.isFinite(worstPriceHuman)
    ? worstPriceHuman.toFixed(4)
    : String(worstPriceHuman);
  const totalStr = Number.isFinite(totalHuman) ? totalHuman.toFixed(2) : String(totalHuman);
  const filledStr = String(filledHuman);
  const totalAmountStr = String(formatUnitsNumber(amountBN, 18));
  const slippageStr = slippagePercent.toFixed(2);

  const message = formatTranslation(tTrading("orderFlow.marketConfirm"), {
    side: sideLabel,
    filled: filledStr,
    total: totalAmountStr,
    avgPrice: avgPriceStr,
    worstPrice: worstPriceStr,
    totalCost: totalStr,
    slippage: slippageStr,
  });

  return { message, slippagePercent, isSlippageTooHigh };
}

export async function fetchMarketPlanPayload({
  market,
  predictionIdRaw,
  tradeOutcome,
  tradeSide,
  amountBN,
}: {
  market: MarketInfo;
  predictionIdRaw: string | number;
  tradeOutcome: number;
  tradeSide: "buy" | "sell";
  amountBN: bigint;
}): Promise<MarketPlanPayload | null> {
  const marketKey = buildMarketKey(market.chain_id, predictionIdRaw);
  const qs = new URLSearchParams({
    contract: market.market,
    chainId: String(market.chain_id),
    marketKey,
    outcome: String(tradeOutcome),
    side: tradeSide,
    amount: amountBN.toString(),
  });
  const planRes = await fetch(`${API_BASE}/orderbook/market-plan?${qs.toString()}`);
  const planJson = await safeJson(planRes);
  if (!planJson.success || !planJson.data) {
    return null;
  }
  const plan = planJson.data as any;
  return {
    filledBN: BigInt(String(plan.filledAmount || "0")),
    totalCostBN: BigInt(String(plan.total || "0")),
    avgPriceBN: BigInt(String(plan.avgPrice || "0")),
    worstPriceBN: BigInt(String(plan.worstPrice || plan.bestPrice || "0")),
    bestPriceBN: BigInt(String(plan.bestPrice || "0")),
    slippageBpsNum: Number(String(plan.slippageBps || "0")),
    fills: Array.isArray(plan.fills) ? (plan.fills as any[]) : [],
  };
}
