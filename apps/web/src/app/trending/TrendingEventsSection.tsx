import React from "react";
import { TrendingUp } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import FilterSort, { type FilterSortState } from "@/components/FilterSort";
import { AllLoadedNotice, InfiniteScrollSentinel, ListError } from "@/components/ui/ListStates";
import type { TrendingEvent } from "@/features/trending/trendingModel";
import { normalizeEventId, isValidEventId } from "@/features/trending/trendingModel";
import { TrendingEventCard } from "./TrendingEventCard";

type TrendingEventsSectionProps = {
  loading: boolean;
  error: unknown;
  filters: FilterSortState;
  onFilterChange: (state: FilterSortState) => void;
  followError: string | null;
  sortedEvents: TrendingEvent[];
  visibleEvents: TrendingEvent[];
  followedEvents: Set<number>;
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

const TrendingEventsGrid = React.memo(function TrendingEventsGrid({
  visibleEvents,
  followedEvents,
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {visibleEvents.map((product) => {
        const eventId = normalizeEventId(product.id);
        const isValidId = isValidEventId(eventId);
        const isFollowed = isValidId && followedEvents.has(eventId);

        return (
          <TrendingEventCard
            key={isValidId ? eventId : product.title}
            product={product}
            eventId={isValidId ? eventId : null}
            isFollowed={isFollowed}
            isAdmin={isAdmin}
            deleteBusyId={deleteBusyId}
            onCardClick={(e, category) => {
              createCategoryParticlesAtCardClick(e, category);
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

export const TrendingEventsSection = React.memo(function TrendingEventsSection(
  props: TrendingEventsSectionProps
) {
  const {
    loading,
    error,
    filters,
    onFilterChange,
    followError,
    sortedEvents,
    visibleEvents,
    followedEvents,
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
  return (
    <>
      {!loading && !error && (
        <div className="mb-8">
          <FilterSort onFilterChange={onFilterChange} initialFilters={filters} showStatus />
        </div>
      )}

      {loading && (
        <div className="mb-8">
          <TrendingEventsSkeletonGrid />
          <p className="mt-6 text-center text-sm text-gray-500">{tTrending("state.loading")}</p>
        </div>
      )}

      {error && (
        <ListError
          error={error}
          title={tTrending("state.errorTitle")}
          reloadLabel={tTrending("state.reload")}
        />
      )}

      {!loading && !error && (
        <>
          {followError && (
            <div className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded">{followError}</div>
          )}
          {sortedEvents.length === 0 ? (
            <TrendingEventsEmpty
              title={tTrending("empty.title")}
              description={tTrending("empty.description")}
              actionLabel={tTrending("actions.createPrediction")}
              onCreatePrediction={onCreatePrediction}
            />
          ) : (
            <>
              <TrendingEventsGrid
                visibleEvents={visibleEvents}
                followedEvents={followedEvents}
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
      )}
    </>
  );
});
