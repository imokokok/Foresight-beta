import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import FilterSort, { type FilterSortState } from "@/components/FilterSort";
import { AllLoadedNotice, InfiniteScrollSentinel, ListError } from "@/components/ui/ListStates";
import { AnimatedCounter } from "@/components/ui/AnimatedNumber";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import type { TrendingEvent } from "@/features/trending/trendingModel";
import { normalizeEventId, isValidEventId } from "@/features/trending/trendingModel";
import { TrendingEventCard } from "./TrendingEventCard";

// 卡片入场动画 variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 24,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
    },
  },
};

type TrendingEventsSectionProps = {
  loading: boolean;
  error: unknown;
  filters: FilterSortState;
  onFilterChange: (state: FilterSortState) => void;
  searchQuery: string;
  totalEvents: number;
  onClearSearch: () => void;
  followError: string | null;
  sortedEvents: TrendingEvent[];
  visibleEvents: TrendingEvent[];
  followedEvents: Set<number>;
  pendingFollows: Set<number>;
  isAdmin: boolean;
  deleteBusyId: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  observerTargetRef: React.Ref<HTMLDivElement>;
  toggleFollow: (predictionId: number, event: React.MouseEvent) => void | Promise<void>;
  createCategoryParticlesAtCardClick: (event: React.MouseEvent, category?: string) => void;
  openEdit: (p: TrendingEvent) => void;
  deleteEvent: (id: number) => void;
  onCreatePrediction: () => void;
  tTrending: (key: string) => string;
  tTrendingAdmin: (key: string) => string;
  tEvents: (key: string) => string;
};

type TrendingEventsEmptyProps = {
  title: string;
  description: string;
  actionLabel: string;
  onCreatePrediction: () => void;
};

function TrendingEventsEmpty({
  title,
  description,
  actionLabel,
  onCreatePrediction,
}: TrendingEventsEmptyProps) {
  return (
    <EmptyState
      icon={TrendingUp}
      title={title}
      description={description}
      action={{
        label: actionLabel,
        onClick: onCreatePrediction,
      }}
    />
  );
}

type TrendingEventsGridProps = {
  visibleEvents: TrendingEvent[];
  followedEvents: Set<number>;
  pendingFollows: Set<number>;
  isAdmin: boolean;
  deleteBusyId: number | null;
  createCategoryParticlesAtCardClick: (event: React.MouseEvent, category?: string) => void;
  toggleFollow: (predictionId: number, event: React.MouseEvent) => void | Promise<void>;
  openEdit: (p: TrendingEvent) => void;
  deleteEvent: (id: number) => void;
  tTrending: (key: string) => string;
  tTrendingAdmin: (key: string) => string;
  tEvents: (key: string) => string;
};

// 虚拟化阈值：超过这个数量才使用虚拟列表
const VIRTUALIZATION_THRESHOLD = 50;

