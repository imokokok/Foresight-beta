import React from "react";
import { motion } from "framer-motion";
import { walletIcons, walletNames } from "./walletMeta";

export type WalletListSectionProps = {
  tLogin: (key: string) => string;
  availableWallets: { type: string; isAvailable: boolean }[];
  selectedWallet: string | null;
  isConnecting: boolean;
  siweLoading: boolean;
  permLoading: boolean;
  multiLoading: boolean;
  handleWalletConnect: (walletType: string, isAvailable?: boolean) => Promise<void>;
};

export function WalletListSection({
  tLogin,
  availableWallets,
  selectedWallet,
  isConnecting,
  siweLoading,
  permLoading,
  multiLoading,
  handleWalletConnect,
}: WalletListSectionProps) {
  return (
    <div className="relative px-6 pb-6">
      <div className="h-56 overflow-y-auto snap-y snap-mandatory pr-2 -mr-2 space-y-3 scrollbar-beauty">
        {availableWallets.map((wallet, index) => (
          <motion.button
            key={wallet.type}
            onClick={() => handleWalletConnect(wallet.type, wallet.isAvailable)}
            disabled={isConnecting}
            className={`
                    snap-center w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 group relative overflow-hidden
                    ${
                      wallet.isAvailable
                        ? "border-purple-200/50 hover:border-purple-300 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 cursor-pointer hover:shadow-lg"
                        : "border-gray-200/50 bg-gray-50/50 opacity-60"
                    }
                    ${
                      selectedWallet === wallet.type
                        ? "border-purple-400 bg-gradient-to-r from-purple-100/50 to-pink-100/50 shadow-lg"
                        : ""
                    }
                  `}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={wallet.isAvailable ? { scale: 1.02 } : {}}
            whileTap={wallet.isAvailable ? { scale: 0.98 } : {}}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>

            <div className="relative flex items-center space-x-4">
              <div className="flex-shrink-0 p-2 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow duration-300">
                {walletIcons[wallet.type as keyof typeof walletIcons]}
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors duration-300">
                  {walletNames[wallet.type as keyof typeof walletNames]}
                </div>
                {!wallet.isAvailable ? (
                  <div className="text-sm text-red-500 font-medium">{tLogin("notInstalled")}</div>
                ) : (
                  <div className="text-sm text-gray-500 group-hover:text-purple-500 transition-colors duration-300">
                    {tLogin("clickToConnect")}
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              {selectedWallet === wallet.type &&
              (isConnecting || siweLoading || permLoading || multiLoading) ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent" />
              ) : wallet.isAvailable ? (
                <div className="w-6 h-6 rounded-full border-2 border-purple-300 group-hover:border-purple-500 transition-colors duration-300 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="text-red-400"
                >
                  <path
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
