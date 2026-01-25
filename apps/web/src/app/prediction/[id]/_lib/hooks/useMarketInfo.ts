"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../constants";
import { safeJson } from "../http";
import type { MarketInfo } from "../marketTypes";

export function useMarketInfo(predictionIdRaw: string | number | undefined) {
  const [market, setMarket] = useState<MarketInfo | null>(null);

  useEffect(() => {
    if (!predictionIdRaw) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadMarket = async () => {
      try {
        const resp = await fetch(`${API_BASE}/markets/map?id=${predictionIdRaw}`);
        const j = await safeJson(resp);
        if (cancelled) return;
        if (j?.success && j?.data) setMarket(j.data);
      } catch {}
    };

    loadMarket();
    timer = setInterval(loadMarket, 10000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [predictionIdRaw]);

  return { market, setMarket };
}
