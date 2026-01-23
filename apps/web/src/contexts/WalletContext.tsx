"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  provider: unknown | null;
}

export interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    provider: null,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkConnection = async () => {
    try {
      if (typeof window !== "undefined" && (window as unknown as { ethereum?: { selectedAddress?: string } }).ethereum) {
        const ethereum = (window as unknown as { ethereum: { selectedAddress?: string; chainId?: string } }).ethereum;
        const address = ethereum.selectedAddress;
        if (address) {
          setState({
            address: `0x${address}`,
            chainId: null,
            isConnected: true,
            provider: ethereum,
          });
        }
      }
    } catch {
      setError("Failed to check wallet connection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== "undefined" && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum) {
        const ethereum = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<unknown> } }).ethereum;
        const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
        if (accounts.length > 0) {
          setState({
            address: accounts[0],
            chainId: null,
            isConnected: true,
            provider: ethereum,
          });
        }
      } else {
        setError("No wallet provider found");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setState({
      address: null,
      chainId: null,
      isConnected: false,
      provider: null,
    });
    setError(null);
  };

  const switchChain = async (chainId: number) => {
    try {
      if (typeof window !== "undefined" && (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum) {
        const ethereum = (window as unknown as { ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
        setState(prev => ({ ...prev, chainId }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to switch chain");
    }
  };

  const value: WalletContextValue = {
    ...state,
    connect,
    disconnect,
    switchChain,
    loading,
    error,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export function useWalletOptional() {
  return useContext(WalletContext);
}
