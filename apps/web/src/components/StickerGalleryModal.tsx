import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Search, Filter } from "lucide-react";
import { OFFICIAL_STICKERS, StickerItem, resolveStickerImage } from "./StickerRevealModal";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { createPortal } from "react-dom";

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
  const tGallery = useTranslations("stickerGallery");
  const [mounted, setMounted] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<StickerItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [rarityFilter, setRarityFilter] = useState<
    "all" | "common" | "rare" | "epic" | "legendary"
  >("all");

  const displayStickers = stickers.length > 0 ? stickers : OFFICIAL_STICKERS;

  // Reset selected sticker when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSticker(null);
      setSearch("");
      setStatusFilter("all");
      setRarityFilter("all");
    }
  }, [isOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getRarityColor = (r: string) => {
    switch (r) {
      case "legendary":
        return "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600";
      case "epic":
        return "bg-purple-50 border-purple-200 text-purple-600";
      case "rare":
        return "bg-blue-50 border-blue-200 text-blue-600";
      default:
        return "bg-gray-50 border-gray-200 text-gray-600";
    }
  };

  const getRarityLabel = (r: string) => {
    switch (r) {
      case "legendary":
        return tGallery("rarity.legendary");
      case "epic":
        return tGallery("rarity.epic");
      case "rare":
        return tGallery("rarity.rare");
      default:
        return tGallery("rarity.common");
    }
  };

  const isOfficialSticker = (stickerId: string) =>
    OFFICIAL_STICKERS.some((s) => s.id === stickerId);

  const getStickerName = useCallback(
    (sticker: StickerItem) => {
      if (isOfficialSticker(sticker.id)) {
        return tGallery(`stickers.${sticker.id}.name`);
      }
      return sticker.name;
    },
    [tGallery]
  );

  const getStickerDesc = useCallback(
    (sticker: StickerItem) => {
      if (isOfficialSticker(sticker.id)) {
        return tGallery(`stickers.${sticker.id}.desc`);
      }
      return sticker.desc;
    },
    [tGallery]
  );

  const filteredStickers = useMemo(() => {
    let list = displayStickers;

    if (statusFilter !== "all") {
      list = list.filter((sticker) => {
        const unlocked = collectedIds.includes(sticker.id);
        return statusFilter === "unlocked" ? unlocked : !unlocked;
      });
    }

    if (rarityFilter !== "all") {
      list = list.filter((sticker) => sticker.rarity === rarityFilter);
    }

    if (search.trim()) {
      const keyword = search.trim().toLowerCase();
      list = list.filter((sticker) => {
        const name = getStickerName(sticker).toLowerCase();
        const desc = getStickerDesc(sticker).toLowerCase();
        return name.includes(keyword) || desc.includes(keyword);
      });
    }

    return list;
  }, [
    displayStickers,
    collectedIds,
    statusFilter,
    rarityFilter,
    search,
    getStickerName,
    getStickerDesc,
  ]);

  const total = displayStickers.length;
  const collected = collectedIds.length;
  const progress = total > 0 ? Math.round((collected / total) * 100) : 0;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl z-[9999] p-6 lg:p-8 max-h-[85vh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-4 mb-4 lg:mb-6 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                      {tGallery("title")}
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
                </div>

                <div className="mt-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          statusFilter === "all"
                            ? "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {tGallery("filters.all")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("unlocked")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          statusFilter === "unlocked"
                            ? "bg-emerald-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {tGallery("filters.unlocked")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("locked")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          statusFilter === "locked"
                            ? "bg-gray-800 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {tGallery("filters.locked")}
                      </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
                      <button
                        type="button"
                        onClick={() => setRarityFilter("all")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          rarityFilter === "all"
                            ? "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {tGallery("filters.rarityAll")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRarityFilter("common")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          rarityFilter === "common"
                            ? "bg-gray-200 text-gray-800"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {tGallery("rarity.common")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRarityFilter("rare")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          rarityFilter === "rare"
                            ? "bg-blue-500 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {tGallery("rarity.rare")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRarityFilter("epic")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          rarityFilter === "epic"
                            ? "bg-purple-500 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {tGallery("rarity.epic")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRarityFilter("legendary")}
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          rarityFilter === "legendary"
                            ? "bg-fuchsia-500 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {tGallery("rarity.legendary")}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>
                        {formatTranslation(tGallery("stats.visible"), {
                          current: filteredStickers.length,
                          total,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center rounded-full bg-gray-50 px-3 py-1.5">
                      <Search className="w-4 h-4 text-gray-400 mr-2" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={tGallery("search.placeholder")}
                        className="bg-transparent outline-none text-xs text-gray-700 placeholder:text-gray-400 w-40 sm:w-56"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="ml-2 p-2 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 overflow-hidden">
              <div className="flex-1 min-h-0 pr-1 pb-3">
                <VirtualizedGrid<StickerItem>
                  items={filteredStickers}
                  getItemKey={(item) => item.id}
                  estimatedRowHeight={180}
                  overscan={4}
                  containerHeight="100%"
                  gapClassName="gap-3"
                  columns={3}
                  emptyState={
                    <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-500">
                      <div className="mb-2 text-lg">🧐</div>
                      <div>{tGallery("empty")}</div>
                    </div>
                  }
                  renderItem={(sticker) => {
                    const isUnlocked = collectedIds.includes(sticker.id);
                    const isActive = selectedSticker?.id === sticker.id;
                    return (
                      <motion.div
                        whileHover={isUnlocked ? { scale: 1.05, y: -5 } : {}}
                        whileTap={isUnlocked ? { scale: 0.95 } : {}}
                        onClick={() => isUnlocked && setSelectedSticker(sticker)}
                        className={`
                          aspect-square rounded-3xl flex flex-col items-center justify-center p-4 border-2 transition-all cursor-pointer relative overflow-hidden
                          ${
                            isUnlocked
                              ? `${sticker.color} border-white shadow-sm hover:shadow-md`
                              : "bg-gray-50 border-gray-100 opacity-60"
                          }
                          ${isActive ? "ring-2 ring-purple-400 ring-offset-2 ring-offset-white" : ""}
                        `}
                      >
                        {isUnlocked ? (
                          <>
                            <div className="w-14 h-14 sm:w-16 sm:h-16 mb-2 flex items-center justify-center">
                              {resolveStickerImage(sticker) ? (
                                <img
                                  src={resolveStickerImage(sticker)!.src}
                                  alt={getStickerName(sticker)}
                                  className="w-full h-full object-cover rounded-xl"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <span className="text-3xl sm:text-4xl">{sticker.emoji}</span>
                              )}
                            </div>
                            <div
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getRarityColor(
                                sticker.rarity
                              )}`}
                            >
                              {getRarityLabel(sticker.rarity)}
                            </div>
                          </>
                        ) : (
                          <>
                            <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-gray-300 mb-2" />
                            <div className="text-[10px] font-bold text-gray-400">???</div>
                          </>
                        )}
                      </motion.div>
                    );
                  }}
                />
              </div>

              <div className="hidden lg:flex w-80 flex-col shrink-0 bg-gray-50/70 rounded-3xl p-4 border border-gray-100">
                {selectedSticker ? (
                  <>
                    <div
                      className={`w-20 h-20 rounded-2xl ${selectedSticker.color} flex items-center justify-center text-4xl shadow-inner mb-3 overflow-hidden`}
                    >
                      {resolveStickerImage(selectedSticker) ? (
                        <img
                          src={resolveStickerImage(selectedSticker)!.src}
                          alt={getStickerName(selectedSticker)}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span>{selectedSticker.emoji}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-gray-900 truncate">
                        {getStickerName(selectedSticker)}
                      </h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${getRarityColor(
                          selectedSticker.rarity
                        )}`}
                      >
                        {getRarityLabel(selectedSticker.rarity)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {getStickerDesc(selectedSticker)}
                    </p>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-xs text-gray-500">
                    <div className="text-2xl mb-2">👆</div>
                    <div className="text-center">{tGallery("sidebar.placeholder")}</div>
                  </div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {selectedSticker && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="lg:hidden mt-3 bg-white/90 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl p-3 flex items-center gap-3"
                >
                  <div
                    className={`w-14 h-14 rounded-2xl ${selectedSticker.color} flex items-center justify-center text-3xl shadow-inner shrink-0 overflow-hidden`}
                  >
                    {resolveStickerImage(selectedSticker) ? (
                      <img
                        src={resolveStickerImage(selectedSticker)!.src}
                        alt={getStickerName(selectedSticker)}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span>{selectedSticker.emoji}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 truncate">
                        {getStickerName(selectedSticker)}
                      </h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${getRarityColor(
                          selectedSticker.rarity
                        )}`}
                      >
                        {getRarityLabel(selectedSticker.rarity)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {getStickerDesc(selectedSticker)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSticker(null)}
                    className="p-1.5 hover:bg-gray-100 rounded-full shrink-0"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
