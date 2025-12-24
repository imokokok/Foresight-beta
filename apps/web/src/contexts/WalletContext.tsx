"use client";
import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { useWalletConnection, type WalletState, type WalletType } from "../lib/useWalletConnection";
import {
  detectWallets,
  identifyWalletType,
  type WalletInfo,
  getActiveRawProvider,
} from "../lib/walletDetection";
import { useWalletBalance } from "../lib/useWalletBalance";
import { useSiweAuth } from "../lib/useSiweAuth";
import { requestWalletPermissions as requestWalletPermissionsImpl } from "../lib/walletPermissions";
import { multisigSign as multisigSignImpl } from "../lib/walletMultisig";
import { switchNetwork as switchNetworkImpl } from "../lib/walletNetwork";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isBinanceWallet?: boolean;
      providers?: any[];
    };
    coinbaseWalletExtension?: any;
    BinanceChain?: any;
  }
}

interface WalletContextType extends WalletState {
  connectWallet: (walletType?: WalletType) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  formatAddress: (addr: string) => string;
  detectWallets: () => WalletInfo[];
  identifyWalletType: (provider?: any) => WalletType | null;
  siweLogin: () => Promise<{ success: boolean; address?: string; error?: string }>;
  requestWalletPermissions: () => Promise<{ success: boolean; error?: string }>;
  multisigSign: (data?: {
    verifyingContract?: string;
    action?: string;
    nonce?: number;
  }) => Promise<{ success: boolean; signature?: string; error?: string }>;
  refreshBalance: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  balanceEth: string | null;
  balanceLoading: boolean;
  provider: any;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { walletState, connectWallet, disconnectWallet, currentProviderRef, handleChainChanged } =
    useWalletConnection();

  const rawProvider = getActiveRawProvider(currentProviderRef);

  const { balanceEth, balanceLoading, refreshBalance } = useWalletBalance({
    account: walletState.account,
    rawProvider,
    chainIdHex: walletState.chainId,
  });

  const { siweLogin } = useSiweAuth({
    providerRef: currentProviderRef,
    account: walletState.account,
    chainIdHex: walletState.chainId,
  });

  useEffect(() => {
    if (walletState.account && rawProvider) {
      refreshBalance(walletState.account);
    }
  }, [walletState.account, walletState.chainId, rawProvider, refreshBalance]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const requestWalletPermissions = async (): Promise<{ success: boolean; error?: string }> => {
    return requestWalletPermissionsImpl(rawProvider);
  };

  const multisigSign = async (data?: {
    verifyingContract?: string;
    action?: string;
    nonce?: number;
  }): Promise<{ success: boolean; signature?: string; error?: string }> => {
    return multisigSignImpl(rawProvider, walletState, data);
  };

  const switchNetwork = async (chainId: number) => {
    await switchNetworkImpl(rawProvider, chainId);

    if (!rawProvider) return;

    try {
      const chainIdHex = await rawProvider.request({ method: "eth_chainId" });
      handleChainChanged(chainIdHex);
      const accounts = await rawProvider.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) {
        await refreshBalance(accounts[0]);
      }
    } catch {}
  };

  const contextValue: WalletContextType = {
    ...walletState,
    balanceEth,
    balanceLoading,
    connectWallet,
    disconnectWallet,
    formatAddress,
    detectWallets,
    identifyWalletType,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
    refreshBalance: () => refreshBalance(),
    switchNetwork,
    provider: rawProvider,
  };

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
