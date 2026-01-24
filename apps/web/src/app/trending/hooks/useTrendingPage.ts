"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useTranslations } from "@/lib/i18n";
import { type Prediction, buildTrendingCategories } from "@/features/trending/trendingModel";
import { createSmartClickEffect } from "@/features/trending/trendingAnimations";
import { useTrendingCanvas } from "@/features/trending/useTrendingCanvas";
import { useTrendingList } from "./useTrendingList";
import { useTrendingFollowState } from "./useTrendingFollowState";
import { useTrendingAdminEvents } from "./useTrendingAdminEvents";
import { useTrendingHero } from "./useTrendingHero";
import { normalizeAddress } from "@/lib/address";
import { useCategoryCounts } from "./useCategoryCounts";

type ScrollToSectionOptions = {
  onBeforeScroll?: () => void;
  targetRef: React.RefObject<HTMLElement | null>;
};

function scrollToSectionWithBehavior(options: ScrollToSectionOptions) {
  if (options.onBeforeScroll) options.onBeforeScroll();
  const target = options.targetRef.current;
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  }
}

export function useTrendingPage(initialPredictions?: Prediction[]) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWorkerRef = useRef<Worker | null>(null);
  const offscreenActiveRef = useRef<boolean>(false);
  const [highlightHero, setHighlightHero] = useState(false);
  const { canvasReady, showBackToTop, scrollToTop } = useTrendingCanvas(
    canvasRef,
    canvasWorkerRef,
    offscreenActiveRef
  );

  const tErrors = useTranslations("errors");
  const tTrending = useTranslations("trending");
  const tTrendingAdmin = useTranslations("trending.admin");
  const tNav = useTranslations("nav");
  const tEvents = useTranslations();
  const eventsSectionRef = useRef<HTMLElement | null>(null);

  const {
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
  } = useTrendingList(initialPredictions);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const { address } = useWallet();
  const profileCtx = useUserProfileOptional();
  const accountNorm = address ? normalizeAddress(address) : undefined;

  const categoryCounts = useCategoryCounts();

  const { followedEvents, followError, pendingFollows, toggleFollow } = useTrendingFollowState(
    accountNorm,
    () => setShowLoginModal(true),
    tErrors,
    queryClient,
    visibleEvents
  );

  const {
    isAdmin,
    editOpen,
    editForm,
    savingEdit,
    deleteBusyId,
    openEdit,
    closeEdit,
    setEditField,
    submitEdit,
    deleteEvent,
  } = useTrendingAdminEvents({
    accountNorm,
    profileIsAdmin: profileCtx?.isAdmin,
    queryClient,
    tTrendingAdmin,
    tTrending,
  });

  const categories = useMemo(() => buildTrendingCategories(tTrending), [tTrending]);
  const {
    currentHeroIndex,
    heroSlideLength,
    activeTitle,
    activeDescription,
    activeImage,
    activeCategory,
    activeFollowers,
    activeSlideId,
    autoPlayEnabled,
    isHoveringHero,
    handlePrevHero,
    handleNextHero,
    handleHeroBulletClick,
    handleViewAllCategories,
    handleCategoryClick,
    handleHeroMouseEnter,
    handleHeroMouseLeave,
  } = useTrendingHero(displayEvents, categories, setFilters, tTrending, tEvents);

  const handleViewAllCategoriesWithScroll = useCallback(() => {
    scrollToSectionWithBehavior({
      onBeforeScroll: handleViewAllCategories,
      targetRef: eventsSectionRef,
    });
  }, [handleViewAllCategories, eventsSectionRef]);

  const handleCategoryClickWithScroll = useCallback(
    (categoryName: string) => {
      handleCategoryClick(categoryName);
    },
    [handleCategoryClick]
  );

  const handleBackToTopClick = useCallback(
    (e: React.MouseEvent) => {
      scrollToTop();
      createSmartClickEffect(e);
      const heroSection = document.getElementById("trending-hero-section");
      if (heroSection && "focus" in heroSection) {
        (heroSection as HTMLElement).focus();
      }
      setHighlightHero(true);
      window.setTimeout(() => {
        setHighlightHero(false);
      }, 500);
    },
    [scrollToTop]
  );

  const handleCreatePrediction = useCallback(() => {
    if (isAdmin) {
      router.push("/admin/predictions/new");
      return;
    }
    router.push("/proposals");
  }, [router, isAdmin]);

  const handleCloseLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  return {
    canvas: {
      canvasRef,
      canvasReady,
      showBackToTop,
      handleBackToTopClick,
    },
    i18n: {
      tTrending,
      tTrendingAdmin,
      tNav,
      tEvents,
    },
    list: {
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
      eventsSectionRef,
    },
    follow: {
      categoryCounts,
      followedEvents,
      followError,
      pendingFollows,
      toggleFollow,
    },
    admin: {
      isAdmin,
      editOpen,
      editForm,
      savingEdit,
      deleteBusyId,
      openEdit,
      closeEdit,
      setEditField,
      submitEdit,
      deleteEvent,
    },
    hero: {
      categories,
      currentHeroIndex,
      heroSlideLength,
      activeTitle,
      activeDescription,
      activeImage,
      activeCategory,
      activeFollowers,
      activeSlideId,
      autoPlayEnabled,
      isHoveringHero,
      highlightHero,
      handlePrevHero,
      handleNextHero,
      handleHeroBulletClick,
      handleViewAllCategoriesWithScroll,
      handleCategoryClick: handleCategoryClickWithScroll,
      handleHeroMouseEnter,
      handleHeroMouseLeave,
    },
    modals: {
      showLoginModal,
      setShowLoginModal,
      handleCloseLoginModal,
    },
    actions: {
      handleCreatePrediction,
    },
  };
}

export type TrendingPageViewModel = ReturnType<typeof useTrendingPage>;
