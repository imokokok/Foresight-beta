"use client";
import React from "react";
import {
  Camera,
  X,
  Loader2,
  Heart,
  Sparkles,
  Star,
  Zap,
  Droplet,
  Clock,
  BookOpen,
  Brain,
  Moon,
  Sun,
  Home,
  Ban,
  Flag,
  MessageCircleHeart,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { FlagItem } from "@/components/FlagCard";

export type CheckinModalProps = {
  isOpen: boolean;
  flag: FlagItem | null;
  tFlags: (key: string) => string;
  note: string;
  image: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onNoteChange: (value: string) => void;
  onImageChange: (value: string) => void;
};

// Map IDs to Icons/Colors/Gradients (Sync with CreateFlagModal)
const THEME_MAP: Record<
  string,
  { icon: any; color: string; bg: string; gradient: string; emoji: string }
> = {
  early_morning: {
    icon: Clock,
    color: "text-orange-500",
    bg: "bg-orange-50",
    gradient: "from-[#FF8C42] via-[#FFAA5A] to-[#FFD56B]",
    emoji: "🌅",
  },
  drink_water_8: {
    icon: Droplet,
    color: "text-blue-500",
    bg: "bg-blue-50",
    gradient: "from-[#4FACFE] via-[#00F2FE] to-[#70E1F5]",
    emoji: "💧",
  },
  steps_10k: {
    icon: Zap,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    gradient: "from-[#43E97B] via-[#38F9D7] to-[#5EEAD4]",
    emoji: "🏃",
  },
  read_20_pages: {
    icon: BookOpen,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    gradient: "from-[#667EEA] via-[#764BA2] to-[#6B8DFF]",
    emoji: "📖",
  },
  meditate_10m: {
    icon: Brain,
    color: "text-purple-500",
    bg: "bg-purple-50",
    gradient: "from-[#A18CD1] via-[#FBC2EB] to-[#E2D1F9]",
    emoji: "🧘",
  },
  sleep_before_11: {
    icon: Moon,
    color: "text-slate-500",
    bg: "bg-slate-50",
    gradient: "from-[#2C3E50] via-[#4CA1AF] to-[#2C3E50]",
    emoji: "🌙",
  },
  no_sugar_day: {
    icon: Ban,
    color: "text-rose-500",
    bg: "bg-rose-50",
    gradient: "from-[#F093FB] via-[#F5576C] to-[#FF8ED0]",
    emoji: "🍎",
  },
  breakfast_photo: {
    icon: Camera,
    color: "text-amber-500",
    bg: "bg-amber-50",
    gradient: "from-[#F6D365] via-[#FDA085] to-[#F6D365]",
    emoji: "🍳",
  },
  sunlight_20m: {
    icon: Sun,
    color: "text-yellow-500",
    bg: "bg-yellow-50",
    gradient: "from-[#FCEEB5] via-[#FAD0C4] to-[#FFD1FF]",
    emoji: "☀️",
  },
  tidy_room_10m: {
    icon: Home,
    color: "text-teal-500",
    bg: "bg-teal-50",
    gradient: "from-[#13547A] via-[#80D0C7] to-[#13547A]",
    emoji: "🏠",
  },
  default: {
    icon: Flag,
    color: "text-violet-600",
    bg: "bg-violet-50",
    gradient: "from-[#7F56D9] via-[#9E77ED] to-[#6941C6]",
    emoji: "✨",
  },
};

export function CheckinModal({
  isOpen,
  flag,
  tFlags,
  note,
  image,
  submitting,
  onClose,
  onSubmit,
  onNoteChange,
  onImageChange,
}: CheckinModalProps) {
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
                  打卡时刻
                </h3>
              </motion.div>

              <div className="relative z-10 hidden md:block">
                <p className="text-[10px] text-white/80 font-black uppercase tracking-[0.2em] leading-relaxed">
                  你已经在
                  <br />
                  <span className="text-white text-xs">“{flag.title}”</span>
                  <br />
                  的路上坚持了很久啦！
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
                      {tFlags("checkin.title")}
                    </h2>
                    <p className="text-gray-400 font-bold text-sm">{tFlags("checkin.subtitle")}</p>
                  </div>

                  <div className="space-y-8">
                    {/* Note Field */}
                    <div className="group space-y-3">
                      <label className="text-[10px] font-black text-purple-500/60 uppercase tracking-[0.3em] ml-1 flex items-center gap-2 group-focus-within:text-purple-500 transition-colors">
                        <MessageCircleHeart className="w-3.5 h-3.5 fill-current" />
                        {tFlags("checkin.noteLabel")}
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => onNoteChange(e.target.value)}
                        rows={3}
                        className="w-full px-0 py-2 border-b-2 border-gray-100 bg-transparent outline-none transition-all font-bold text-lg text-gray-900 placeholder:text-gray-200 focus:border-purple-500 resize-none"
                        placeholder={tFlags("checkin.notePlaceholder")}
                      />
                    </div>

                    {/* Image Field */}
                    <div className="group space-y-3">
                      <label className="text-[10px] font-black text-purple-500/60 uppercase tracking-[0.3em] ml-1 flex items-center gap-2 group-focus-within:text-purple-500 transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        {tFlags("checkin.imageLabel")}
                      </label>
                      <div className="relative">
                        <input
                          value={image}
                          onChange={(e) => onImageChange(e.target.value)}
                          className="w-full px-0 py-2 border-b-2 border-gray-100 bg-transparent outline-none transition-all font-bold text-base text-gray-600 placeholder:text-gray-200 focus:border-purple-500"
                          placeholder={tFlags("checkin.imagePlaceholder")}
                        />
                        {image && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-4 w-full h-32 rounded-2xl overflow-hidden border-2 border-gray-50 bg-gray-50"
                          >
                            <img src={image} alt="Preview" className="w-full h-full object-cover" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-8 md:p-12 pt-0 flex gap-4 mt-auto">
                <button
                  onClick={onClose}
                  className="flex-1 py-4.5 rounded-2xl bg-gray-50 text-gray-400 font-black text-sm hover:bg-gray-100 transition-all active:scale-95"
                >
                  {tFlags("checkin.cancel")}
                </button>
                <button
                  onClick={onSubmit}
                  disabled={submitting}
                  className="flex-[2] py-4.5 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-purple-600 transition-all shadow-xl shadow-purple-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 group relative overflow-hidden"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span className="relative z-10">{tFlags("checkin.submit")}</span>
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