const TrendingEventsGrid = React.memo(function TrendingEventsGrid({
  visibleEvents,
  followedEvents,
  pendingFollows,
  isAdmin,
  deleteBusyId,
  createCategoryParticlesAtCardClick,
  toggleFollow,
  openEdit,
  deleteEvent,
  tTrending,
  tTrendingAdmin,
  tEvents,
}: TrendingEventsGridProps) {
  const router = useRouter();

  // 渲染单个卡片的函数
  const renderEventCard = useCallback(
    (product: TrendingEvent) => {
      const eventId = normalizeEventId(product.id);
      const isValidId = isValidEventId(eventId);
      const isFollowed = isValidId && followedEvents.has(eventId);
      const isFollowPending = isValidId && pendingFollows.has(eventId);

      return (
        <TrendingEventCard
          product={product}
          eventId={isValidId ? eventId : null}
          isFollowed={isFollowed}
          isFollowPending={isFollowPending}
          isAdmin={isAdmin}
          deleteBusyId={deleteBusyId}
          onCardClick={(e, category) => {
            createCategoryParticlesAtCardClick(e, category);
            if (isValidId) {
              router.push(`/prediction/${eventId}`);
            }
          }}
          onToggleFollow={(e, id) => {
            toggleFollow(id, e);
          }}
          onEdit={(_, p) => {
            openEdit(p);
          }}
          onDelete={(_, id) => {
            deleteEvent(id);
          }}
          tTrending={tTrending}
          tTrendingAdmin={tTrendingAdmin}
          tEvents={tEvents}
        />
      );
    },
    [
      followedEvents,
      pendingFollows,
      isAdmin,
      deleteBusyId,
      createCategoryParticlesAtCardClick,
      toggleFollow,
      openEdit,
      deleteEvent,
      router,
      tTrending,
      tTrendingAdmin,
      tEvents,
    ]
  );

  // 获取唯一 key
  const getItemKey = useCallback((product: TrendingEvent) => {
    const eventId = normalizeEventId(product.id);
    const isValidId = isValidEventId(eventId);
    return isValidId ? eventId : product.title;
  }, []);

  // 数据量大时使用虚拟列表
  if (visibleEvents.length > VIRTUALIZATION_THRESHOLD) {
    return (
      <VirtualizedGrid
        items={visibleEvents}
        renderItem={renderEventCard}
        getItemKey={getItemKey}
        estimatedRowHeight={340}
        overscan={2}
        containerHeight="calc(100vh - 400px)"
        gapClassName="gap-6 pb-4"
      />
    );
  }

  // 数据量小时使用普通网格 + 入场动画
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      key={visibleEvents.length} // 当列表变化时重新触发动画
    >
      {visibleEvents.map((product) => {
        const key = getItemKey(product);
        return (
          <motion.div key={key} variants={cardVariants}>
            {renderEventCard(product)}
          </motion.div>
        );
      })}
    </motion.div>
  );
});

type TrendingEventsSkeletonGridProps = {
  count?: number;
};

// 单个骨架卡片组件
function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      variants={cardVariants}
      className="glass-card rounded-2xl overflow-hidden relative flex flex-col h-full min-h-[250px]"
    >
      {/* Shimmer overlay - 交错延迟 */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
          animation: `shimmer 1.8s ease-in-out infinite`,
          animationDelay: `${index * 0.15}s`,
        }}
      />

      {/* 关注按钮骨架 */}
      <div className="absolute top-3 left-3 z-10">
        <div className="w-9 h-9 rounded-full bg-gray-200/80 animate-pulse" />
      </div>

      {/* 图片区域骨架 */}
      <div className="relative h-40 bg-gradient-to-br from-gray-200/80 to-gray-100/80">
        {/* 模拟图片加载的渐变效果 */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-300/20 to-transparent" />
      </div>

      {/* 内容区域 */}
      <div className="p-4 flex flex-col flex-1">
        {/* 标题骨架 - 两行 */}
        <div className="flex-1 min-h-[3rem] space-y-2">
          <div className="h-4 rounded-full bg-gray-200/80 w-[90%]" />
          <div className="h-4 rounded-full bg-gray-200/70 w-[65%]" />
        </div>

        {/* 统计信息骨架 */}
        <div className="mt-auto space-y-3">
          {/* 标签和数据行 */}
          <div className="flex items-center gap-2">
            {/* 交易量标签 */}
            <div className="h-5 rounded-lg bg-purple-100/60 w-20" />
            {/* 参与者 */}
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-200/80" />
              <div className="h-3 rounded-full bg-gray-200/70 w-6" />
            </div>
            {/* 关注数 */}
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-200/80" />
              <div className="h-3 rounded-full bg-gray-200/70 w-6" />
            </div>
          </div>

          {/* 选项标签骨架 */}
          <div className="pt-2 border-t border-gray-100/60 flex flex-wrap gap-1.5">
            <div className="h-5 rounded bg-gray-100/80 w-12" />
            <div className="h-5 rounded bg-gray-100/70 w-10" />
            <div className="h-5 rounded bg-gray-100/60 w-14" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TrendingEventsSkeletonGrid({ count = 8 }: TrendingEventsSkeletonGridProps) {
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} index={index} />
      ))}
    </motion.div>
  );
}

