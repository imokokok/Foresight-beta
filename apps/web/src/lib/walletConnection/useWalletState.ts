"use client";

import { useState } from "react";
import type { WalletType, WalletInfo } from "./types";

export type WalletState = {
  account: string | null;
  isConnecting: boolean;
  connectError: string | null;
  hasProvider: boolean;
  chainId: string | null;
  currentWalletType: WalletType | null;
  availableWallets: WalletInfo[];
};

export function useWalletState() {
  const [walletState, setWalletState] = useState<WalletState>({
    account: null,
    isConnecting: false,
    connectError: null,
    hasProvider: false,
    chainId: null,
    currentWalletType: null,
    availableWallets: [],
  });

  return {
    walletState,
    setWalletState,
  };
}
