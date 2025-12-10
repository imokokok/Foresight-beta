import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, HelpCircle } from "lucide-react";
import { OFFICIAL_STICKERS, StickerItem } from "./StickerRevealModal";

interface StickerGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectedIds: string[]; // List of sticker IDs the user has collected
}

export default function StickerGalleryModal({
  isOpen,
  onClose,
  collectedIds,
}: StickerGalleryModalProps) {
  const [selectedSticker, setSelectedSticker] = useState<StickerItem | null>(null);

  // Reset selected sticker when modal opens
  useEffect(() => {
    if (isOpen) setSelectedSticker(null);
  }, [isOpen]);

  const getRarityColor = (r: string) => {
    switch (r) {
      case "legendary": return "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600";
      case "epic": return "bg-purple-50 border-purple-200 text-purple-600";
      case "rare": return "bg-blue-50 border-blue-200 text-blue-600";
      default: return "bg-gray-50 border-gray-200 text-gray-600";
    }
  };

  const getRarityLabel = (r: string) => {
    switch (r) {
      case "legendary": return "传说";
      case "epic": return "史诗";
      case "rare": return "稀有";
      default: return "普通";
    }
  };

  const total = OFFICIAL_STICKERS.length;
  const collected = collectedIds.length;
  const progress = Math.round((collected / total) * 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl z-[60] p-8 max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  表情包图鉴
                  <span className="text-sm font-bold bg-purple-100 text-purple-600 px-3 py-1 rounded-full">
                    {collected}/{total}
                  </span>
                </h3>
                <div className="mt-2 w-48 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-4 flex-1 scrollbar-hide">
              {OFFICIAL_STICKERS.map((sticker) => {
                const isUnlocked = collectedIds.includes(sticker.id);
                return (
                  <motion.div
                    key={sticker.id}
                    whileHover={isUnlocked ? { scale: 1.05, y: -5 } : {}}
                    whileTap={isUnlocked ? { scale: 0.95 } : {}}
                    onClick={() => isUnlocked && setSelectedSticker(sticker)}
                    className={`
                      aspect-square rounded-3xl flex flex-col items-center justify-center p-4 border-2 transition-all cursor-pointer relative overflow-hidden
                      ${isUnlocked 
                        ? `${sticker.color} border-white shadow-sm hover:shadow-md` 
                        : "bg-gray-50 border-gray-100 opacity-60"
                      }
                    `}
                  >
                    {isUnlocked ? (
                      <>
                        <div className="text-4xl mb-2">{sticker.emoji}</div>
                        <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getRarityColor(sticker.rarity)}`}>
                          {getRarityLabel(sticker.rarity)}
                        </div>
                      </>
                    ) : (
                      <>
                        <Lock className="w-8 h-8 text-gray-300 mb-2" />
                        <div className="text-[10px] font-bold text-gray-400">???</div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Detail View (Overlay) */}
            <AnimatePresence>
              {selectedSticker && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="absolute inset-x-4 bottom-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-[2rem] p-6 z-10"
                >
                  <button 
                    onClick={() => setSelectedSticker(null)}
                    className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                  
                  <div className="flex gap-6 items-center">
                    <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-6xl shadow-inner ${selectedSticker.color}`}>
                      {selectedSticker.emoji}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-xl font-black text-gray-900">{selectedSticker.name}</h4>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getRarityColor(selectedSticker.rarity)}`}>
                          {getRarityLabel(selectedSticker.rarity)}
                        </span>
                      </div>
                      <p className="text-gray-500 font-medium text-sm leading-relaxed">
                        {selectedSticker.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
