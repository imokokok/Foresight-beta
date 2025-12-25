"use client";

import React from "react";
import { createPortal } from "react-dom";
import WalletModal from "./WalletModal";
import LanguageSwitcher from "./LanguageSwitcher";
import MobileMenu from "./MobileMenu";
import { useTopNavBarLogic } from "./topNavBar/useTopNavBarLogic";
import { WalletSection } from "./topNavBar/WalletSection";

export default function TopNavBar() {
  const nav = useTopNavBarLogic();
  const { mounted, modal, walletModalOpen, setWalletModalOpen } = nav;

  return (
    <>
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <MobileMenu />
      </div>

      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center space-x-3">
          <LanguageSwitcher />
          <WalletSection nav={nav} />
        </div>

        {mounted && modal && createPortal(modal, document.body)}

        {mounted && (
          <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
        )}
      </div>
    </>
  );
}
