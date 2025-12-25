import React from "react";
import { motion } from "framer-motion";

export type WalletModalHeaderProps = {
  tWalletModal: (key: string) => string;
  onClose: () => void;
};

export function WalletModalHeader({ tWalletModal, onClose }: WalletModalHeaderProps) {
  return (
    <div className="relative flex items-center justify-between p-6 border-b border-gradient-to-r from-purple-100/50 to-pink-100/50">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
            <path
              d="M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="15,10 21,4 15,4 21,4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h2
            id="wallet-modal-title"
            className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
          >
            {tWalletModal("title")}
          </h2>
          <p id="wallet-modal-description" className="text-sm text-gray-500">
            {tWalletModal("subtitle")}
          </p>
        </div>
      </div>
      <motion.button
        onClick={onClose}
        className="p-2 hover:bg-gradient-to-br hover:from-purple-100 hover:to-pink-100 rounded-xl transition-all duration-200 group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="text-gray-400 group-hover:text-gray-600"
        >
          <path
            d="M15 5L5 15M5 5l10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </motion.button>
    </div>
  );
}
