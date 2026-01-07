"use client";
import React from "react";
import { X, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { FlagItem } from "@/components/FlagCard";
import { THEME_MAP } from "@/lib/flagThemes";
import { FlagRulesInfo } from "@/components/FlagRulesInfo";

export type SettleModalProps = {
  isOpen: boolean;
  flag: FlagItem | null;
  tFlags: (key: string) => string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function SettleModal({
  isOpen,
  flag,
  tFlags,
  submitting,
  onClose,
  onConfirm,
}: SettleModalProps) {
  const themeId = flag?.template_id || "default";
  const theme = THEME_MAP[themeId] || THEME_MAP.default;
  const Icon = theme.icon;

  return (
    <AnimatePresence>
      {isOpen && flag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/40 backdrop-blur-3xl"
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] pointer-events-none" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col md:flex-row border border-white h-auto max-h-[90vh]"
          >
            {/* Left Decorative Panel */}
            <div
              className={`w-full md:w-56 bg-gradient-to-br ${theme.gradient} p-8 flex flex-col justify-between relative overflow-hidden shrink-0`}
            >
              {/* Mesh Gradient Effect Overlay */}
              <div className="absolute inset-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-white/30 rounded-full blur-[60px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-black/10 rounded-full blur-[50px]" />
              </div>

              <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />

              <motion.div
                initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                className="relative z-10 flex flex-col items-center md:items-start"
              >
                <div className="w-16 h-16 rounded-[1.5rem] bg-white/95 shadow-2xl flex items-center justify-center mb-6 border border-white/20 transform hover:scale-110 transition-transform">
                  <Icon className={`w-8 h-8 ${theme.color}`} />
                </div>
                <div className="text-4xl mb-4 filter drop-shadow-lg">{theme.emoji}</div>
                <h3 className="text-white font-black text-xl leading-tight tracking-tight drop-shadow-sm hidden md:block">
                  {tFlags("checkin.sideTitle")}
                </h3>
              </motion.div>

              <div className="relative z-10 hidden md:block">
                <p className="text-[10px] text-white/80 font-black uppercase tracking-[0.2em] leading-relaxed">
                  {tFlags("checkin.sidePrefix")}
                  <br />
                  <span className="text-white text-xs">“{flag.title}”</span>
                  <br />
                  {tFlags("checkin.sideSuffix")}
                </p>
              </div>

              {/* Animated Floating Bubbles */}
              <motion.div
                animate={{ y: [0, -30, 0], x: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-10 -left-5 w-32 h-32 rounded-full bg-white/20 blur-2xl"
              />
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col relative h-full">
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2.5 rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all z-20 group"
              >
                <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              </button>

              <div className="p-8 md:p-12 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-10">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">
                      {tFlags("settleModal.title")}
                    </h2>
                    <p className="text-gray-400 font-bold text-sm">
                      {tFlags("settleModal.subtitle")}
                    </p>
                  </div>

                  <div className="p-5 bg-amber-50 rounded-[2rem] border border-amber-100">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-amber-900">
                          {tFlags("settleModal.confirm")}?
                        </h4>
                        <p className="text-xs font-bold text-amber-700/80 leading-relaxed">
                          {tFlags("settleModal.warning")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <FlagRulesInfo tFlags={tFlags} />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-8 md:p-12 pt-0 flex gap-4 mt-auto">
                <button
                  onClick={onClose}
                  className="flex-1 py-4.5 rounded-2xl bg-gray-50 text-gray-400 font-black text-sm hover:bg-gray-100 transition-all active:scale-95"
                >
                  {tFlags("settleModal.cancel")}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={submitting}
                  className="flex-[2] py-4.5 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-purple-600 transition-all shadow-xl shadow-purple-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group relative overflow-hidden"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span className="relative z-10">{tFlags("settleModal.confirm")}</span>
                    </>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-fuchsia-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
