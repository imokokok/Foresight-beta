"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Copy, ExternalLink, Eye, EyeOff, LogOut, Wallet } from "lucide-react";
import WalletModal from "../WalletModal";
import LazyImage from "@/components/ui/LazyImage";
import type { TopNavBarState } from "./useTopNavBarLogic";

export function WalletSection({ nav }: { nav: TopNavBarState }) {
  const {
    account,
    user,
    userProfile,
    tAuth,
    tWallet,
    tCommon,
    formatAddress,
    currentWalletType,
    chainId,
    balanceEth,
    balanceLoading,
    menuRef,
    avatarRef,
    menuContentRef,
    menuOpen,
    setMenuOpen,
    mounted,
    menuPos,
    showBalance,
    setShowBalance,
    updateNetworkInfo,
    copyAddress,
    copied,
    openOnExplorer,
    isSepolia,
    switchToSepolia,
    handleDisconnectWallet,
    signOut,
    disconnectWallet,
    walletModalOpen,
    setWalletModalOpen,
    modal,
    networkName,
    walletTypeLabel,
  } = nav;

  if (account) {
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
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${account}`}
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
                        {userProfile?.profile?.username || formatAddress(account)}
                      </div>
                      {userProfile?.profile?.username && (
                        <div className="mt-1 text-[11px] text-gray-600 truncate">
                          {formatAddress(account)}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-gray-600 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-gray-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          {networkName(chainId)}
                        </span>
                        {currentWalletType && walletTypeLabel && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-gray-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {walletTypeLabel}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500">
                        <span>ETH</span>
                        <button
                          type="button"
                          aria-label={showBalance ? tCommon("hideBalance") : tCommon("showBalance")}
                          className="p-0.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                          onClick={() => setShowBalance((v) => !v)}
                        >
                          {showBalance ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-sm font-semibold text-black">
                        {showBalance
                          ? balanceLoading
                            ? "..."
                            : balanceEth
                              ? balanceEth
                              : "--"
                          : "••••"}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={updateNetworkInfo}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md hover:bg-purple-50 text-black"
                >
                  <Wallet className="w-4 h-4 text-purple-600" />
                  <span>{tWallet("refreshBalance")}</span>
                </button>
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
                <div className="my-1 border-t border-purple-100/60" />
                {!isSepolia && (
                  <button
                    onClick={switchToSepolia}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md hover:bg-purple-50 text-black"
                  >
                    <Wallet className="w-4 h-4 text-purple-600" />
                    <span>{tWallet("switchNetwork")} - Sepolia</span>
                  </button>
                )}
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
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">
          {tAuth("loggedIn")}：{user.email || tAuth("noEmail")}
        </span>
        <button
          onClick={async () => {
            await signOut();
            await disconnectWallet();
            try {
              await fetch("/api/siwe/logout", { method: "GET" });
            } catch {}
          }}
          className="px-3 py-1.5 bg-gray-100 text-gray-900 rounded-xl hover:bg-gray-200"
        >
          {tAuth("logout")}
        </button>
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
      {mounted && modal && createPortal(modal, document.body)}
      {mounted && (
        <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      )}
    </div>
  );
}
