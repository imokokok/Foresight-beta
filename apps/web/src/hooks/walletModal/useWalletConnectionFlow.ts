"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { logClientErrorToApi } from "@/lib/errorReporting";
import { useTranslations } from "@/lib/i18n";

export type WalletStep =
  | "select"
  | "connecting"
  | "permissions"
  | "sign"
  | "multisig"
  | "profile"
  | "completed";

const installMap: Record<string, { name: string; url: string }> = {
  metamask: { name: "MetaMask", url: "https://metamask.io/download/" },
  coinbase: {
    name: "Coinbase Wallet",
    url: "https://chrome.google.com/webstore/detail/coinbase-wallet-extension/hnfanknocfeofbddgcijnmhnfnkdnaad",
  },
  binance: {
    name: "Binance Wallet",
    url: "https://chrome.google.com/webstore/detail/binance-wallet/fhbohimaelbohpjbbldcngcnapndodjp",
  },
  okx: {
    name: "OKX Wallet",
    url: "https://chrome.google.com/webstore/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge",
  },
  kaia: {
    name: "Kaia Wallet",
    url: "https://chromewebstore.google.com/detail/kaia-wallet/jblndlipeogpafnldhgmapagcccfchpi",
  },
  trust: {
    name: "Trust Wallet",
    url: "https://trustwallet.com/browser-extension",
  },
};

export function useWalletConnectionFlow({
  address,
  onClose,
  onShowProfileForm,
}: {
  address: string | null | undefined;
  onClose: () => void;
  onShowProfileForm: (email: string, verified: boolean) => void;
}) {
  const { connect } = useWallet();
  const tGlobal = useTranslations();

  const [walletStep, setWalletStep] = useState<WalletStep>("select");
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [siweLoading, setSiweLoading] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const [installWalletName, setInstallWalletName] = useState<string>("");
  const [installUrl, setInstallUrl] = useState<string>("");

  const handleWalletConnect = useCallback(
    async (walletType: string, isAvailable?: boolean) => {
      if (!isAvailable) {
        setWalletError(null);
        const cfg = installMap[walletType] || {
          name: walletType,
          url: "https://metamask.io/download/",
        };
        setInstallWalletName(cfg.name);
        setInstallUrl(cfg.url);
        setInstallPromptOpen(true);
        return;
      }
      setSelectedWallet(walletType);
      setWalletError(null);
      try {
        setWalletStep("connecting");
        await connect();
        setWalletStep("completed");
        setSelectedWallet(null);
        onClose();
      } catch (error) {
        console.error("Wallet connection failed:", error);
        logClientErrorToApi(
          error instanceof Error ? error : new Error(String(error || "wallet_connect_failed")),
          { silent: true }
        );
        setWalletError(
          String((error as any)?.message || error || tGlobal("errors.wallet.loginError"))
        );
        setWalletStep("select");
      } finally {
        setSelectedWallet(null);
      }
    },
    [connect, onClose, tGlobal]
  );

  return {
    walletStep,
    setWalletStep,
    selectedWallet,
    walletError,
    setWalletError,
    siweLoading,
    permLoading,
    multiLoading,
    installPromptOpen,
    setInstallPromptOpen,
    installWalletName,
    installUrl,
    handleWalletConnect,
    availableWallets: [],
    isConnecting: false,
  };
}
