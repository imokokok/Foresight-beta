"use client";

import { useEffect, useState } from "react";
import { safeJson } from "../http";

export function useProxyAddress(account: string | null | undefined) {
  const [proxyAddress, setProxyAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!account) {
      setProxyAddress(undefined);
      return;
    }
    const fetchProxy = async () => {
      try {
        const res = await fetch("/api/wallets/proxy", { method: "POST" });
        const json = await safeJson(res);
        if (json.success && json.data?.address) {
          setProxyAddress(json.data.address);
        }
      } catch (e) {
        console.error("Failed to fetch proxy wallet", e);
      }
    };
    fetchProxy();
  }, [account]);

  return proxyAddress;
}
