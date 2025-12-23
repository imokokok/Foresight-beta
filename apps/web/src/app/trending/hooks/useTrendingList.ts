"use client";

import type { Dispatch, SetStateAction } from "react";
import type { FilterSortState } from "@/components/FilterSort";
import { usePersistedState } from "@/hooks/usePersistedState";
import { usePredictions } from "@/hooks/useQueries";
import type { Prediction, TrendingEvent } from "@/features/trending/trendingModel";
import { useTrendingEvents } from "./useTrendingEvents";

export function useTrendingList(initialPredictions: Prediction[] | undefined): {
  predictions: Prediction[];
  loading: boolean;
  error: unknown;
  filters: FilterSortState;
  setFilters: Dispatch<SetStateAction<FilterSortState>>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  displayEvents: TrendingEvent[];
  sortedEvents: TrendingEvent[];
  visibleEvents: TrendingEvent[];
  loadingMore: boolean;
  hasMore: boolean;
  observerTargetRef: ReturnType<typeof useTrendingEvents>["observerTargetRef"];
} {
  const {
    data: predictions = [],
    isLoading: loading,
    error,
  } = usePredictions(undefined, { initialData: initialPredictions });

  const [filters, setFilters] = usePersistedState<FilterSortState>("trending_filters", {
    category: null,
    sortBy: "trending",
  });

  const {
    searchQuery,
    setSearchQuery,
    displayEvents,
    sortedEvents,
    visibleEvents,
    loadingMore,
    hasMore,
    observerTargetRef,
  } = useTrendingEvents(predictions, filters);

  return {
    predictions: predictions as Prediction[],
    loading,
    error,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    displayEvents,
    sortedEvents,
    visibleEvents,
    loadingMore,
    hasMore,
    observerTargetRef,
  };
}
