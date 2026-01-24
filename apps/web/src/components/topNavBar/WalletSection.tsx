"use client";

import { createPortal } from "react-dom";
import { Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import { useState } from "react";
import WalletModal from "../WalletModal";
import LazyImage from "@/components/ui/LazyImage";
import type { TopNavBarState } from "./useTopNavBarLogic";
import DepositModal from "@/components/DepositModal";
import { formatAddress } from "@/lib/address";

export function WalletSection({ nav }: { nav: TopNavBarState }) {
  const [depositOpen, setDepositOpen] = useState(false);
  const {
    address,
    userProfile,
    tAuth,
    tWallet,
    tCommon,
    menuRef,
    avatarRef,
    menuContentRef,
    menuOpen,
    setMenuOpen,
    mounted,
    menuPos,
    showBalance,
    setShowBalance,
    copyAddress,
    copied,
    openOnExplorer,
    handleDisconnectWallet,
    signOut,
    walletModalOpen,
    setWalletModalOpen,
  } = nav;

  if (address) {
    return (
      <div className="relative group" ref={menuRef}>
        <div className="p-[2px] rounded-full bg-gradient-to-r from-[rgba(244,114,182,1)] to-[rgba(168,85,247,1)]">
          <div
            ref={avatarRef}
            role="button"
            aria-label={tCommon("openUserMenu")}
            aria-expanded={menuOpen}
            tabIndex={0}
            className="rounded-full bg-white shadow-sm cursor-pointer transition-all duration-200 focus:outline-none focus-visible:shadow-md overflow-hidden"
            onClick={() => setMenuOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setMenuOpen((v) => !v);
            }}
          >
            <LazyImage
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
              alt={tCommon("userAvatar")}
              className="w-10 h-10 rounded-full object-cover"
              placeholderClassName="rounded-full bg-gradient-to-br from-purple-100 to-pink-100"
              rootMargin={0}
            />
          </div>
        </div>
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-white dark:ring-[#0a0a0a]" />
        {menuOpen &&
          mounted &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setMenuOpen(false)} />
              <div
                ref={menuContentRef}
                className="fixed z-[9999] w-64 glass-card p-2 rounded-2xl"
                role="menu"
                aria-label={tCommon("userMenu")}
                style={{ top: menuPos.top, left: menuPos.left }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-3 mb-2 rounded-xl bg-white/40 border border-white/40">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                        {userProfile?.profile?.username || formatAddress(address)}
                      </div>
                      {userProfile?.profile?.username && (
                        <div className="mt-1 text-[11px] text-gray-600 truncate">
                          {formatAddress(address)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={copyAddress}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md hover:bg-purple-50 text-black"
                >
                  <Copy className="w-4 h-4 text-purple-600" />
                  <span>{copied ? tWallet("addressCopied") : tWallet("copyAddress")}</span>
                </button>
                <button
                  onClick={openOnExplorer}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md hover:bg-purple-50 text-black"
                >
                  <ExternalLink className="w-4 h-4 text-purple-600" />
                  <span>{tWallet("viewOnExplorer")}</span>
                </button>
                <button
                  onClick={() => {
                    setDepositOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md hover:bg-purple-50 text-black"
                >
                  <Wallet className="w-4 h-4 text-purple-600" />
                  <span>{tWallet("deposit")}</span>
                </button>
                <div className="my-1 border-t border-purple-100/60" />
                <button
                  onClick={handleDisconnectWallet}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md hover:bg-purple-50 text-black"
                >
                  <LogOut className="w-4 h-4 text-purple-600" />
                  <span>{tAuth("disconnectWallet")}</span>
                </button>
              </div>
            </>,
            document.body
          )}
        {mounted && (
          <DepositModal
            open={depositOpen}
            onClose={() => setDepositOpen(false)}
            onRequireLogin={() => setWalletModalOpen(true)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setWalletModalOpen(true)}
        className="btn-base btn-md btn-cta"
        title={tAuth("login")}
      >
        {tAuth("login")}
      </button>
      {mounted && (
        <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      )}
    </div>
  );
}
