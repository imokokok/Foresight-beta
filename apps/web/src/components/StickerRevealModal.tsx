import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2 } from "lucide-react";
import confetti from "canvas-confetti";
import { useTranslations } from "@/lib/i18n";
import { createPortal } from "react-dom";

export interface StickerItem {
  id: string;
  emoji: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  desc: string;
  color: string;
  image_url?: string;
}

export const isImageUrl = (str: string | undefined | null) => {
  if (!str) return false;
  return str.startsWith("http") || str.startsWith("/");
};

const resolveCdnUrl = (raw: string | undefined | null) => {
  if (!raw) return null;
  if (!raw.startsWith("http")) return raw;
  const base = process.env.NEXT_PUBLIC_EMOJI_CDN_BASE;
  if (!base) return raw;
  try {
    const url = new URL(raw);
    const normalizedBase = base.replace(/\/+$/, "");
    const path = url.pathname.replace(/^\/+/, "");
    return `${normalizedBase}/${path}`;
  } catch {
    return raw;
  }
};

export const resolveStickerImage = (sticker: StickerItem) => {
  const raw = sticker.image_url || (isImageUrl(sticker.emoji) ? sticker.emoji : null);
  const src = resolveCdnUrl(raw);
  if (!src) return null;
  return {
    src,
  };
};

// 模拟官方表情包池 (现在 emoji 字段可以是 URL)
export const OFFICIAL_STICKERS: StickerItem[] = [
  {
    id: "s1",
    emoji: "🐱",
    name: "",
    rarity: "common",
    desc: "",
    color: "bg-orange-100",
  },
  {
    id: "s2",
    emoji: "🌱",
    name: "",
    rarity: "common",
    desc: "",
    color: "bg-green-100",
  },
  {
    id: "s3",
    emoji: "🚀",
    name: "",
    rarity: "rare",
    desc: "",
    color: "bg-blue-100",
  },
  {
    id: "s4",
    emoji: "💪",
    name: "",
    rarity: "rare",
    desc: "",
    color: "bg-amber-100",
  },
  {
    id: "s5",
    emoji: "👑",
    name: "",
    rarity: "epic",
    desc: "",
    color: "bg-purple-100",
  },
  {
    id: "s6",
    emoji: "🌈",
    name: "",
    rarity: "epic",
    desc: "",
    color: "bg-pink-100",
  },
  {
    id: "s7",
    emoji: "💎",
    name: "",
    rarity: "legendary",
    desc: "",
    color: "bg-cyan-100",
  },
  {
    id: "s8",
    emoji: "🦄",
    name: "",
    rarity: "legendary",
    desc: "",
    color: "bg-fuchsia-100",
  },
];

export const OFFICIAL_STICKER_IDS = new Set(OFFICIAL_STICKERS.map((s) => s.id));

const getReducedMotion = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const triggerConfetti = (rarity: string) => {
  const reduced = getReducedMotion();
  if (reduced) return;

  let duration = 1500;
  let baseParticles = 6;
  switch (rarity) {
    case "legendary":
      duration = 2600;
      baseParticles = 18;
      break;
    case "epic":
      duration = 2200;
      baseParticles = 14;
      break;
    case "rare":
      duration = 1800;
      baseParticles = 10;
      break;
    default:
      duration = 1400;
      baseParticles = 6;
      break;
  }

  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: Math.round(baseParticles / 2),
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"],
    });
    confetti({
      particleCount: Math.round(baseParticles / 2),
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();
};

interface StickerRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  sticker?: StickerItem;
  mode?: "auto" | "interactive";
}

