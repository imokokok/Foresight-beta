"use client";

import { useEffect, useState } from "react";
import type { MarketInfo } from "../marketTypes";
import type { MarketPlanPreview } from "../orderbookPlan";
import { fetchMarketPlanPayload, buildMarketPlanPreview } from "../orderbookPlan";
import { parseUnitsByDecimals } from "../wallet";

export function useMarketPlanPreview({
  market,
  predictionIdRaw,
  tradeOutcome,
  tradeSide,
  amountInput,
  orderMode,
}: {
  market: MarketInfo | null;
  predictionIdRaw: string;
  tradeOutcome: number;
  tradeSide: "buy" | "sell";
  amountInput: string;
  orderMode: "limit" | "best";
}) {
  const [marketPlanPreview, setMarketPlanPreview] = useState<MarketPlanPreview | null>(null);
  const [marketPlanLoading, setMarketPlanLoading] = useState(false);

  useEffect(() => {
    if (orderMode !== "best" || !market) {
      setMarketPlanPreview(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      const run = async () => {
        try {
          setMarketPlanLoading(true);
          const amountBN = parseUnitsByDecimals(amountInput, 18);
          if (amountBN <= 0n) {
            if (!cancelled) setMarketPlanPreview(null);
            return;
          }
          const payload = await fetchMarketPlanPayload({
            market: market as MarketInfo,
            predictionIdRaw,
            tradeOutcome,
            tradeSide,
            amountBN,
          });
          if (!payload || payload.filledBN === 0n) {
            if (!cancelled) setMarketPlanPreview(null);
            return;
          }
          if (!cancelled) setMarketPlanPreview(buildMarketPlanPreview(payload, amountBN));
        } catch {
          if (!cancelled) setMarketPlanPreview(null);
        } finally {
          if (!cancelled) setMarketPlanLoading(false);
        }
      };
      void run();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [market, predictionIdRaw, tradeOutcome, tradeSide, amountInput, orderMode]);

  return {
    marketPlanPreview,
    marketPlanLoading,
  };
}
