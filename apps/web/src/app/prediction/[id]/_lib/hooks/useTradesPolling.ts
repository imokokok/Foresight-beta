"use client";

import { useEffect, useState } from "react";
import { fetchTradesApi } from "../orderbookApi";
import type { MarketInfo } from "../marketTypes";

export function useTradesPolling(market: MarketInfo | null) {
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    if (!market) return;
    const fetchTrades = async () => {
      try {
        const items = await fetchTradesApi(market.market, market.chain_id);
        setTrades(items);
      } catch (e) {
        console.error("Fetch trades failed", e);
      }
    };

    fetchTrades();
    const timer = setInterval(fetchTrades, 5000);
    return () => clearInterval(timer);
  }, [market]);

  return { trades, setTrades };
}