type TrendingEventsFilterBarProps = {
  loading: boolean;
  error: unknown;
  filters: FilterSortState;
  onFilterChange: (state: FilterSortState) => void;
  searchQuery: string;
  onClearSearch: () => void;
  totalEvents: number;
  tTrending: (key: string) => string;
};

function TrendingEventsFilterBar({
  loading,
  error,
  filters,
  onFilterChange,
  searchQuery,
  onClearSearch,
  totalEvents,
  tTrending,
}: TrendingEventsFilterBarProps) {
  if (loading || error) return null;

  const hasSearch = searchQuery.trim().length > 0;
  const hasFilter = filters.category || filters.status || filters.sortBy !== "trending";
  const showResultCount = hasSearch || hasFilter;

  return (
    <div className="mb-8 space-y-3">
      <FilterSort onFilterChange={onFilterChange} initialFilters={filters} showStatus />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-gray-500">
        {/* 筛选结果数量 */}
        {showResultCount && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-100"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-purple-700 font-medium">
              {tTrending("search.resultPrefix")}
              <AnimatedCounter
                value={totalEvents}
                className="text-purple-600 font-bold mx-1"
                duration={0.5}
              />
              {tTrending("search.resultSuffix")}
            </span>
          </motion.div>
        )}

        {/* 搜索关键词 */}
        {hasSearch && (
          <div className="flex items-center gap-2 max-w-full">
            <span className="truncate max-w-[160px] sm:max-w-[260px]">
              {tTrending("search.activeLabel")} &quot;{searchQuery}&quot;
            </span>
            <button
              type="button"
              onClick={onClearSearch}
              className="text-xs font-medium text-purple-600 hover:text-purple-800"
            >
              {tTrending("search.clear")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type TrendingEventsMainContentProps = {
  loading: boolean;
  error: unknown;
  followError: string | null;
  sortedEvents: TrendingEvent[];
  visibleEvents: TrendingEvent[];
  followedEvents: Set<number>;
  pendingFollows: Set<number>;
  isAdmin: boolean;
  deleteBusyId: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  observerTargetRef: React.Ref<HTMLDivElement>;
  createCategoryParticlesAtCardClick: (event: React.MouseEvent, category?: string) => void;
  toggleFollow: (predictionId: number, event: React.MouseEvent) => void | Promise<void>;
  openEdit: (p: TrendingEvent) => void;
  deleteEvent: (id: number) => void;
  onCreatePrediction: () => void;
  emptyTitleKey: string;
  emptyDescriptionKey: string;
  tTrending: (key: string) => string;
  tTrendingAdmin: (key: string) => string;
  tEvents: (key: string) => string;
};

function TrendingEventsMainContent({
  loading,
  error,
  followError,
  sortedEvents,
  visibleEvents,
  followedEvents,
  pendingFollows,
  isAdmin,
  deleteBusyId,
  hasMore,
  loadingMore,
  observerTargetRef,
  createCategoryParticlesAtCardClick,
  toggleFollow,
  openEdit,
  deleteEvent,
  onCreatePrediction,
  emptyTitleKey,
  emptyDescriptionKey,
  tTrending,
  tTrendingAdmin,
  tEvents,
}: TrendingEventsMainContentProps) {
  if (loading) {
    return (
      <div className="mb-8">
        <TrendingEventsSkeletonGrid />
        <p className="mt-6 text-center text-sm text-gray-500">{tTrending("state.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <ListError
        error={error}
        title={tTrending("state.errorTitle")}
        reloadLabel={tTrending("state.reload")}
      />
    );
  }

  return (
    <>
      {followError && (
        <div className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded" role="alert">
          {followError}
        </div>
      )}
      {sortedEvents.length === 0 || visibleEvents.length === 0 ? (
        <TrendingEventsEmpty
          title={tTrending(emptyTitleKey)}
          description={tTrending(emptyDescriptionKey)}
          actionLabel={tTrending("actions.createPrediction")}
          onCreatePrediction={onCreatePrediction}
        />
      ) : (
        <>
          <TrendingEventsGrid
            visibleEvents={visibleEvents}
            followedEvents={followedEvents}
            pendingFollows={pendingFollows}
            isAdmin={isAdmin}
            deleteBusyId={deleteBusyId}
            createCategoryParticlesAtCardClick={createCategoryParticlesAtCardClick}
            toggleFollow={toggleFollow}
            openEdit={openEdit}
            deleteEvent={deleteEvent}
            tTrending={tTrending}
            tTrendingAdmin={tTrendingAdmin}
            tEvents={tEvents}
          />

          <InfiniteScrollSentinel
            hasMore={hasMore}
            loadingMore={loadingMore}
            observerTargetRef={observerTargetRef}
            loadMoreLabel={tTrending("state.loadMore")}
            scrollHintLabel={tTrending("state.scrollHint")}
          />

          {!hasMore && sortedEvents.length > 0 && (
            <AllLoadedNotice
              totalCount={sortedEvents.length}
              prefixLabel={tTrending("state.allLoadedPrefix")}
              suffixLabel={tTrending("state.allLoadedSuffix")}
            />
          )}
        </>
      )}
    </>
  );
}

export const TrendingEventsSection = React.memo(function TrendingEventsSection(
  props: TrendingEventsSectionProps
) {
  const {
    loading,
    error,
    filters,
    onFilterChange,
    searchQuery,
    totalEvents,
    onClearSearch,
    followError,
    sortedEvents,
    visibleEvents,
    followedEvents,
    pendingFollows,
    isAdmin,
    deleteBusyId,
    hasMore,
    loadingMore,
    observerTargetRef,
    toggleFollow,
    createCategoryParticlesAtCardClick,
    openEdit,
    deleteEvent,
    onCreatePrediction,
    tTrending,
    tTrendingAdmin,
    tEvents,
  } = props;

  const activeFiltersCount = [
    filters.category && filters.category !== "all",
    filters.sortBy !== "trending",
    filters.status,
  ].filter(Boolean).length;

  const isSearchActive = searchQuery.trim().length > 0;
  const isFilterActive = activeFiltersCount > 0;

  const emptyTitleKey =
    isSearchActive && !isFilterActive
      ? "empty.searchTitle"
      : isFilterActive
        ? "empty.filteredTitle"
        : "empty.title";

  const emptyDescriptionKey =
    isSearchActive && !isFilterActive
      ? "empty.searchDescription"
      : isFilterActive
        ? "empty.filteredDescription"
        : "empty.description";

  return (
    <>
      <TrendingEventsFilterBar
        loading={loading}
        error={error}
        filters={filters}
        onFilterChange={onFilterChange}
        searchQuery={searchQuery}
        onClearSearch={onClearSearch}
        totalEvents={sortedEvents.length}
        tTrending={tTrending}
      />

      <TrendingEventsMainContent
        loading={loading}
        error={error}
        followError={followError}
        sortedEvents={sortedEvents}
        visibleEvents={visibleEvents}
        followedEvents={followedEvents}
        pendingFollows={pendingFollows}
        isAdmin={isAdmin}
        deleteBusyId={deleteBusyId}
        hasMore={hasMore}
        loadingMore={loadingMore}
        observerTargetRef={observerTargetRef}
        createCategoryParticlesAtCardClick={createCategoryParticlesAtCardClick}
        toggleFollow={toggleFollow}
        openEdit={openEdit}
        deleteEvent={deleteEvent}
        onCreatePrediction={onCreatePrediction}
        emptyTitleKey={emptyTitleKey}
        emptyDescriptionKey={emptyDescriptionKey}
        tTrending={tTrending}
        tTrendingAdmin={tTrendingAdmin}
        tEvents={tEvents}
      />
    </>
  );
});
