"use client";

import React, { useRef, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import GradientPage from "@/components/ui/GradientPage";
import { BackToTopButton } from "@/components/ui/BackToTopButton";
import { useTranslations } from "@/lib/i18n";
import { type Prediction, buildTrendingCategories } from "./trendingModel";
import { createSmartClickEffect, createCategoryParticlesAtCardClick } from "./trendingAnimations";
import { useTrendingCanvas, useBackToTop } from "./useTrendingCanvas";
import { TrendingHero } from "./TrendingHero";
import { TrendingEditModal } from "./TrendingEditModal";
import { TrendingLoginModal } from "./TrendingLoginModal";
import { TrendingEventsSection } from "./TrendingEventsSection";
import { useTrendingList } from "./hooks/useTrendingList";
import { useTrendingFollowState } from "./hooks/useTrendingFollowState";
import { useTrendingAdminEvents } from "./hooks/useTrendingAdminEvents";
import { useTrendingHero } from "./hooks/useTrendingHero";
import { useCategoryCounts } from "./hooks/useCategoryCounts";

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

export default function TrendingPage({
  initialPredictions,
}: {
  initialPredictions?: Prediction[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWorkerRef = useRef<Worker | null>(null);
  const offscreenActiveRef = useRef<boolean>(false);
  const { canvasReady } = useTrendingCanvas(canvasRef, canvasWorkerRef, offscreenActiveRef);
  const { showBackToTop, scrollToTop } = useBackToTop();

  const tErrors = useTranslations("errors");
  const tTrending = useTranslations("trending");
  const tTrendingAdmin = useTranslations("trending.admin");
  const tNav = useTranslations("nav");
  const tEvents = useTranslations();
  const productsSectionRef = useRef<HTMLElement | null>(null);

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
  } = useTrendingList(initialPredictions as Prediction[] | undefined);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const { account, siweLogin } = useWallet();
  const profileCtx = useUserProfileOptional();
  const accountNorm = account?.toLowerCase();

  const categoryCounts = useCategoryCounts();

  // 从API获取预测事件数据
  /*
  const [predictions, setPredictions] = useState<any[]>(
    initialPredictions || []
  );
  const [loading, setLoading] = useState(!initialPredictions);
  const [error, setError] = useState<string | null>(null);

  // 获取预测事件数据
  useEffect(() => {
    // 如果有初始数据，则不再获取
    if (initialPredictions) {
      setTotalEventsCount(initialPredictions.length);
      if (initialPredictions.length < 6) {
        setDisplayCount(initialPredictions.length);
      }
      return;
    }

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const fetchWithRetry = async (
      url: string,
      opts: RequestInit = {},
      retries = 2,
      baseDelay = 300
    ) => {
      let attempt = 0;
      while (true) {
        try {
          const res = await fetch(url, opts);
          return res;
        } catch (err: any) {
          // 忽略 AbortError（热更新/页面切换常见），不进入失败状态
          if (err?.name === "AbortError") {
            throw err;
          }
          if (attempt >= retries) throw err;
          const delay = baseDelay * Math.pow(2, attempt);
          await sleep(delay);
          attempt++;
        }
      }
    };

    const fetchPredictions = async () => {
      try {
        setLoading(true);
        // 移除limit参数，获取所有事件数据；增加轻量重试与中断忽略
        const controller = new AbortController();
        const response = await fetchWithRetry(
          "/api/predictions",
          { signal: controller.signal },
          2,
          300
        );
        const result = await response.json();

        if (result.success) {
          setPredictions(result.data);
          setTotalEventsCount(result.data.length);
          // 确保displayCount不超过实际数据长度
          if (result.data.length < 6) {
            setDisplayCount(result.data.length);
          }
        } else {
          setError(result.message || "获取数据失败");
        }
      } catch (err) {
        // 热更新或主动取消时不显示失败
        if ((err as any)?.name === "AbortError") {
          console.warn("预测列表请求已中止（可能由热更新触发）");
        } else {
          setError("网络请求失败");
          console.error("获取预测事件失败:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, []);
  */

  const { followedEvents, followError, toggleFollow } = useTrendingFollowState(
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
    siweLogin,
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
    handlePrevHero,
    handleNextHero,
    handleHeroBulletClick,
    handleViewAllCategories,
    handleCategoryClick,
  } = useTrendingHero(displayEvents, categories, setFilters, tTrending, tEvents);
  const handleViewAllCategoriesWithScroll = () => {
    scrollToSectionWithBehavior({
      onBeforeScroll: handleViewAllCategories,
      targetRef: productsSectionRef,
    });
  };

  const handleBackToTopClick = (e: React.MouseEvent) => {
    scrollToTop();
    createSmartClickEffect(e);
  };

  return (
    <GradientPage className="relative overflow-x-hidden text-gray-900">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-500 ease-out ${
          canvasReady ? "opacity-40" : "opacity-0"
        }`}
      />
      <TrendingHero
        categories={categories}
        categoryCounts={categoryCounts}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        activeTitle={activeTitle}
        activeDescription={activeDescription}
        activeImage={activeImage}
        activeCategory={activeCategory}
        activeFollowers={activeFollowers}
        activeSlideId={activeSlideId}
        currentHeroIndex={currentHeroIndex}
        heroSlideLength={heroSlideLength}
        onPrevHero={handlePrevHero}
        onNextHero={handleNextHero}
        onHeroBulletClick={handleHeroBulletClick}
        onViewAllCategories={handleViewAllCategoriesWithScroll}
        onCategoryClick={handleCategoryClick}
        tTrending={tTrending}
        tNav={tNav}
      />

      <section
        ref={productsSectionRef}
        className="relative z-10 px-10 py-12 bg-white/40 backdrop-blur-xl rounded-t-[3rem] border-t border-white/50"
      >
        <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center flex items-center justify-center gap-3">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          {tTrending("sections.hotEvents")}
          <span className="w-2 h-2 rounded-full bg-purple-500" />
        </h3>
        <TrendingEventsSection
          loading={loading}
          error={error}
          filters={filters}
          onFilterChange={setFilters}
          followError={followError}
          sortedEvents={sortedEvents}
          visibleEvents={visibleEvents}
          followedEvents={followedEvents}
          isAdmin={isAdmin}
          deleteBusyId={deleteBusyId}
          hasMore={hasMore}
          loadingMore={loadingMore}
          observerTargetRef={observerTargetRef}
          toggleFollow={toggleFollow}
          createCategoryParticlesAtCardClick={createCategoryParticlesAtCardClick}
          openEdit={openEdit}
          deleteEvent={deleteEvent}
          onCreatePrediction={() => router.push("/prediction/new")}
          tTrending={tTrending}
          tTrendingAdmin={tTrendingAdmin}
          tEvents={tEvents}
        />
      </section>

      <TrendingEditModal
        open={editOpen}
        editForm={editForm}
        savingEdit={savingEdit}
        onChangeField={setEditField}
        onClose={closeEdit}
        onSubmit={submitEdit}
        tTrendingAdmin={tTrendingAdmin}
        tTrending={tTrending}
      />

      <TrendingLoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        tTrending={tTrending}
      />

      <footer className="relative z-10 text-center py-8 text-black text-sm">
        © 2025 Foresight. All rights reserved.
      </footer>

      <BackToTopButton show={showBackToTop} onClick={handleBackToTopClick} label="返回顶部" />
    </GradientPage>
  );
}
