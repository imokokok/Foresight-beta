"use client";

import { useCallback } from "react";

export function useWalletEventListeners() {
  const setupEventListeners = useCallback(
    (
      provider: any,
      handleAccountsChanged: (accounts: string[]) => void,
      handleChainChanged: (chainId: string | number) => void
    ) => {
      const ethereum = typeof window !== "undefined" ? (window as any).ethereum : undefined;
      const p = provider || ethereum;
      if (p && p.on) {
        p.on("accountsChanged", handleAccountsChanged);
        p.on("chainChanged", handleChainChanged);
      }
    },
    []
  );

  const removeEventListeners = useCallback(
    (
      provider: any,
      handleAccountsChanged: (accounts: string[]) => void,
      handleChainChanged: (chainId: string | number) => void
    ) => {
      if (provider?.removeListener) {
        provider.removeListener("accountsChanged", handleAccountsChanged);
        provider.removeListener("chainChanged", handleChainChanged);
      } else if (provider?.off) {
        provider.off("accountsChanged", handleAccountsChanged);
        provider.off("chainChanged", handleChainChanged);
      }
    },
    []
  );

  return {
    setupEventListeners,
    removeEventListeners,
  };
}
