"use client";

import React from "react";
import {
  X,
  Sparkles,
  MessageSquare,
  ImageIcon,
  LayoutGrid,
  Heart,
  MousePointer2,
  CheckCircle2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type ChatOnboardingGuideProps = {
  isOpen: boolean;
  onClose: () => void;
  tChat: (key: string) => any;
};

export function ChatOnboardingGuide({
  isOpen,
  onClose,
  tChat,
}: ChatOnboardingGuideProps) {
  const steps = [
    {
      title: tChat("onboarding.step1.title"),
      desc: tChat("onboarding.step1.desc"),
      icon: MousePointer2,
      color: "text-blue-500",
      bg: "bg-blue-50",
      gradient: "from-blue-500 to-cyan-400",
    },
    {
      title: tChat("onboarding.step2.title"),
      desc: tChat("onboarding.step2.desc"),
      icon: ImageIcon,
      color: "text-purple-500",
      bg: "bg-purple-50",
      gradient: "from-purple-500 to-pink-400",
    },
    {
      title: tChat("onboarding.step3.title"),
      desc: tChat("onboarding.step3.desc"),
      icon: LayoutGrid,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      gradient: "from-emerald-500 to-teal-400",
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-white/20 overflow-hidden"
          >
            {/* Mesh Gradient Decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-accent/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            {/* Header Area */}
            <div className="p-8 pb-0 flex justify-between items-start relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-brand" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                    {tChat("onboarding.title")}
                  </h2>
                </div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest pl-10">
                  {tChat("onboarding.subtitle")}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Steps Content */}
            <div className="p-8 space-y-6 relative z-10">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    className="flex gap-4 group"
                  >
                    <div className="flex-shrink-0 pt-1">
                      <div className={`w-10 h-10 rounded-xl ${step.bg} flex items-center justify-center border border-white/50 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`w-5 h-5 ${step.color}`} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                        {step.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer Action */}
            <div className="p-8 pt-0 relative z-10">
              <div className="flex flex-col items-center gap-4">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Heart size={10} className="text-brand fill-current" />
                  {tChat("onboarding.footer")}
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 group relative overflow-hidden"
                >
                  <span className="relative z-10">好的，我知道了</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand to-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CheckCircle2 size={16} className="relative z-10" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

