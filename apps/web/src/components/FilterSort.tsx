"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, ArrowUpDown, Calendar, TrendingUp, Clock, X, ChevronDown } from "lucide-react";
import { useCategories } from "@/hooks/useQueries";
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

const DEFAULT_CATEGORIES = [
  { id: "all", label: "filters.categories.all", icon: "🌐", color: "from-gray-500 to-gray-600" },
  {
    id: "crypto",
    label: "filters.categories.crypto",
    icon: "🪙",
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "sports",
    label: "filters.categories.sports",
    icon: "⚽",
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "politics",
    label: "filters.categories.politics",
    icon: "🗳️",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "tech",
    label: "filters.categories.tech",
    icon: "💻",
    color: "from-purple-500 to-violet-600",
  },
  {
    id: "entertainment",
    label: "filters.categories.entertainment",
    icon: "🎬",
    color: "from-pink-500 to-rose-600",
  },
  {
    id: "weather",
    label: "filters.categories.weather",
    icon: "🌤️",
    color: "from-cyan-500 to-sky-600",
  },
  {
    id: "business",
    label: "filters.categories.business",
    icon: "💼",
    color: "from-slate-500 to-gray-600",
  },
  { id: "more", label: "filters.categories.more", icon: "⋯", color: "from-gray-400 to-gray-500" },
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

  const { data: categoriesData } = useCategories();

  const categories =
    Array.isArray(categoriesData) && categoriesData.length > 0
      ? [
          DEFAULT_CATEGORIES[0],
          ...((categoriesData as any[])
            .map((item) => {
              const name = String((item as any).name || "").trim();
              if (!name) {
                return null;
              }
              const legacy = DEFAULT_CATEGORIES.find((c) => c.label === name);
              const id = legacy?.id || name.toLowerCase();
              const icon = legacy?.icon || "🏷️";
              const color = legacy?.color || "from-gray-400 to-gray-500";
              return {
                id,
                label: name,
                icon,
                color,
              };
            })
            .filter(Boolean) as {
            id: string;
            label: string;
            icon: string;
            color: string;
          }[]),
        ]
      : DEFAULT_CATEGORIES;

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

  // 监听外部筛选条件变化
  useEffect(() => {
    if (initialFilters) {
      // 只有当值有定义时才更新，避免重置为 undefined
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

  // 选中的筛选项数量
  const activeFiltersCount = [
    activeCategory && activeCategory !== "all",
    sortBy !== "trending",
    status,
  ].filter(Boolean).length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 筛选和排序按钮 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 筛选按钮 */}
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            isFilterOpen || activeFiltersCount > 0
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
              : "bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:shadow-md"
          }`}
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
          onClick={() => setIsSortOpen(!isSortOpen)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            isSortOpen
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
              : "bg-white text-gray-700 border border-gray-200 hover:border-purple-300 hover:shadow-md"
          }`}
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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
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
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`group relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all overflow-hidden ${
                        (cat.id === "all" && !activeCategory) || activeCategory === cat.id
                          ? "text-white shadow-lg scale-105"
                          : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {/* 渐变背景（选中时） */}
                      {((cat.id === "all" && !activeCategory) || activeCategory === cat.id) && (
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
                        key={opt.id}
                        onClick={() => setStatus(opt.id === "all" ? null : (opt.id as any))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          (opt.id === "all" && !status) || status === opt.id
                            ? "ring-2 ring-purple-500 ring-offset-2"
                            : ""
                        } ${opt.color}`}
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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
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
                    className={`p-2 rounded-lg ${sortBy === id ? "bg-purple-600" : "bg-gray-100"}`}
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

      {/* 当前筛选标签 */}
      {activeCategory && activeCategory !== "all" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">{t("filters.actions.currentFilter")}</span>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium"
          >
            <span>{categories.find((c) => c.id === activeCategory)?.icon}</span>
            <span>
              {categories.find((c) => c.id === activeCategory)?.label
                ? t(categories.find((c) => c.id === activeCategory)!.label)
                : null}
            </span>
            <button
              onClick={() => setActiveCategory("all")}
              className="hover:bg-purple-100 rounded p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
