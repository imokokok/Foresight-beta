"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, ArrowUpDown, Calendar, TrendingUp, Clock, X, ChevronDown } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export interface FilterSortState {
  category: string | null;
  sortBy: "trending" | "newest" | "ending" | "popular";
  status?: "active" | "pending" | "ended" | null;
}

interface FilterSortProps {
  onFilterChange: (filters: FilterSortState) => void;
  initialFilters?: FilterSortState;
  showStatus?: boolean;
  className?: string;
}

// 分类定义：顺序与 hero 热门分类一致（科技、娱乐、时政、天气、体育、商业、加密货币、其他、更多）
const DEFAULT_CATEGORIES = [
  {
    id: "tech",
    labelKey: "filters.categories.tech",
    icon: "💻",
    color: "from-blue-400 to-cyan-400",
  },
  {
    id: "entertainment",
    labelKey: "filters.categories.entertainment",
    icon: "🎬",
    color: "from-pink-400 to-rose-400",
  },
  {
    id: "politics",
    labelKey: "filters.categories.politics",
    icon: "🗳️",
    color: "from-purple-400 to-indigo-400",
  },
  {
    id: "weather",
    labelKey: "filters.categories.weather",
    icon: "🌤️",
    color: "from-green-400 to-emerald-400",
  },
  {
    id: "sports",
    labelKey: "filters.categories.sports",
    icon: "⚽",
    color: "from-orange-400 to-red-400",
  },
  {
    id: "business",
    labelKey: "filters.categories.business",
    icon: "💼",
    color: "from-slate-400 to-gray-500",
  },
  {
    id: "crypto",
    labelKey: "filters.categories.crypto",
    icon: "🪙",
    color: "from-yellow-400 to-amber-500",
  },
  {
    id: "other",
    labelKey: "filters.categories.other",
    icon: "📦",
    color: "from-gray-300 to-gray-400",
  },
  {
    id: "more",
    labelKey: "filters.categories.more",
    icon: "⋯",
    color: "from-gray-200 to-gray-300",
  },
];

