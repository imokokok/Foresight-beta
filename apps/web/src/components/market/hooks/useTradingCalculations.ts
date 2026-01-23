"use client";

import { useMemo } from "react";
import { decodePrice } from "../utils/priceUtils";

export function useTradingCalculations({
  shareBalance,
  positionStake,
  bestBid,
  bestAsk,
}: {
  shareBalance?: string;
  positionStake?: number;
  bestBid: string;
  bestAsk: string;
}) {
  const currentShares = useMemo(() => {
    if (!shareBalance) return 0;
    try {
      const raw = BigInt(shareBalance);
      if (raw > 0n) {
        return Number(raw) / 1e18;
      }
    } catch {
      return 0;
    }
    return 0;
  }, [shareBalance]);

  const markPrice = useMemo(() => {
    const bidDec = decodePrice(bestBid);
    const askDec = decodePrice(bestAsk);
    if (bidDec > 0 && askDec > 0) {
      return (bidDec + askDec) / 2;
    } else if (bidDec > 0) {
      return bidDec;
    } else if (askDec > 0) {
      return askDec;
    }
    return 0;
  }, [bestBid, bestAsk]);

  const stakeBefore = useMemo(() => {
    return typeof positionStake === "number" && positionStake > 0 ? positionStake : 0;
  }, [positionStake]);

  const markValue = useMemo(() => {
    if (currentShares > 0 && markPrice > 0) {
      return currentShares * markPrice;
    }
    return 0;
  }, [currentShares, markPrice]);

  const unrealizedPnl = useMemo(() => {
    if (currentShares > 0 && markPrice > 0 && stakeBefore > 0) {
      return markValue - stakeBefore;
    }
    return 0;
  }, [currentShares, markPrice, stakeBefore, markValue]);

  const unrealizedPct = useMemo(() => {
    if (currentShares > 0 && markPrice > 0 && stakeBefore > 0) {
      return (unrealizedPnl / stakeBefore) * 100;
    }
    return 0;
  }, [currentShares, markPrice, stakeBefore, unrealizedPnl]);

  const hasPositionCard = useMemo(() => {
    return currentShares > 0 && markPrice > 0 && stakeBefore > 0;
  }, [currentShares, markPrice, stakeBefore]);

  return {
    currentShares,
    markPrice,
    stakeBefore,
    markValue,
    unrealizedPnl,
    unrealizedPct,
    hasPositionCard,
  };
}
