import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, HelpCircle } from "lucide-react";
import { OFFICIAL_STICKERS, StickerItem } from "./StickerRevealModal";

interface StickerGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectedIds: string[]; // List of sticker IDs the user has collected
  stickers?: StickerItem[];
}

export default function StickerGalleryModal({
  isOpen,
  onClose,
  collectedIds,
  stickers = [],
}: StickerGalleryModalProps) {
  const [selectedSticker, setSelectedSticker] = useState<StickerItem | null>(null);

  const displayStickers = stickers.length > 0 ? stickers : OFFICIAL_STICKERS;

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

  const total = displayStickers.length;
  const collected = collectedIds.length;
  const progress = total > 0 ? Math.round((collected / total) * 100) : 0;

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
              {displayStickers.map((sticker) => {
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
                        : "bg-gray-50 border-gray-100 opacity-60 grayscale"
                      }
                    `}
                  >
                    {!isUnlocked && (
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="text-4xl mb-2 overflow-hidden flex items-center justify-center w-16 h-16">
                      {sticker.image_url ? (
                        <img src={sticker.image_url} alt={sticker.name} className="w-full h-full object-cover" />
                      ) : (
                        sticker.emoji
                      )}
                    </div>
                    <div className="text-xs font-bold text-center text-gray-600 truncate w-full">
                      {sticker.name}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Selected Sticker Detail Modal (nested) */}
            <AnimatePresence>
              {selectedSticker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-x-4 bottom-4 bg-white/90 backdrop-blur-md border border-white/50 shadow-lg rounded-3xl p-4 flex items-center gap-4 z-10"
                >
                  <div className={`w-16 h-16 rounded-2xl ${selectedSticker.color} flex items-center justify-center text-3xl shadow-inner shrink-0 overflow-hidden`}>
                     {selectedSticker.image_url ? (
                        <img src={selectedSticker.image_url} alt={selectedSticker.name} className="w-full h-full object-cover" />
                      ) : (
                        selectedSticker.emoji
                      )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 truncate">{selectedSticker.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${getRarityColor(selectedSticker.rarity)}`}>
                        {getRarityLabel(selectedSticker.rarity)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{selectedSticker.desc}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedSticker(null)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