export default function StickerRevealModal({
  isOpen,
  onClose,
  sticker,
  mode = "interactive",
}: StickerRevealModalProps) {
  const tStickerGallery = useTranslations("stickerGallery");
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"box" | "open" | "revealed">("box");
  const [currentSticker, setCurrentSticker] = useState<StickerItem | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const isAuto = mode === "auto";
      const nextStep: "box" | "revealed" = isAuto ? "revealed" : "box";
      let nextSticker: StickerItem;
      if (sticker) {
        nextSticker = sticker;
      } else {
        nextSticker = OFFICIAL_STICKERS[Math.floor(Math.random() * OFFICIAL_STICKERS.length)];
      }
      setCurrentSticker(nextSticker);
      setStep(nextStep);
      if (isAuto) {
        triggerConfetti(nextSticker.rarity);
      }
    }
  }, [isOpen, sticker, mode]);

  const handleBoxClick = () => {
    if (step === "box") {
      setStep("open");
      setTimeout(() => {
        setStep("revealed");
        if (currentSticker) {
          triggerConfetti(currentSticker.rarity);
        }
      }, 800);
    }
  };

  const getRarityColor = (r: string) => {
    switch (r) {
      case "legendary":
        return "text-fuchsia-500 border-fuchsia-200 bg-fuchsia-50";
      case "epic":
        return "text-purple-500 border-purple-200 bg-purple-50";
      case "rare":
        return "text-blue-500 border-blue-200 bg-blue-50";
      default:
        return "text-gray-500 border-gray-200 bg-gray-50";
    }
  };

  const getRarityLabel = (r: string) => {
    switch (r) {
      case "legendary":
        return tStickerGallery("rarity.legendary");
      case "epic":
        return tStickerGallery("rarity.epic");
      case "rare":
        return tStickerGallery("rarity.rare");
      default:
        return tStickerGallery("rarity.common");
    }
  };

  const getStickerName = (sticker: StickerItem) => {
    if (OFFICIAL_STICKER_IDS.has(sticker.id)) {
      return tStickerGallery(`stickers.${sticker.id}.name`);
    }
    return sticker.name;
  };

  const getStickerDesc = (sticker: StickerItem) => {
    if (OFFICIAL_STICKER_IDS.has(sticker.id)) {
      return tStickerGallery(`stickers.${sticker.id}.desc`);
    }
    return sticker.desc;
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9998]"
            onClick={step === "revealed" ? onClose : undefined}
          />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative w-full max-w-sm pointer-events-auto p-4"
            >
              {step === "box" && (
                <motion.div
                  className="flex flex-col items-center cursor-pointer"
                  onClick={handleBoxClick}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    animate={{
                      y: [0, -20, 0],
                      rotate: [0, -5, 5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="text-[120px] filter drop-shadow-2xl"
                  >
                    🎁
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 px-6 py-3 bg-white/20 backdrop-blur-md rounded-full text-white font-bold border border-white/40 animate-pulse"
                  >
                    {tStickerGallery("reveal.openRewardCta")}
                  </motion.div>
                </motion.div>
              )}

              {step === "open" && (
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ scale: 1 }}
                  animate={{ scale: [1.2, 0], opacity: [1, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="text-[120px]">🎁</div>
                </motion.div>
              )}

              {step === "revealed" && currentSticker && (
                <motion.div
                  initial={{ scale: 0, rotate: 180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="bg-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-center"
                >
                  <div className="absolute inset-0 z-0 animate-[spin_10s_linear_infinite] opacity-10">
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"
                      style={{ clipPath: "polygon(50% 50%, 0 0, 100% 0)" }}
                    />
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-transparent via-purple-500 to-transparent rotate-90"
                      style={{ clipPath: "polygon(50% 50%, 0 0, 100% 0)" }}
                    />
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-transparent via-purple-500 to-transparent rotate-180"
                      style={{ clipPath: "polygon(50% 50%, 0 0, 100% 0)" }}
                    />
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-transparent via-purple-500 to-transparent rotate-270"
                      style={{ clipPath: "polygon(50% 50%, 0 0, 100% 0)" }}
                    />
                  </div>

                  <div className="relative z-10">
                    <div
                      className={`inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-6 border ${getRarityColor(
                        currentSticker.rarity
                      )}`}
                    >
                      {getRarityLabel(currentSticker.rarity)}
                    </div>

                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        scale: [1, 1.1, 1],
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className={`w-32 h-32 mx-auto rounded-3xl ${currentSticker.color} flex items-center justify-center shadow-inner mb-6 overflow-hidden`}
                    >
                      {resolveStickerImage(currentSticker) ? (
                        <img
                          src={resolveStickerImage(currentSticker)!.src}
                          alt={getStickerName(currentSticker)}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="text-6xl">{currentSticker.emoji}</span>
                      )}
                    </motion.div>

                    <h3 className="text-2xl font-black text-gray-900 mb-2">
                      {getStickerName(currentSticker)}
                    </h3>
                    <p className="text-gray-500 font-medium mb-8">
                      {getStickerDesc(currentSticker)}
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                      >
                        {tStickerGallery("reveal.collectButton")}
                      </button>
                      <button className="p-3 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
