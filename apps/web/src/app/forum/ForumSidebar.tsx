import React, { memo, useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInView } from "react-intersection-observer";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Search,
  Users,
  TrendingUp,
  Loader2,
  RefreshCw,
  Bell,
  ChevronUp,
} from "lucide-react";
import { normalizeCategory } from "@/features/trending/trendingModel";
import type { ForumCategory, PredictionItem } from "./useForumList";
import { TopicCardSkeletonList } from "./TopicCardSkeleton";
import { t } from "@/lib/i18n";

// 话题卡片预估高度（用于虚拟列表计算）
const TOPIC_CARD_HEIGHT = 110;

type ForumSidebarProps = {
  categories: ForumCategory[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filtered: PredictionItem[];
  loading: boolean;
  loadingMore?: boolean;
  error: string | null;
  selectedTopicId: number | null;
  setSelectedTopicId: React.Dispatch<React.SetStateAction<number | null>>;
  // 无限滚动相关
  hasNextPage?: boolean;
  loadMore?: () => void;
  total?: number;
  // 实时更新相关
  newCount?: number;
  refreshAndReset?: () => Promise<void>;
  isConnected?: boolean;
  // 滚动位置
  saveScrollPosition?: (position: number) => void;
  getSavedScrollPosition?: () => number;
  onTopicClick?: (id: number) => void;
};

export const ForumSidebar = memo(function ForumSidebar({
  categories,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  filtered,
  loading,
  loadingMore = false,
  error,
  selectedTopicId,
  setSelectedTopicId,
  hasNextPage = false,
  loadMore,
  total,
  newCount = 0,
  refreshAndReset,
  isConnected = false,
  saveScrollPosition,
  getSavedScrollPosition,
  onTopicClick,
}: ForumSidebarProps) {
  // 虚拟列表容器 ref
  const parentRef = useRef<HTMLDivElement>(null);

  // 下拉刷新状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  // 无限滚动检测
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px", // 提前 200px 触发加载
  });

  // 当滚动到底部触发加载更多
  useEffect(() => {
    if (inView && hasNextPage && !loadingMore && loadMore) {
      loadMore();
    }
  }, [inView, hasNextPage, loadingMore, loadMore]);

  // 保存滚动位置
  useEffect(() => {
    const container = parentRef.current;
    if (!container || !saveScrollPosition) return;

    const handleScroll = () => {
      saveScrollPosition(container.scrollTop);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [saveScrollPosition]);

  // 恢复滚动位置
  useEffect(() => {
    const container = parentRef.current;
    if (!container || !getSavedScrollPosition || loading) return;

    const savedPosition = getSavedScrollPosition();
    if (savedPosition > 0) {
      container.scrollTop = savedPosition;
    }
  }, [loading, getSavedScrollPosition]);

  // 下拉刷新处理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (parentRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return;

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, Math.min(100, currentY - touchStartY.current));
    setPullDistance(distance);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance > 60 && refreshAndReset && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await refreshAndReset();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, refreshAndReset, isRefreshing]);

  // 点击新话题横幅刷新
  const handleNewTopicClick = useCallback(async () => {
    if (refreshAndReset && !isRefreshing) {
      setIsRefreshing(true);
      // 滚动到顶部
      if (parentRef.current) {
        parentRef.current.scrollTop = 0;
      }
      try {
        await refreshAndReset();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [refreshAndReset, isRefreshing]);

  // 使用 useMemo 缓存分类计算
  const { allCategory, otherCategories } = useMemo(
    () => ({
      allCategory: categories.find((cat) => cat.id === "all"),
      otherCategories: categories.filter((cat) => cat.id !== "all"),
    }),
    [categories]
  );

  // 搜索防抖 - 内部维护即时显示值，延迟更新父级
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        setSearchQuery(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, setSearchQuery]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  }, []);

  // 预格式化日期缓存
  const formattedDates = useMemo(() => {
    const map = new Map<number, string>();
    filtered.forEach((topic) => {
      if (topic.created_at) {
        map.set(topic.id, new Date(topic.created_at).toLocaleDateString());
      }
    });
    return map;
  }, [filtered]);

  // 虚拟列表配置 - 增加额外项目用于加载更多指示器
  const virtualItemCount = filtered.length + (hasNextPage ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: virtualItemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // 最后一个是加载更多指示器
      if (index === filtered.length && hasNextPage) {
        return 60;
      }
      return TOPIC_CARD_HEIGHT;
    },
    overscan: 5, // 预渲染上下各 5 个项目
  });

  const virtualItems = virtualizer.getVirtualItems();

  // 显示的话题数量文本
  const topicCountText = useMemo(() => {
    if (loading) return null;
    if (total !== undefined && total > filtered.length) {
      return t("forum.topicCountLoaded")
        .replace("{loaded}", String(filtered.length))
        .replace("{total}", String(total));
    }
    if (filtered.length > 0) {
      return t("forum.topicCount").replace("{count}", String(filtered.length));
    }
    return null;
  }, [loading, filtered.length, total]);

  return (
    <div className="w-full md:w-56 lg:w-60 flex-shrink-0 border-r border-slate-200/70 dark:border-slate-800 flex flex-col overflow-x-hidden relative bg-white/80 dark:bg-slate-950/70">
      <div className="p-4 border-b border-slate-200/60 dark:border-slate-800 bg-transparent relative">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[var(--card-bg)] rounded-xl flex items-center justify-center text-brand shadow-lg shadow-indigo-200/20 border border-[var(--card-border)]">
            <MessageSquare size={20} fill="currentColor" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[var(--foreground)] leading-tight tracking-tight">
              {t("forum.sidebarTitle")}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1 h-1 rounded-full bg-brand animate-pulse"></div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">
                {t("forum.sidebarSubtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* 新手指引 */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          {t("forum.platformDescription")}
        </p>

        <div className="mb-4 space-y-3">
          {allCategory && (
            <div>
              <button
                onClick={() => setActiveCategory(allCategory.id)}
                className={`w-full flex items-center justify-center px-4 py-2.5 rounded-full text-[12px] font-bold tracking-wide border-2 transition-all duration-200 ${
                  activeCategory === allCategory.id
                    ? "bg-brand-accent text-white border-brand-accent shadow-md shadow-brand/40"
                    : "bg-brand-accent/15 text-brand-accent border-brand-accent/50 hover:bg-brand-accent/25"
                }`}
              >
                {allCategory.name}
              </button>
            </div>
          )}

          {otherCategories.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              {otherCategories.map((cat) => {
                const isActive = activeCategory === cat.id;
                const label = cat.id === "加密货币" ? "加密货币" : cat.name;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full px-3 py-1.5 rounded-full text-[11px] font-bold border-2 text-center transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? "bg-brand-accent text-white border-brand-accent shadow-sm"
                        : "bg-[var(--card-bg)] text-brand-accent border-brand-accent/30 hover:bg-brand-accent/10 dark:bg-slate-900/25"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-black/5 rounded-xl blur-md group-focus-within:bg-brand/5 transition-all"></div>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors z-10"
            size={16}
          />
          <input
            type="text"
            placeholder={t("forum.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-4 focus:ring-brand/10 focus:border-brand/40 transition-all outline-none relative z-0 shadow-sm group-hover:shadow-md"
            value={localSearch}
            onChange={handleSearchChange}
          />
        </div>

        {/* 话题数量提示 */}
        {topicCountText && (
          <div className="mt-3 text-[10px] text-slate-400 dark:text-slate-500 text-center">
            {topicCountText}
          </div>
        )}
      </div>

      {/* 新话题提示横幅 */}
      <AnimatePresence>
        {newCount > 0 && !loading && (
          <motion.button
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={handleNewTopicClick}
            disabled={isRefreshing}
            className="absolute top-[calc(100%-40px)] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand to-brand-accent text-white text-xs font-bold rounded-full shadow-lg shadow-brand/30 hover:shadow-brand/50 transition-all disabled:opacity-70"
          >
            {isRefreshing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Bell size={14} className="animate-bounce" />
            )}
            <span>{t("forum.newTopics").replace("{count}", String(newCount))}</span>
            <ChevronUp size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* 话题列表区域 - 使用虚拟列表 */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 下拉刷新指示器 */}
        <AnimatePresence>
          {(pullDistance > 0 || isRefreshing) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{
                opacity: 1,
                height: isRefreshing ? 40 : pullDistance * 0.5,
              }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center mb-2"
            >
              <div
                className={`flex items-center gap-2 text-xs text-slate-500 ${pullDistance > 60 || isRefreshing ? "text-brand" : ""}`}
              >
                <RefreshCw
                  size={14}
                  className={isRefreshing ? "animate-spin" : ""}
                  style={{ transform: `rotate(${pullDistance * 2}deg)` }}
                />
                <span>
                  {isRefreshing
                    ? t("forum.refreshing")
                    : pullDistance > 60
                      ? t("forum.releaseToRefresh")
                      : t("forum.pullToRefresh")}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 加载状态：显示骨架屏 */}
        {loading ? (
          <TopicCardSkeletonList count={5} />
        ) : filtered.length === 0 ? (
          /* 空状态 */
          <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            {error ? t("forum.noTopics") : t("forum.emptyTopics")}
          </div>
        ) : (
          /* 虚拟列表 */
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualItem) => {
              // 最后一项是加载更多指示器
              if (virtualItem.index === filtered.length && hasNextPage) {
                return (
                  <div
                    key="load-more"
                    ref={loadMoreRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="flex items-center justify-center py-4"
                  >
                    {loadingMore ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Loader2 size={14} className="animate-spin" />
                        <span>{t("forum.loadingMore")}</span>
                      </div>
                    ) : (
                      <button
                        onClick={loadMore}
                        className="text-xs text-brand hover:text-brand-accent transition-colors font-medium"
                      >
                        {t("forum.loadMore")}
                      </button>
                    )}
                  </div>
                );
              }

              const topic = filtered[virtualItem.index];
              if (!topic) return null;

              const catName = normalizeCategory(topic.category);
              const isActive = selectedTopicId === topic.id;

              return (
                <div
                  key={topic.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="pb-2"
                >
                  <button
                    onClick={() => {
                      setSelectedTopicId(topic.id);
                      if (onTopicClick) {
                        onTopicClick(topic.id);
                      }
                    }}
                    className={`w-full h-full text-left p-3.5 rounded-2xl transition-all duration-200 border group relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 hover:shadow-md hover:shadow-purple-200/30 ${
                      isActive
                        ? "ring-2 ring-purple-400/40 border-purple-300/60 shadow-lg shadow-purple-200/40 dark:ring-purple-500/40 dark:border-purple-500/40"
                        : "ring-1 ring-transparent hover:border-purple-300/60 dark:hover:border-purple-600/40"
                    }`}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-100/50 via-fuchsia-100/30 to-violet-50/20 dark:from-purple-900/25 dark:via-fuchsia-900/15 dark:to-transparent opacity-70" />
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-brand/10 text-brand border border-brand/15">
                          {catName}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {formattedDates.get(topic.id) ?? ""}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold leading-snug mb-2 text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white line-clamp-2">
                        {topic.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {topic.followers_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp size={12} className="text-brand" /> {catName}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