export default function FilterSort({
  onFilterChange,
  initialFilters = { category: null, sortBy: "trending" },
  showStatus = false,
  className = "",
}: FilterSortProps) {
  const t = useTranslations();
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialFilters.category || null
  );
  const [sortBy, setSortBy] = useState<FilterSortState["sortBy"]>(
    initialFilters.sortBy || "trending"
  );
  const [status, setStatus] = useState<FilterSortState["status"]>(initialFilters.status || null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  // 使用翻译后的 label 构建分类列表（去掉 "all" 选项）
  const categories = DEFAULT_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: t(cat.labelKey),
    icon: cat.icon,
    color: cat.color,
  }));

  const sortOptions = [
    {
      id: "trending",
      label: t("filters.sort.trending.label"),
      icon: TrendingUp,
      description: t("filters.sort.trending.description"),
    },
    {
      id: "newest",
      label: t("filters.sort.newest.label"),
      icon: Clock,
      description: t("filters.sort.newest.description"),
    },
    {
      id: "ending",
      label: t("filters.sort.ending.label"),
      icon: Calendar,
      description: t("filters.sort.ending.description"),
    },
    {
      id: "popular",
      label: t("filters.sort.popular.label"),
      icon: TrendingUp,
      description: t("filters.sort.popular.description"),
    },
  ];

  // 状态选项
  const statusOptions = [
    { id: "all", label: t("filters.status.all"), color: "bg-gray-100 text-gray-700" },
    { id: "active", label: t("filters.status.active"), color: "bg-green-100 text-green-700" },
    { id: "pending", label: t("filters.status.pending"), color: "bg-yellow-100 text-yellow-700" },
    { id: "ended", label: t("filters.status.ended"), color: "bg-gray-100 text-gray-500" },
  ];

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.category !== undefined) setActiveCategory(initialFilters.category);
      if (initialFilters.sortBy) setSortBy(initialFilters.sortBy);
      if (initialFilters.status !== undefined) setStatus(initialFilters.status);
    }
  }, [initialFilters]);

  // 更新父组件
  useEffect(() => {
    onFilterChange({
      category: activeCategory === "all" ? null : activeCategory,
      sortBy,
      status: status,
    });
  }, [activeCategory, sortBy, status, onFilterChange]);

  // 检查 activeCategory 是否有效
  const isValidCategory = activeCategory && categories.some((c) => c.id === activeCategory);

  // 选中的筛选项数量（只计算有效的筛选）
  const activeFiltersCount = [isValidCategory, sortBy !== "trending", status].filter(
    Boolean
  ).length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 筛选和排序按钮 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 筛选按钮 */}
        <button
          type="button"
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            isFilterOpen || activeFiltersCount > 0
              ? "bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 shadow-lg shadow-purple-200/50 border border-purple-200"
              : "bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:shadow-md"
          }`}
          aria-expanded={isFilterOpen}
          aria-controls="trending-filter-panel"
          aria-pressed={isFilterOpen || activeFiltersCount > 0}
        >
          <Filter className="w-4 h-4" />
          <span>{t("filters.actions.filter")}</span>
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-xs font-bold">
              {activeFiltersCount}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* 排序按钮 */}
        <button
          type="button"
          onClick={() => setIsSortOpen(!isSortOpen)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            isSortOpen
              ? "bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 shadow-lg shadow-purple-200/50 border border-purple-200"
              : "bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:shadow-md"
          }`}
          aria-expanded={isSortOpen}
          aria-controls="trending-sort-panel"
          aria-pressed={isSortOpen}
        >
          <ArrowUpDown className="w-4 h-4" />
          <span>{sortOptions.find((o) => o.id === sortBy)?.label}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isSortOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* 清空筛选 */}
        {activeFiltersCount > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => {
              setActiveCategory(null);
              setSortBy("trending");
              setStatus(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>{t("filters.actions.clear")}</span>
          </motion.button>
        )}
      </div>

      {/* 筛选面板 */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            id="trending-filter-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            role="region"
            aria-hidden={!isFilterOpen}
          >
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 space-y-5">
              {/* 分类筛选 */}
              <div>
                <div className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {t("filters.categoryLabel")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                      className={`group relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all overflow-hidden ${
                        activeCategory === cat.id
                          ? "text-white shadow-lg scale-105"
                          : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                      aria-pressed={activeCategory === cat.id}
                    >
                      {/* 渐变背景（选中时） */}
                      {activeCategory === cat.id && (
                        <div
                          className={`absolute inset-0 bg-gradient-to-r ${cat.color} opacity-100`}
                        />
                      )}

                      <span className="relative flex items-center gap-2">
                        <span className="text-lg">{cat.icon}</span>
                        <span>{cat.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 状态筛选（可选） */}
              {showStatus && (
                <div>
                  <div className="text-sm font-bold text-gray-700 mb-3">
                    {t("filters.actions.statusFilter")}
                  </div>
                  <div className="flex gap-2">
                    {statusOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setStatus(opt.id === "all" ? null : (opt.id as any))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          (opt.id === "all" && !status) || status === opt.id
                            ? "ring-2 ring-purple-500 ring-offset-2"
                            : ""
                        } ${opt.color}`}
                        aria-pressed={(opt.id === "all" && !status) || status === opt.id}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 排序面板 */}
      <AnimatePresence>
        {isSortOpen && (
          <motion.div
            id="trending-sort-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            role="region"
            aria-hidden={!isSortOpen}
          >
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 space-y-2">
              {sortOptions.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  onClick={() => {
                    setSortBy(id as any);
                    setIsSortOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    sortBy === id
                      ? "bg-purple-50 ring-2 ring-purple-500 ring-offset-2"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${sortBy === id ? "bg-gradient-to-r from-purple-200 to-pink-300 border border-purple-200" : "bg-gray-100"}`}
                  >
                    <Icon className={`w-4 h-4 ${sortBy === id ? "text-white" : "text-gray-600"}`} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-medium ${sortBy === id ? "text-purple-900" : "text-gray-900"}`}
                    >
                      {label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{description}</div>
                  </div>
                  {sortBy === id && (
                    <div className="mt-2">
                      <div className="w-2 h-2 bg-purple-600 rounded-full" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 当前筛选标签 - 显示所有已选择的筛选条件 */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">{t("filters.actions.currentFilter")}</span>

          {/* 分类标签 */}
          {isValidCategory &&
            (() => {
              const activeCat = categories.find((c) => c.id === activeCategory)!;
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium"
                >
                  <span>{activeCat.icon}</span>
                  <span>{activeCat.label}</span>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="hover:bg-purple-100 rounded p-0.5 transition-colors"
                    aria-label={t("filters.actions.clear")}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              );
            })()}

          {/* 排序标签（非默认时显示） */}
          {sortBy !== "trending" &&
            (() => {
              const activeSortOption = sortOptions.find((o) => o.id === sortBy);
              if (!activeSortOption) return null;
              const SortIcon = activeSortOption.icon;
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
                >
                  <SortIcon className="w-3.5 h-3.5" />
                  <span>{activeSortOption.label}</span>
                  <button
                    onClick={() => setSortBy("trending")}
                    className="hover:bg-blue-100 rounded p-0.5 transition-colors"
                    aria-label={t("filters.actions.clear")}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              );
            })()}

          {/* 状态标签 */}
          {status &&
            (() => {
              const activeStatusOption = statusOptions.find((o) => o.id === status);
              if (!activeStatusOption) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium"
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  <span>{activeStatusOption.label}</span>
                  <button
                    onClick={() => setStatus(null)}
                    className="hover:bg-amber-100 rounded p-0.5 transition-colors"
                    aria-label={t("filters.actions.clear")}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
