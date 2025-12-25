"use client";

import { useEffect, useState } from "react";
import { buildMarketKey } from "../constants";
import { fetchOrderbookDepthApi } from "../orderbookApi";
import type { MarketInfo } from "../marketTypes";

export function useOrderbookDepthPolling(args: {
  market: MarketInfo | null;
  tradeOutcome: number;
  predictionIdRaw: string | number | undefined;
}) {
  const { market, tradeOutcome, predictionIdRaw } = args;
  const [depthBuy, setDepthBuy] = useState<Array<{ price: string; qty: string }>>([]);
  const [depthSell, setDepthSell] = useState<Array<{ price: string; qty: string }>>([]);
  const [bestBid, setBestBid] = useState<string>("");
  const [bestAsk, setBestAsk] = useState<string>("");

  useEffect(() => {
    if (!market || !predictionIdRaw) return;
    const fetchDepth = async () => {
      try {
        const marketKey = buildMarketKey(market.chain_id, predictionIdRaw);
        const { buys, sells } = await fetchOrderbookDepthApi(
          market.market,
          market.chain_id,
          marketKey,
          tradeOutcome
        );
        setDepthBuy(buys);
        setDepthSell(sells);
        setBestBid(buys.length > 0 ? buys[0].price : "");
        setBestAsk(sells.length > 0 ? sells[0].price : "");
      } catch {}
    };

    const timer = setInterval(fetchDepth, 2000);
    fetchDepth();
    return () => clearInterval(timer);
  }, [market, tradeOutcome, predictionIdRaw]);

  return {
    depthBuy,
    depthSell,
    bestBid,
    bestAsk,
    setDepthBuy,
    setDepthSell,
    setBestBid,
    setBestAsk,
  };
}
