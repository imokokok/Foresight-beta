"use client";
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  provider: { request: (args: { method: string }) => Promise<unknown> } | null;
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
  const mountedRef = useRef(true);
  const disconnectRef = useRef<(() => Promise<void>) | null>(null);

  const disconnect = async () => {
    setState({
      address: null,
      chainId: null,
      isConnected: false,
      provider: null,
    });
    setError(null);
  };

  const checkConnection = async () => {
    try {
      if (
        typeof window !== "undefined" &&
        (
          window as unknown as {
            ethereum?: {
              selectedAddress?: string;
              request?: (args: { method: string }) => Promise<unknown>;
            };
          }
        ).ethereum
      ) {
        const ethereum = (
          window as unknown as {
            ethereum: {
              selectedAddress?: string;
              request?: (args: { method: string }) => Promise<unknown>;
            };
          }
        ).ethereum;
        const address = ethereum.selectedAddress;
        if (address) {
          let chainId: number | null = null;
          try {
            if (typeof ethereum.request === "function") {
              const chainIdHex = await ethereum.request({ method: "eth_chainId" });
              if (typeof chainIdHex === "string") {
                chainId = parseInt(chainIdHex, 16);
              }
            }
          } catch {
            chainId = null;
          }
          if (!mountedRef.current) return;
          setState({
            address: `0x${address}`,
            chainId,
            isConnected: true,
            provider: ethereum as { request: (args: { method: string }) => Promise<unknown> },
          });
        }
      }
    } catch {
      if (!mountedRef.current) return;
      setError("Failed to check wallet connection");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    checkConnection();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const eth = (window as unknown as { ethereum?: unknown }).ethereum;
    if (!eth || typeof eth !== "object") return;

    const ethereum = eth as Record<string, (...args: unknown[]) => void>;

    const handleChainChanged = (...args: unknown[]) => {
      const chainIdHex = args[0] as string;
      const newChainId = parseInt(chainIdHex, 16);
      setState((prev) => ({ ...prev, chainId: newChainId }));
    };

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState((prev) => ({
          ...prev,
          address: accounts[0],
          isConnected: true,
        }));
      }
    };

    if (typeof ethereum.on === "function") {
      ethereum.on("chainChanged", handleChainChanged);
      ethereum.on("accountsChanged", handleAccountsChanged);
    }

    return () => {
      if (typeof ethereum.removeListener === "function") {
        ethereum.removeListener("chainChanged", handleChainChanged);
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
      if (typeof ethereum.off === "function") {
        ethereum.off("chainChanged", handleChainChanged);
        ethereum.off("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      if (
        typeof window !== "undefined" &&
        (
          window as unknown as {
            ethereum?: { request: (args: { method: string }) => Promise<unknown> };
          }
        ).ethereum
      ) {
        const ethereum = (
          window as unknown as {
            ethereum: { request: (args: { method: string }) => Promise<unknown> };
          }
        ).ethereum;
        const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
        if (accounts.length > 0) {
          let chainId: number | null = null;
          try {
            const chainIdHex = await ethereum.request({ method: "eth_chainId" });
            if (typeof chainIdHex === "string") {
              chainId = parseInt(chainIdHex, 16);
            }
          } catch {
            chainId = null;
          }
          setState({
            address: accounts[0],
            chainId,
            isConnected: true,
            provider: ethereum as { request: (args: { method: string }) => Promise<unknown> },
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

  const switchChain = async (chainId: number) => {
    try {
      if (
        typeof window !== "undefined" &&
        (
          window as unknown as {
            ethereum?: {
              request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            };
          }
        ).ethereum
      ) {
        const ethereum = (
          window as unknown as {
            ethereum: {
              request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            };
          }
        ).ethereum;
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
        setState((prev) => ({ ...prev, chainId }));
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
