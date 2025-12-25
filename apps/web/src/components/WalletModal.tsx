"use client";
import React from "react";
import { useWalletModalLogic } from "@/hooks/useWalletModalLogic";
import { WalletModalView, type WalletModalProps } from "./walletModal/WalletModalView";

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { mounted, ...logic } = useWalletModalLogic({ isOpen, onClose });

  if (!mounted) return null;

  return <WalletModalView isOpen={isOpen} onClose={onClose} {...(logic as any)} />;
};

export default WalletModal;
