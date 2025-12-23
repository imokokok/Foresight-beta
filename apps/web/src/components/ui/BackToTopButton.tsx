"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

type BackToTopButtonProps = {
  show: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
};

export function BackToTopButton({ show, onClick, label }: BackToTopButtonProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={onClick}
          aria-label={label}
          title={label}
          className="fixed bottom-8 right-8 z-50 w-10 h-10 bg-gradient-to-br from-white/90 to-pink-100/90 rounded-full shadow-lg border border-pink-200/50 backdrop-blur-sm overflow-hidden group"
          whileHover={{
            scale: 1.1,
            boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15)",
          }}
          whileTap={{ scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 17,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-pink-100/40 group-hover:from-white/60 group-hover:to-pink-100/60 transition-all duration-300" />
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            <div className="animate-bounce">
              <svg
                className="w-4 h-4 text-gray-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </div>
          </div>
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            {label}
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
