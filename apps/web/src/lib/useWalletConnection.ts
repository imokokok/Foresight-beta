"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WalletInfo } from "./walletDetection";
import {
  detectWallets,
  handleEIP6963Announce,
  identifyWalletType,
  getActiveRawProvider,
} from "./walletDetection";
import { ethers } from "ethers";
import { t } from "./i18n";

export type WalletType = "metamask" | "coinbase" | "binance" | "okx" | "kaia" | "trust";

export type WalletState = {
  account: string | null;
  isConnecting: boolean;
  connectError: string | null;
  hasProvider: boolean;
  chainId: string | null;
  currentWalletType: WalletType | null;
  availableWallets: WalletInfo[];
};

type Params = {
  onAccountsChanged?: (account: string | null) => void;
};

const LOGOUT_FLAG = "fs_wallet_logged_out";

function setupEventListeners(
  provider: any,
  handleAccountsChanged: (accounts: string[]) => void,
  handleChainChanged: (chainId: string | number) => void
) {
  const ethereum = typeof window !== "undefined" ? (window as any).ethereum : undefined;
  const p = provider || ethereum;
  if (p && p.on) {
    p.on("accountsChanged", handleAccountsChanged);
    p.on("chainChanged", handleChainChanged);
  }
}

export function useWalletConnection(params: Params = {}) {
  const [walletState, setWalletState] = useState<WalletState>({
    account: null,
    isConnecting: false,
    connectError: null,
    hasProvider: false,
    chainId: null,
    currentWalletType: null,
    availableWallets: [],
  });

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
    [onAccountsChanged]
  );

  const handleChainChanged = useCallback((chainId: string | number) => {
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
  }, []);

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
        if (typeof window !== "undefined" && sessionStorage.getItem(LOGOUT_FLAG)) {
          return;
        }

        const lastWalletType =
          typeof window !== "undefined"
            ? (localStorage.getItem("lastWalletType") as WalletType | null) || null
            : null;
        const ethereum = typeof window !== "undefined" ? (window as any).ethereum : undefined;
        const klaytn = typeof window !== "undefined" ? (window as any).klaytn : undefined;

        let targetProvider: any = null;

        if (lastWalletType) {
          const discovered = detectWallets();
          const found = discovered.find((d) => d.type === lastWalletType);
          if (found && found.provider) {
            targetProvider = found.provider;
          } else if (ethereum?.providers) {
            for (const provider of ethereum.providers) {
              const t = identifyWalletType(provider);
              if (lastWalletType === "metamask" && t === "metamask") {
                targetProvider = provider;
                break;
              }
              if (lastWalletType === "coinbase" && t === "coinbase") {
                targetProvider = provider;
                break;
              }
              if (lastWalletType === "okx" && t === "okx") {
                targetProvider = provider;
                break;
              }
              if (lastWalletType === "binance" && (t === "binance" || provider.isBinanceWallet)) {
                targetProvider = provider;
                break;
              }
            }
          } else if (
            lastWalletType === "binance" &&
            typeof window !== "undefined" &&
            (window as any).BinanceChain
          ) {
            targetProvider = (window as any).BinanceChain;
          } else if (
            lastWalletType === "coinbase" &&
            typeof window !== "undefined" &&
            (window as any).coinbaseWalletExtension
          ) {
            targetProvider = (window as any).coinbaseWalletExtension;
          } else if (
            lastWalletType === "okx" &&
            typeof window !== "undefined" &&
            ((window as any).okxwallet || (window as any).okex || (window as any).OKXWallet)
          ) {
            targetProvider =
              (window as any).okxwallet || (window as any).okex || (window as any).OKXWallet;
          } else if (
            lastWalletType === "kaia" &&
            typeof window !== "undefined" &&
            (window as any).klaytn
          ) {
            targetProvider = (window as any).klaytn;
          } else if (
            lastWalletType === "trust" &&
            typeof window !== "undefined" &&
            ((window as any).trustwallet || (window as any).ethereum?.isTrust)
          ) {
            targetProvider = (window as any).trustwallet || (window as any).ethereum;
          } else if (ethereum && identifyWalletType(ethereum) === lastWalletType) {
            targetProvider = ethereum;
          }
        }

        const providerToUse = targetProvider;

        if (providerToUse) {
          let accounts: string[] = [];
          try {
            accounts = await providerToUse.request({ method: "eth_accounts" });
          } catch {}

          if (accounts && accounts.length > 0) {
            const currentWalletType = identifyWalletType(providerToUse);
            setWalletState((prev) => ({
              ...prev,
              account: accounts[0],
              currentWalletType: currentWalletType || lastWalletType,
            }));
            currentProviderRef.current = providerToUse;
            setupEventListeners(providerToUse, handleAccountsChanged, handleChainChanged);
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
  }, [handleAccountsChanged, handleChainChanged, onAccountsChanged]);

  const connectWallet = async (walletType?: WalletType) => {
    setWalletState((prev) => ({
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

      const allDetected = detectWallets();

      if (walletType) {
        const discovered = allDetected.find((d) => d.type === walletType && d.provider);
        if (discovered && discovered.provider) {
          targetProvider = discovered.provider;
        } else if (ethereum?.providers) {
          for (const provider of ethereum.providers) {
            const t = identifyWalletType(provider);
            if (walletType === "metamask" && t === "metamask") {
              targetProvider = provider;
              break;
            }
            if (walletType === "coinbase" && t === "coinbase") {
              targetProvider = provider;
              break;
            }
            if (walletType === "okx" && t === "okx") {
              targetProvider = provider;
              break;
            }
            if (walletType === "binance" && (t === "binance" || provider.isBinanceWallet)) {
              targetProvider = provider;
              break;
            }
          }
        } else if (walletType === "binance" && (window as any).BinanceChain) {
          targetProvider = (window as any).BinanceChain;
        } else if (walletType === "coinbase" && (window as any).coinbaseWalletExtension) {
          targetProvider = (window as any).coinbaseWalletExtension;
        } else if (walletType === "okx") {
          if ((window as any).okxwallet) {
            targetProvider = (window as any).okxwallet;
          } else if ((window as any).okex) {
            targetProvider = (window as any).okex;
          } else if ((window as any).OKXWallet) {
            targetProvider = (window as any).OKXWallet;
          } else if ((window as any).okxWallet) {
            targetProvider = (window as any).okxWallet;
          }
        } else if (walletType === "kaia" && (window as any).klaytn) {
          targetProvider = (window as any).klaytn;
          if (
            typeof targetProvider.request !== "function" &&
            typeof targetProvider.enable === "function"
          ) {
            const original = targetProvider;
            targetProvider = {
              ...original,
              request: async (args: { method: string; params?: any[] }) => {
                if (
                  args.method === "eth_requestAccounts" ||
                  args.method === "klay_requestAccounts"
                ) {
                  const accounts = await original.enable();
                  return accounts;
                }
                if (typeof original.request === "function") {
                  return original.request(args);
                }
                return new Promise((resolve, reject) => {
                  if (typeof original.sendAsync !== "function") {
                    reject(new Error("Provider does not support request"));
                    return;
                  }
                  original.sendAsync(
                    {
                      method: args.method,
                      params: args.params || [],
                    },
                    (err: any, result: any) => {
                      if (err) reject(err);
                      else resolve(result?.result);
                    }
                  );
                });
              },
            };
          }
        } else if (walletType === "trust") {
          if ((window as any).trustwallet) {
            targetProvider = (window as any).trustwallet;
          } else if (ethereum && (ethereum as any).isTrust) {
            targetProvider = ethereum;
          }
        }
      }

      if (!targetProvider) {
        if (walletType === "okx") {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if ((window as any).okxwallet) {
            targetProvider = (window as any).okxwallet;
          } else if ((window as any).okex) {
            targetProvider = (window as any).okex;
          } else if ((window as any).OKXWallet) {
            targetProvider = (window as any).OKXWallet;
          } else if ((window as any).okxWallet) {
            targetProvider = (window as any).okxWallet;
          } else {
            throw new Error(t("errors.wallet.okxNotInstalled"));
          }
        } else if (!walletType) {
          targetProvider =
            ethereum ||
            (window as any).BinanceChain ||
            (window as any).klaytn ||
            (window as any).trustwallet;
        } else {
          throw new Error(t("errors.wallet.walletNotInitialized"));
        }
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

        setWalletState((prev) => ({
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
      }
    } catch (error: any) {
      setWalletState((prev) => ({
        ...prev,
        isConnecting: false,
        connectError: error?.message || t("errors.wallet.connectFailed"),
      }));
    }
  };

  const disconnectWallet = async () => {
    try {
      const currentProvider = currentProviderRef.current;

      if (currentProvider) {
        try {
          if (typeof currentProvider.disconnect === "function") {
            await currentProvider.disconnect();
          } else if (typeof currentProvider.request === "function") {
            try {
              await currentProvider.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }],
              });
            } catch {
              try {
                await currentProvider.request({
                  method: "wallet_requestPermissions",
                  params: [{ eth_accounts: {} }],
                });
              } catch {}
            }
          }
        } catch {}

        try {
          const ethereum: any = typeof window !== "undefined" ? (window as any).ethereum : null;
          if (ethereum?.providers && Array.isArray(ethereum.providers)) {
            for (const pr of ethereum.providers) {
              if (typeof pr?.request === "function") {
                try {
                  await pr.request({
                    method: "wallet_revokePermissions",
                    params: [{ eth_accounts: {} }],
                  });
                } catch {}
              }
              if (typeof pr?.disconnect === "function") {
                try {
                  await pr.disconnect();
                } catch {}
              }
            }
          } else if (ethereum && typeof ethereum.request === "function") {
            try {
              await ethereum.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }],
              });
            } catch {}
          }
        } catch {}

        if (currentProvider.removeListener) {
          currentProvider.removeListener("accountsChanged", handleAccountsChanged);
          currentProvider.removeListener("chainChanged", handleChainChanged);
        } else if (currentProvider.off) {
          currentProvider.off("accountsChanged", handleAccountsChanged);
          currentProvider.off("chainChanged", handleChainChanged);
        }
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("lastWalletType");
          localStorage.removeItem("walletconnect");
          localStorage.removeItem("WALLETCONNECT_DEEPLINK_CHOICE");
          localStorage.removeItem("-walletlink:https://www.walletlink.org:version");
          localStorage.removeItem("-walletlink:https://www.walletlink.org:session:id");
          localStorage.removeItem("-walletlink:https://www.walletlink.org:session:secret");
          localStorage.removeItem("-walletlink:https://www.walletlink.org:session:linked");
          localStorage.removeItem("coinbaseWallet.version");
          sessionStorage.removeItem("metamask.selectedAddress");
          sessionStorage.removeItem("binance.selectedAddress");
          sessionStorage.removeItem("okx.selectedAddress");
        } catch {}
      }

      setWalletState((prev) => ({
        ...prev,
        account: null,
        chainId: null,
        balanceEth: null,
        currentWalletType: null,
      }));

      currentProviderRef.current = null;

      if (typeof window !== "undefined") {
        sessionStorage.setItem(LOGOUT_FLAG, "true");
      }
    } catch {}
  };

  return {
    walletState,
    connectWallet,
    disconnectWallet,
    currentProviderRef,
    handleChainChanged,
  };
}
