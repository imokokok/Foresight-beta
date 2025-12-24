"use client";
import { useCallback, useState } from "react";
import { ethers } from "ethers";
import { getFallbackRpcUrl } from "./walletProviderUtils";

type Params = {
  account: string | null;
  rawProvider: any;
  chainIdHex?: string | null;
};

export function useWalletBalance(params: Params) {
  const [balanceEth, setBalanceEth] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const refreshBalance = useCallback(
    async (addressOverride?: string) => {
      try {
        const rawProvider = params.rawProvider;
        const address = addressOverride || params.account;
        if (!rawProvider || !address) return;
        setBalanceLoading(true);
        const provider = new ethers.BrowserProvider(rawProvider);
        try {
          const bal = await provider.getBalance(address);
          const eth = Number(ethers.formatEther(bal));
          const display = eth >= 0.0001 ? eth.toFixed(4) : eth.toFixed(6);
          setBalanceEth(display);
          setBalanceLoading(false);
          return;
        } catch (primaryErr: any) {
          let chainIdNum: number | undefined;
          try {
            const net = await provider.getNetwork();
            chainIdNum = Number(net.chainId);
          } catch {
            try {
              const hex = await (rawProvider as any)?.request?.({ method: "eth_chainId" });
              if (hex) chainIdNum = parseInt(String(hex), 16);
            } catch {
              if (params.chainIdHex) {
                try {
                  chainIdNum = parseInt(params.chainIdHex, 16);
                } catch {}
              }
            }
          }

          const fallbackUrl = getFallbackRpcUrl(chainIdNum || 1);
          if (!fallbackUrl) {
            setBalanceLoading(false);
            return;
          }

          try {
            const httpProvider = new ethers.JsonRpcProvider(fallbackUrl);
            const bal = await httpProvider.getBalance(address);
            const eth = Number(ethers.formatEther(bal));
            const display = eth >= 0.0001 ? eth.toFixed(4) : eth.toFixed(6);
            setBalanceEth(display);
            setBalanceLoading(false);
            return;
          } catch {
            setBalanceLoading(false);
            return;
          }
        }
      } catch {
        setBalanceLoading(false);
      }
    },
    [params.account, params.chainIdHex, params.rawProvider]
  );

  return {
    balanceEth,
    balanceLoading,
    refreshBalance,
  };
}
