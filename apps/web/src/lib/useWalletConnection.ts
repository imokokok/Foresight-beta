"use client";
import { useCallback, useEffect, useRef } from "react";
import { detectWallets, handleEIP6963Announce, identifyWalletType } from "./walletDetection";
import { useWalletState } from "./walletConnection/useWalletState";
import { useWalletEventListeners } from "./walletConnection/useWalletEventListeners";
import { useWalletProviderDetection } from "./walletConnection/useWalletProviderDetection";
import { useWalletConnect } from "./walletConnection/useWalletConnect";
import { useWalletDisconnect } from "./walletConnection/useWalletDisconnect";
import type { WalletType } from "./walletConnection/types";
export type { WalletType, WalletConnectResult, WalletInfo } from "./walletConnection/types";
export type { WalletState } from "./walletConnection/useWalletState";

type Params = {
  onAccountsChanged?: (account: string | null) => void;
};

export function useWalletConnection(params: Params = {}) {
  const { walletState, setWalletState } = useWalletState();
  const { setupEventListeners, removeEventListeners } = useWalletEventListeners();
  const { findProviderByType, getDefaultProvider } = useWalletProviderDetection();
  const { disconnectWallet: disconnectWalletImpl } = useWalletDisconnect();

  const currentProviderRef = useRef<any>(null);
  const { onAccountsChanged } = params;

  const handleAccountsChanged = useCallback(
    (accounts: string[]) => {
      if (accounts.length > 0) {
        setWalletState((prev) => ({
          ...prev,
          account: accounts[0],
        }));
        if (onAccountsChanged) {
          onAccountsChanged(accounts[0]);
        }
      } else {
        setWalletState((prev) => ({
          ...prev,
          account: null,
          chainId: null,
          balanceEth: null,
          currentWalletType: null,
        }));
        if (onAccountsChanged) {
          onAccountsChanged(null);
        }
      }
    },
    [onAccountsChanged, setWalletState]
  );

  const handleChainChanged = useCallback(
    (chainId: string | number) => {
      const raw = String(chainId);
      let hex = "";
      if (raw.startsWith("0x")) {
        if (/^0x[0-9a-fA-F]+$/.test(raw)) hex = raw.toLowerCase();
      } else {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) hex = `0x${Math.floor(n).toString(16)}`;
      }
      setWalletState((prev) => ({
        ...prev,
        chainId: hex || null,
      }));
    },
    [setWalletState]
  );

  const { connectWalletWithResult } = useWalletConnect({
    findProviderByType,
    getDefaultProvider,
    setWalletState,
    setupEventListeners,
    handleAccountsChanged,
    handleChainChanged,
    onAccountsChanged,
    currentProviderRef,
  });

  useEffect(() => {
    let onAnnounce: any;
    if (typeof window !== "undefined") {
      onAnnounce = (ev: any) => {
        handleEIP6963Announce(ev);
        const updated = detectWallets();
        const hasProvider =
          !!(window as any).ethereum ||
          !!(window as any).BinanceChain ||
          (Array.isArray((window as any).ethereum?.providers) &&
            (window as any).ethereum.providers.length > 0) ||
          updated.length > 0;
        setWalletState((prev) => ({ ...prev, hasProvider, availableWallets: updated }));
      };
      window.addEventListener("eip6963:announceProvider", onAnnounce);
      window.dispatchEvent(new Event("eip6963:requestProvider"));
      setTimeout(() => {
        const updated = detectWallets();
        const hasProvider =
          !!(window as any).ethereum ||
          !!(window as any).BinanceChain ||
          (Array.isArray((window as any).ethereum?.providers) &&
            (window as any).ethereum.providers.length > 0) ||
          updated.length > 0;
        setWalletState((prev) => ({ ...prev, hasProvider, availableWallets: updated }));
      }, 200);
    }

    const availableWallets = detectWallets();
    const hasProvider =
      typeof window !== "undefined" &&
      (!!(window as any).ethereum ||
        !!(window as any).BinanceChain ||
        (Array.isArray((window as any).ethereum?.providers) &&
          (window as any).ethereum.providers.length > 0) ||
        availableWallets.length > 0);

    setWalletState((prev) => ({
      ...prev,
      hasProvider,
      availableWallets,
    }));

    const checkConnection = async () => {
      try {
        const LOGOUT_FLAG = "fs_wallet_logged_out";
        if (typeof window !== "undefined" && sessionStorage.getItem(LOGOUT_FLAG)) {
          return;
        }

        const lastWalletType =
          typeof window !== "undefined"
            ? (localStorage.getItem("lastWalletType") as WalletType | null) || null
            : null;

        let targetProvider: any = null;

        if (lastWalletType) {
          targetProvider = findProviderByType(lastWalletType);
        }

        if (targetProvider) {
          let accounts: string[] = [];
          try {
            accounts = await targetProvider.request({ method: "eth_accounts" });
          } catch {}

          if (accounts && accounts.length > 0) {
            const currentWalletType = identifyWalletType(targetProvider);
            setWalletState((prev) => ({
              ...prev,
              account: accounts[0],
              currentWalletType: currentWalletType || lastWalletType,
            }));
            currentProviderRef.current = targetProvider;
            setupEventListeners(targetProvider, handleAccountsChanged, handleChainChanged);
            if (
              currentWalletType &&
              currentWalletType !== lastWalletType &&
              typeof window !== "undefined"
            ) {
              localStorage.setItem("lastWalletType", currentWalletType);
            }
            if (onAccountsChanged) {
              onAccountsChanged(accounts[0]);
            }
          }
        }
      } catch {}
    };

    checkConnection();

    return () => {
      if (typeof window !== "undefined" && onAnnounce) {
        window.removeEventListener("eip6963:announceProvider", onAnnounce);
      }
    };
  }, [
    handleAccountsChanged,
    handleChainChanged,
    onAccountsChanged,
    findProviderByType,
    setWalletState,
    setupEventListeners,
  ]);

  const connectWallet = useCallback(
    async (walletType?: WalletType) => {
      await connectWalletWithResult(walletType);
    },
    [connectWalletWithResult]
  );

  const disconnectWallet = useCallback(async () => {
    const currentProvider = currentProviderRef.current;
    const removeListeners = () => {
      if (currentProvider) {
        removeEventListeners(currentProvider, handleAccountsChanged, handleChainChanged);
      }
    };

    await disconnectWalletImpl(currentProvider, removeListeners);

    setWalletState((prev) => ({
      ...prev,
      account: null,
      chainId: null,
      currentWalletType: null,
    }));

    currentProviderRef.current = null;
  }, [
    disconnectWalletImpl,
    removeEventListeners,
    handleAccountsChanged,
    handleChainChanged,
    setWalletState,
  ]);

  return {
    walletState,
    connectWallet,
    connectWalletWithResult,
    disconnectWallet,
    currentProviderRef,
    handleChainChanged,
  };
}
