import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Download, Share2 } from "lucide-react";
import confetti from "canvas-confetti";

export interface StickerItem {
  id: string;
  emoji: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  desc: string;
  color: string;
  image_url?: string;
}

// 模拟官方表情包池
export const OFFICIAL_STICKERS: StickerItem[] = [
  { id: "s1", emoji: "🐱", name: "摸鱼猫猫", rarity: "common", desc: "今天也是努力摸鱼的一天呢", color: "bg-orange-100" },
  { id: "s2", emoji: "🌱", name: "茁壮成长", rarity: "common", desc: "每天进步一点点", color: "bg-green-100" },
  { id: "s3", emoji: "🚀", name: "一飞冲天", rarity: "rare", desc: "芜湖！起飞！", color: "bg-blue-100" },
  { id: "s4", emoji: "💪", name: "肌肉柴犬", rarity: "rare", desc: "坚持就是胜利", color: "bg-amber-100" },
  { id: "s5", emoji: "👑", name: "Flag之王", rarity: "epic", desc: "这就是强者的世界吗", color: "bg-purple-100" },
  { id: "s6", emoji: "🌈", name: "彩虹屁", rarity: "epic", desc: "你就是最棒的！", color: "bg-pink-100" },
  { id: "s7", emoji: "💎", name: "钻石意志", rarity: "legendary", desc: "比钻石还坚硬的决心", color: "bg-cyan-100" },
  { id: "s8", emoji: "🦄", name: "独角兽", rarity: "legendary", desc: "独一无二的你", color: "bg-fuchsia-100" },
];

interface StickerRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  sticker?: StickerItem; // 如果不传，组件内部可以随机或者显示加载状态
}

export default function StickerRevealModal({
  isOpen,
  onClose,
  sticker,
}: StickerRevealModalProps) {
  const [step, setStep] = useState<"box" | "open" | "revealed">("box");
  const [currentSticker, setCurrentSticker] = useState<StickerItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("box");
      // 如果外部传入了sticker就用外部的，否则随机一个
      if (sticker) {
        setCurrentSticker(sticker);
      } else {
        const random = OFFICIAL_STICKERS[Math.floor(Math.random() * OFFICIAL_STICKERS.length)];
        setCurrentSticker(random);
      }
    }
  }, [isOpen, sticker]);

  const handleBoxClick = () => {
    if (step === "box") {
      setStep("open");
      setTimeout(() => {
        setStep("revealed");
        triggerConfetti();
      }, 800);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"],
      });
      confetti({
        particleCount: 5,
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

  const getRarityColor = (r: string) => {
    switch (r) {
      case "legendary": return "text-fuchsia-500 border-fuchsia-200 bg-fuchsia-50";
      case "epic": return "text-purple-500 border-purple-200 bg-purple-50";
      case "rare": return "text-blue-500 border-blue-200 bg-blue-50";
      default: return "text-gray-500 border-gray-200 bg-gray-50";
    }
  };

  const getRarityLabel = (r: string) => {
    switch (r) {
      case "legendary": return "传说 LEGENDARY";
      case "epic": return "史诗 EPIC";
      case "rare": return "稀有 RARE";
      default: return "普通 COMMON";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
            onClick={step === "revealed" ? onClose : undefined}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
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
                      rotate: [0, -5, 5, 0] 
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
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
                    点击开启奖励
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
                  {/* Background Rays */}
                  <div className="absolute inset-0 z-0 animate-[spin_10s_linear_infinite] opacity-10">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" style={{ clipPath: "polygon(50% 50%, 0 0, 100% 0)" }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-transparent via-purple-500 to-transparent rotate-90" style={{ clipPath: "polygon(50% 50%, 0 0, 100% 0)" }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-transparent via-purple-500 to-transparent rotate-180" style={{ clipPath: "polygon(50% 50%, 0 0, 100% 0)" }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-transparent via-purple-500 to-transparent rotate-270" style={{ clipPath: "polygon(50% 50%, 0 0, 100% 0)" }} />
                  </div>

                  <div className="relative z-10">
                    <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-6 border ${getRarityColor(currentSticker.rarity)}`}>
                      {getRarityLabel(currentSticker.rarity)}
                    </div>

                    <motion.div
                      animate={{ 
                        y: [0, -10, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className={`w-32 h-32 mx-auto rounded-3xl ${currentSticker.color} flex items-center justify-center text-6xl shadow-inner mb-6 overflow-hidden`}
                    >
                      {currentSticker.image_url ? (
                        <img src={currentSticker.image_url} alt={currentSticker.name} className="w-full h-full object-cover" />
                      ) : (
                        currentSticker.emoji
                      )}
                    </motion.div>

                    <h3 className="text-2xl font-black text-gray-900 mb-2">
                      {currentSticker.name}
                    </h3>
                    <p className="text-gray-500 font-medium mb-8">
                      {currentSticker.desc}
                    </p>

                    <div className="flex gap-3">
                      <button 
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                      >
                        收入囊中
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
    </AnimatePresence>
  );
}
