"use client";

import { useCallback, useEffect, useState } from "react";
import { buildMarketKey } from "../constants";
import { fetchUserOpenOrdersApi } from "../orderbookApi";
import type { MarketInfo } from "../marketTypes";

export function useUserOpenOrders(args: {
  market: MarketInfo | null;
  account: string | null | undefined;
  predictionIdRaw: string | number | undefined;
}) {
  const { market, account, predictionIdRaw } = args;
  const [openOrders, setOpenOrders] = useState<any[]>([]);

  const refreshUserOrders = useCallback(async () => {
    if (!market || !account || !predictionIdRaw) return;
    try {
      const marketKey = buildMarketKey(market.chain_id, predictionIdRaw);
      const orders = await fetchUserOpenOrdersApi(
        market.market,
        market.chain_id,
        marketKey,
        account
      );
      setOpenOrders(orders);
    } catch (e) {
      console.error("Refresh orders failed", e);
    }
  }, [market, account, predictionIdRaw]);

  useEffect(() => {
    if (!market || !account) return;
    refreshUserOrders();
    const timer = setInterval(refreshUserOrders, 5000);
    return () => clearInterval(timer);
  }, [market, account, refreshUserOrders]);

  return { openOrders, setOpenOrders, refreshUserOrders };
}
