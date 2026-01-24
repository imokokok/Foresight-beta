"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";

export function useWalletNavLogic(
  mounted: boolean,
  setMenuOpen: (open: boolean) => void,
  setWalletSelectorOpen: (open: boolean) => void
) {
  const { address, connect } = useWallet();
  const { signOut } = useAuth();
  const userProfile = useUserProfileOptional();
  const tWallet = useTranslations("wallet");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");

  const [copied, setCopied] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [walletModalOpen, setWalletModalOpenState] = useState(false);

  const handleConnectWallet = useCallback(async () => {
    await connect();
    setWalletSelectorOpen(false);
  }, [connect, setWalletSelectorOpen]);

  const handleDisconnectWallet = useCallback(async () => {
    setMenuOpen(false);
  }, [setMenuOpen]);

  const copyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [address]);

  const openOnExplorer = () => {
    if (!address) return;
    window.open(`https://etherscan.io/address/${address}`, "_blank");
    setMenuOpen(false);
  };

  return {
    address,
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
    openOnExplorer,
  };
}
