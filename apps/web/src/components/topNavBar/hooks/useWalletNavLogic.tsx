"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";

export function useWalletNavLogic(
  mounted: boolean,
  setMenuOpen: (open: boolean) => void,
  setWalletSelectorOpen: (open: boolean) => void
) {
  const {
    account,
    isConnecting,
    connectError,
    hasProvider,
    chainId,
    balanceEth,
    balanceLoading,
    refreshBalance,
    connectWallet,
    disconnectWallet,
    formatAddress,
    availableWallets,
    currentWalletType,
    switchNetwork,
  } = useWallet();
  const { user, loading: authLoading, signOut } = useAuth();
  const userProfile = useUserProfileOptional();
  const tWallet = useTranslations("wallet");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [copied, setCopied] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [walletModalOpen, setWalletModalOpenState] = useState(false);
  const prevUserIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    if (!mounted) return;

    const openWalletModal = () => {
      setWalletModalOpenState(true);
      setMenuOpen(false);
      setWalletSelectorOpen(false);
    };

    const switchToChain = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as any;
      const chainIdNum = Number(detail?.chainId);
      if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) return;
      void switchNetwork(chainIdNum);
    };

    window.addEventListener("fs:open-wallet-modal", openWalletModal);
    window.addEventListener("fs:switch-network", switchToChain as EventListener);
    return () => {
      window.removeEventListener("fs:open-wallet-modal", openWalletModal);
      window.removeEventListener("fs:switch-network", switchToChain as EventListener);
    };
  }, [mounted, switchNetwork, setMenuOpen, setWalletSelectorOpen]);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    const curr = user?.id ?? null;
    if (walletModalOpen && !prev && curr) {
      setWalletModalOpenState(false);
    }
    prevUserIdRef.current = curr;
  }, [user?.id, walletModalOpen]);

  useEffect(() => {
    if (!mounted) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    if (connectError) body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [connectError, mounted]);

  const handleConnectWallet = useCallback(
    async (walletType?: "metamask" | "coinbase" | "binance") => {
      await connectWallet(walletType);
      setWalletSelectorOpen(false);
    },
    [connectWallet, setWalletSelectorOpen]
  );

  const handleDisconnectWallet = useCallback(async () => {
    await disconnectWallet();
    setMenuOpen(false);
  }, [disconnectWallet, setMenuOpen]);

  const copyAddress = useCallback(async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [account]);

  const networkName = (id: string | null) => {
    if (!id) return tWallet("unknownNetwork");
    switch (id.toLowerCase()) {
      case "0x1":
        return "Ethereum";
      case "0xaa36a7":
        return "Sepolia";
      case "0x5":
        return "Goerli";
      case "0x89":
        return "Polygon";
      case "0x38":
        return "BSC";
      default:
        return id;
    }
  };

  const walletTypeLabel = useMemo(() => {
    if (currentWalletType === "metamask") return "MetaMask";
    if (currentWalletType === "coinbase") return "Coinbase";
    if (currentWalletType === "okx") return "OKX";
    if (currentWalletType === "binance") return "Binance";
    if (currentWalletType === "kaia") return "Kaia";
    if (currentWalletType === "trust") return "Trust";
    return "";
  }, [currentWalletType]);

  const isSepolia = useMemo(() => {
    if (!chainId) return false;
    return chainId.toLowerCase() === "0xaa36a7";
  }, [chainId]);

  const explorerBase = (id: string | null) => {
    const low = id?.toLowerCase();
    switch (low) {
      case "0x1":
        return "https://etherscan.io";
      case "0xaa36a7":
        return "https://sepolia.etherscan.io";
      case "0x5":
        return "https://goerli.etherscan.io";
      case "0x89":
        return "https://polygonscan.com";
      case "0x38":
        return "https://bscscan.com";
      default:
        return "https://etherscan.io";
    }
  };

  const updateNetworkInfo = useCallback(async () => {
    await refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    updateNetworkInfo();
  }, [account, updateNetworkInfo]);

  const openOnExplorer = () => {
    if (!account) return;
    const url = `${explorerBase(chainId)}/address/${account}`;
    window.open(url, "_blank");
    setMenuOpen(false);
  };

  const switchToSepolia = async () => {
    try {
      await switchNetwork(11155111);
      updateNetworkInfo();
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        try {
          console.error("Switch chain failed:", e);
        } catch {}
      }
    } finally {
      setMenuOpen(false);
    }
  };

  const modal = connectError ? (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-[90%]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-black mb-2">{tWallet("connectFailedTitle")}</h3>
        <p className="text-sm text-black mb-4">{connectError}</p>
        {!hasProvider && (
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-black underline"
          >
            {tWallet("installMetaMaskExtension")}
          </a>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-2 rounded-md border border-gray-300 text-black"
            onClick={() => {
              location.reload();
            }}
          >
            {tCommon("close")}
          </button>
          <button className="px-3 py-2 rounded-md bg-blue-500 text-black" onClick={() => connectWallet()}>
            {tCommon("retry")}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return {
    account,
    isConnecting,
    connectError,
    hasProvider,
    chainId,
    balanceEth,
    balanceLoading,
    refreshBalance,
    connectWallet,
    disconnectWallet,
    formatAddress,
    availableWallets,
    currentWalletType,
    switchNetwork,
    user,
    authLoading,
    signOut,
    userProfile,
    tWallet,
    tAuth,
    tCommon,
    copied,
    showBalance,
    setShowBalance,
    walletModalOpen,
    setWalletModalOpen: setWalletModalOpenState,
    handleConnectWallet,
    handleDisconnectWallet,
    copyAddress,
    networkName,
    walletTypeLabel,
    isSepolia,
    explorerBase,
    updateNetworkInfo,
    openOnExplorer,
    switchToSepolia,
    modal,
  };
}

