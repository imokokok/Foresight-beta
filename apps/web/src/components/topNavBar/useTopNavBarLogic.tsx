"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";

export function useTopNavBarLogic() {
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

  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const walletSelectorRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<HTMLImageElement | null>(null);
  const menuContentRef = useRef<HTMLDivElement | null>(null);
  const walletButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [walletSelectorPos, setWalletSelectorPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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
    [connectWallet]
  );

  const handleWalletSelectorToggle = useCallback(() => {
    setWalletSelectorOpen(!walletSelectorOpen);
  }, [walletSelectorOpen]);

  const handleDisconnectWallet = useCallback(async () => {
    await disconnectWallet();
    try {
      await fetch("/api/siwe/logout", { method: "GET" });
    } catch {}
    setMenuOpen(false);
  }, [disconnectWallet]);

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

  const updateNetworkInfo = async () => {
    await refreshBalance();
  };

  useEffect(() => {
    updateNetworkInfo();
  }, [account]);

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
      console.error("Switch chain failed:", e);
    } finally {
      setMenuOpen(false);
    }
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (avatarRef.current && avatarRef.current.contains(target)) return;
      if (menuContentRef.current && menuContentRef.current.contains(target)) return;
      if (walletButtonRef.current && walletButtonRef.current.contains(target)) return;
      if (walletSelectorRef.current && walletSelectorRef.current.contains(target)) return;
      setMenuOpen(false);
      setWalletSelectorOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setWalletSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const updateMenuPosition = () => {
      if (!avatarRef.current) return;
      const rect = avatarRef.current.getBoundingClientRect();
      const menuWidth = 256;
      const gap = 8;
      let left = rect.right - menuWidth;
      let top = rect.bottom + gap;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      left = Math.max(8, Math.min(left, vw - menuWidth - 8));
      top = Math.max(8, Math.min(top, vh - 8));
      setMenuPos({ top, left });
    };

    if (menuOpen) {
      updateMenuPosition();
      const handler = () => updateMenuPosition();
      window.addEventListener("resize", handler);
      window.addEventListener("scroll", handler, true);
      return () => {
        window.removeEventListener("resize", handler);
        window.removeEventListener("scroll", handler, true);
      };
    }
  }, [menuOpen]);

  useEffect(() => {
    const updateWalletSelectorPosition = () => {
      if (!walletButtonRef.current) return;
      const rect = walletButtonRef.current.getBoundingClientRect();
      const selectorWidth = 200;
      const gap = 8;
      let left = rect.left;
      let top = rect.bottom + gap;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      left = Math.max(8, Math.min(left, vw - selectorWidth - 8));
      top = Math.max(8, Math.min(top, vh - 8));
      setWalletSelectorPos({ top, left });
    };

    if (walletSelectorOpen) {
      updateWalletSelectorPosition();
      const handler = () => updateWalletSelectorPosition();
      window.addEventListener("resize", handler);
      window.addEventListener("scroll", handler, true);
      return () => {
        window.removeEventListener("resize", handler);
        window.removeEventListener("scroll", handler, true);
      };
    }
  }, [walletSelectorOpen]);

  const modal = connectError ? (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={() => {}}
    >
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
          <button
            className="px-3 py-2 rounded-md bg-blue-500 text-black"
            onClick={() => connectWallet()}
          >
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
    mounted,
    menuOpen,
    setMenuOpen,
    copied,
    showBalance,
    setShowBalance,
    walletSelectorOpen,
    setWalletSelectorOpen,
    walletModalOpen,
    setWalletModalOpen,
    menuRef,
    walletSelectorRef,
    avatarRef,
    menuContentRef,
    walletButtonRef,
    menuPos,
    walletSelectorPos,
    handleConnectWallet,
    handleWalletSelectorToggle,
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

export type TopNavBarState = ReturnType<typeof useTopNavBarLogic>;
