"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { BIGINT_THRESHOLD } from "../utils/priceUtils";

function normalizeAddress(a: string | null | undefined) {
  const s = String(a || "").trim();
  if (!s) return null;
  return s.toLowerCase();
}

function computeReservedUsdcFallback(
  makerLower: string | null,
  userOrders: any[]
): number {
  if (!makerLower) return 0;
  let totalCost6 = 0n;
  for (const o of userOrders || []) {
    const maker = normalizeAddress((o as any)?.maker_address);
    if (!maker || maker !== makerLower) continue;
    if (!(o as any)?.is_buy) continue;
    try {
      const remaining = BigInt(String((o as any)?.remaining ?? (o as any)?.amount ?? "0"));
      const price = BigInt(String((o as any)?.price ?? "0"));
      if (remaining <= 0n || price <= 0n) continue;
      const cost = (remaining * price) / 1_000_000_000_000_000_000n;
      const priceDecimals = price > BIGINT_THRESHOLD ? 18 : 6;
      const cost6 = priceDecimals === 18 ? cost / 1_000_000_000_000n : cost;
      totalCost6 += cost6;
    } catch {
      continue;
    }
  }
  try {
    const human = Number(formatUnits(totalCost6, 6));
    return Number.isFinite(human) && human > 0 ? human : 0;
  } catch {
    return 0;
  }
}

export function useReservedBalance(
  account: string | null | undefined,
  proxyAddress: string | null | undefined,
  userOrders: any[]
) {
  const [reservedAccountUsdcBackend, setReservedAccountUsdcBackend] = useState<number | null>(null);
  const [reservedProxyUsdcBackend, setReservedProxyUsdcBackend] = useState<number | null>(null);

  useEffect(() => {
    const addr = normalizeAddress(account || null);
    const controller = new AbortController();
    if (!addr) {
      setReservedAccountUsdcBackend(null);
      return () => controller.abort();
    }
    (async () => {
      try {
        const res = await fetch(`/api/user-balance?address=${encodeURIComponent(addr)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as any;
        const reservedRaw = json?.data?.reserved;
        const n =
          typeof reservedRaw === "number" ? reservedRaw : parseFloat(String(reservedRaw || "0"));
        if (Number.isFinite(n) && n >= 0) setReservedAccountUsdcBackend(n);
      } catch {}
    })();
    return () => controller.abort();
  }, [account]);

  useEffect(() => {
    const addr = normalizeAddress(proxyAddress || null);
    const controller = new AbortController();
    if (!addr) {
      setReservedProxyUsdcBackend(null);
      return () => controller.abort();
    }
    (async () => {
      try {
        const res = await fetch(`/api/user-balance?address=${encodeURIComponent(addr)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as any;
        const reservedRaw = json?.data?.reserved;
        const n =
          typeof reservedRaw === "number" ? reservedRaw : parseFloat(String(reservedRaw || "0"));
        if (Number.isFinite(n) && n >= 0) setReservedProxyUsdcBackend(n);
      } catch {}
    })();
    return () => controller.abort();
  }, [proxyAddress]);

  const reservedAccountUsdc =
    reservedAccountUsdcBackend ?? computeReservedUsdcFallback(normalizeAddress(account || null), userOrders);
  const reservedProxyUsdc =
    reservedProxyUsdcBackend ?? computeReservedUsdcFallback(normalizeAddress(proxyAddress || null), userOrders);

  return {
    reservedAccountUsdc,
    reservedProxyUsdc,
  };
}
