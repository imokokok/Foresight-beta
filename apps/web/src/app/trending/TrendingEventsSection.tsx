import React, { useCallback } from "react";
import { TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import FilterSort, { type FilterSortState } from "@/components/FilterSort";
import { AllLoadedNotice, InfiniteScrollSentinel, ListError } from "@/components/ui/ListStates";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import type { TrendingEvent } from "@/features/trending/trendingModel";
import { normalizeEventId, isValidEventId } from "@/features/trending/trendingModel";
import { TrendingEventCard } from "./TrendingEventCard";

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

  // 数据量小时使用普通网格
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {visibleEvents.map((product) => {
        const key = getItemKey(product);
        return <div key={key}>{renderEventCard(product)}</div>;
      })}
    </div>
  );
});

type TrendingEventsSkeletonGridProps = {
  count?: number;
};

function TrendingEventsSkeletonGrid({ count = 8 }: TrendingEventsSkeletonGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-3xl border border-gray-100 bg-white/60 shadow-sm p-4 animate-pulse space-y-4"
        >
          <div className="h-40 rounded-2xl bg-gray-200" />
          <div className="h-4 rounded-full bg-gray-200 w-3/4" />
          <div className="h-3 rounded-full bg-gray-200 w-5/6" />
          <div className="flex items-center justify-between pt-2">
            <div className="h-3 rounded-full bg-gray-200 w-1/3" />
            <div className="h-8 rounded-full bg-gray-200 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

type TrendingEventsFilterBarProps = {
  loading: boolean;
  error: unknown;
  filters: FilterSortState;
  onFilterChange: (state: FilterSortState) => void;
  searchQuery: string;
  onClearSearch: () => void;
  tTrending: (key: string) => string;
};

function TrendingEventsFilterBar({
  loading,
  error,
  filters,
  onFilterChange,
  searchQuery,
  onClearSearch,
  tTrending,
}: TrendingEventsFilterBarProps) {
  if (loading || error) return null;

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div className="mb-8 space-y-3">
      <FilterSort onFilterChange={onFilterChange} initialFilters={filters} showStatus />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-gray-500">
        {hasSearch && (
          <div className="flex items-center gap-2 max-w-full">
            <span className="truncate max-w-[160px] sm:max-w-[260px]">
              {tTrending("search.activeLabel")} {searchQuery}
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
