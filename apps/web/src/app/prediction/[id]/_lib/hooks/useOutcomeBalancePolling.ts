"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { erc1155Abi, marketAbi } from "../abis";
import type { MarketInfo } from "../marketTypes";
import { createBrowserProvider, ensureNetwork } from "../wallet";

export function useOutcomeBalancePolling({
  market,
  address,
  walletProvider,
  switchNetwork,
  tradeOutcome,
}: {
  market: MarketInfo | null | undefined;
  address: string | null | undefined;
  walletProvider: any;
  switchNetwork: (chainId: number) => Promise<void>;
  tradeOutcome: number;
}) {
  const [balance, setBalance] = useState<string>("0");

  useEffect(() => {
    let cancelled = false;
    if (!market || !address || !walletProvider) return;
    const run = async () => {
      try {
        const provider = await createBrowserProvider(walletProvider);
        await ensureNetwork(provider, market.chain_id, switchNetwork);
        const signer = await provider.getSigner();
        const marketContract = new ethers.Contract(market.market, marketAbi, signer);
        const outcomeTokenAddress = await marketContract.outcomeToken();
        const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);
        const tokenId = (BigInt(market.market) << 32n) | BigInt(tradeOutcome);
        const bal = await outcome1155.balanceOf(address, tokenId);
        if (!cancelled) setBalance(BigInt(bal).toString());
      } catch {
        if (!cancelled) setBalance("0");
      }
    };
    void run();
    const timer = setInterval(run, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [market, address, walletProvider, switchNetwork, tradeOutcome]);

  return balance;
}
