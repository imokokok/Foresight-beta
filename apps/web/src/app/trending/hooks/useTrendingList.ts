"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
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

  const searchParams = useSearchParams();
  const didApplyUrlFiltersRef = useRef(false);

  const [filters, setFilters] = usePersistedState<FilterSortState>("trending_filters", {
    category: null,
    sortBy: "trending",
  });

  useEffect(() => {
    if (didApplyUrlFiltersRef.current) return;
    const rawCategory = searchParams.get("category");
    if (!rawCategory) return;
    const category = rawCategory.trim();
    const nextCategory =
      category === "" || category === "all" || category === "null" ? null : category;
    didApplyUrlFiltersRef.current = true;
    setFilters((prev) => {
      if (prev.category === nextCategory) return prev;
      return { ...prev, category: nextCategory };
    });
  }, [searchParams, setFilters]);

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
