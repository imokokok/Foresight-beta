"use client";

import { useCallback } from "react";
import { ethers } from "ethers";
import { identifyWalletType } from "../walletDetection";
import { t } from "../i18n";
import type { WalletType, WalletConnectResult } from "./types";

const LOGOUT_FLAG = "fs_wallet_logged_out";

export function useWalletConnect({
  findProviderByType,
  getDefaultProvider,
  setWalletState,
  setupEventListeners,
  handleAccountsChanged,
  handleChainChanged,
  onAccountsChanged,
  currentProviderRef,
}: {
  findProviderByType: (walletType: string) => any;
  getDefaultProvider: () => any;
  setWalletState: React.Dispatch<React.SetStateAction<any>>;
  setupEventListeners: (
    provider: any,
    handleAccountsChanged: (accounts: string[]) => void,
    handleChainChanged: (chainId: string | number) => void
  ) => void;
  handleAccountsChanged: (accounts: string[]) => void;
  handleChainChanged: (chainId: string | number) => void;
  onAccountsChanged?: (account: string | null) => void;
  currentProviderRef: React.MutableRefObject<any>;
}) {
  const connectWalletWithResult = useCallback(
    async (walletType?: WalletType): Promise<WalletConnectResult> => {
      setWalletState((prev: any) => ({
        ...prev,
        isConnecting: true,
        connectError: null,
      }));

      try {
        if (typeof window === "undefined") {
          throw new Error(t("errors.wallet.useInBrowser"));
        }
        const ethereum: any = (window as any).ethereum;
        const klaytn: any = (window as any).klaytn;
        const trustwallet: any = (window as any).trustwallet;
        if (!ethereum && !(window as any).BinanceChain && !klaytn && !trustwallet) {
          throw new Error(t("errors.wallet.installExtension"));
        }

        window.dispatchEvent(new Event("eip6963:scan"));

        let targetProvider: any = null;

        if (walletType) {
          targetProvider = findProviderByType(walletType);

          // OKX 钱包可能需要等待
          if (!targetProvider && walletType === "okx") {
            await new Promise((resolve) => setTimeout(resolve, 100));
            targetProvider = findProviderByType(walletType);
          }

          if (!targetProvider && walletType === "okx") {
            throw new Error(t("errors.wallet.okxNotInstalled"));
          }
        } else {
          targetProvider = getDefaultProvider();
        }

        if (!targetProvider || typeof targetProvider.request !== "function") {
          if (walletType === "okx") {
            throw new Error(t("errors.wallet.okxNotInitialized"));
          }
          throw new Error(t("errors.wallet.walletNotInitialized"));
        }

        const accounts = await targetProvider.request({ method: "eth_requestAccounts" });

        if (accounts && accounts.length > 0) {
          const provider = new ethers.BrowserProvider(targetProvider);
          const network = await provider.getNetwork();
          const hexChainId =
            typeof network.chainId === "bigint"
              ? "0x" + network.chainId.toString(16)
              : ((ethers.toBeHex as any)?.(network.chainId) ??
                "0x" + Number(network.chainId).toString(16));

          const actualWalletType = identifyWalletType(targetProvider);
          const finalWalletType = (actualWalletType || walletType || null) as WalletType | null;

          setWalletState((prev: any) => ({
            ...prev,
            account: accounts[0],
            chainId: hexChainId,
            isConnecting: false,
            currentWalletType: finalWalletType,
          }));

          if (finalWalletType && typeof window !== "undefined") {
            localStorage.setItem("lastWalletType", finalWalletType);
          }

          currentProviderRef.current = targetProvider;
          setupEventListeners(targetProvider, handleAccountsChanged, handleChainChanged);

          if (typeof window !== "undefined") {
            sessionStorage.removeItem(LOGOUT_FLAG);
          }

          if (onAccountsChanged) {
            onAccountsChanged(accounts[0]);
          }

          return {
            success: true,
            account: accounts[0],
            chainId: hexChainId || null,
            currentWalletType: finalWalletType,
            provider: targetProvider,
          };
        }

        const message = t("errors.wallet.connectFailed");
        setWalletState((prev: any) => ({
          ...prev,
          isConnecting: false,
          connectError: message,
        }));
        return { success: false, error: message };
      } catch (error: any) {
        const message = error?.message || t("errors.wallet.connectFailed");
        setWalletState((prev: any) => ({
          ...prev,
          isConnecting: false,
          connectError: message,
        }));
        return { success: false, error: message };
      }
    },
    [
      findProviderByType,
      getDefaultProvider,
      setWalletState,
      setupEventListeners,
      handleAccountsChanged,
      handleChainChanged,
      onAccountsChanged,
      currentProviderRef,
    ]
  );

  return {
    connectWalletWithResult,
  };
}
