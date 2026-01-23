"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuthOptional } from "@/contexts/AuthContext";
import { logClientErrorToApi } from "@/lib/errorReporting";
import { useTranslations } from "@/lib/i18n";
import { fetcher, type UserProfileInfoResponse } from "@/hooks/useQueries";

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
  account,
  normalizedAccount,
  onClose,
  onShowProfileForm,
}: {
  account: string | null | undefined;
  normalizedAccount: string | null | undefined;
  onClose: () => void;
  onShowProfileForm: (email: string, verified: boolean) => void;
}) {
  const {
    connectWalletWithResult,
    availableWallets,
    isConnecting,
    siweLogin,
    requestWalletPermissions,
  } = useWallet();
  const auth = useAuthOptional();
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
        // 步骤 1: 连接钱包
        setWalletStep("connecting");
        const connectRes = await connectWalletWithResult(walletType as any);
        if (!connectRes.success) {
          logClientErrorToApi(
            new Error(`wallet_connect_failed:${String(connectRes.error || "unknown")}`),
            { silent: true }
          );
          setWalletError(connectRes.error);
          setWalletStep("select");
          return;
        }

        // 步骤 2: 请求权限（可选，快速跳过）
        setPermLoading(true);
        setWalletStep("permissions");
        try {
          await requestWalletPermissions();
        } catch {
          // 权限请求失败不阻塞流程
        }
        setPermLoading(false);

        // 步骤 3: SIWE 签名认证
        setSiweLoading(true);
        setWalletStep("sign");
        const res = await siweLogin();
        setSiweLoading(false);

        if (!res.success) {
          console.error("Sign-in with wallet failed:", res.error);
          logClientErrorToApi(new Error(`wallet_signin_failed:${String(res.error || "unknown")}`), {
            silent: true,
          });
          setWalletError(res.error || tGlobal("errors.wallet.loginError"));
          setWalletStep("select");
          setSelectedWallet(null);
          return;
        }

        if (auth?.refreshSession) {
          await auth.refreshSession();
        }

        const addrCheck = String(res.address || connectRes.account || account || "").toLowerCase();
        if (addrCheck) {
          try {
            const r = await fetch(`/api/user-profiles?address=${encodeURIComponent(addrCheck)}`);
            const d = await r.json();
            const p = d?.data?.profile;
            if (!p?.username || !p?.email) {
              const nextEmail = String(p?.email || "");
              const verified = Boolean(nextEmail && /.+@.+\..+/.test(nextEmail));
              onShowProfileForm(nextEmail, verified);
              setWalletStep("profile");
              setSelectedWallet(null);
              return;
            }
          } catch {}
        }

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
        // 出错时重置状态
        setWalletStep("select");
        setSiweLoading(false);
        setPermLoading(false);
        setMultiLoading(false);
      } finally {
        setSelectedWallet(null);
      }
    },
    [
      account,
      connectWalletWithResult,
      siweLogin,
      requestWalletPermissions,
      auth,
      onClose,
      onShowProfileForm,
      tGlobal,
    ]
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
    availableWallets,
    isConnecting,
  };
}
