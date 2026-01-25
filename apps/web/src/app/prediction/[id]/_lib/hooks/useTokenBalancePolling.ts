"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { erc20Abi } from "../abis";
import type { MarketInfo } from "../marketTypes";
import { createBrowserProvider, ensureNetwork, getCollateralTokenContract } from "../wallet";

export function useTokenBalancePolling({
  market,
  address,
  walletProvider,
  switchNetwork,
}: {
  market: MarketInfo | null | undefined;
  address: string | null | undefined;
  walletProvider: any;
  switchNetwork: (chainId: number) => Promise<void>;
}) {
  const [balance, setBalance] = useState<string>("0.00");

  useEffect(() => {
    let cancelled = false;
    let mounted = true;
    if (!market || !address || !walletProvider) return;
    const run = async () => {
      try {
        const provider = await createBrowserProvider(walletProvider);
        await ensureNetwork(provider, market.chain_id, switchNetwork);
        const signer = await provider.getSigner();
        const { tokenContract, decimals } = await getCollateralTokenContract(
          market,
          signer,
          erc20Abi
        );
        const bal = await tokenContract.balanceOf(address);
        const human = Number(ethers.formatUnits(bal, decimals));
        if (mounted && !cancelled) {
          setBalance(Number.isFinite(human) ? human.toFixed(2) : "0.00");
        }
      } catch {
        if (mounted && !cancelled) {
          setBalance("0.00");
        }
      }
    };
    void run();
    const timer = setInterval(run, 15000);
    return () => {
      cancelled = true;
      mounted = false;
      clearInterval(timer);
    };
  }, [market, address, walletProvider, switchNetwork]);

  return balance;
}
