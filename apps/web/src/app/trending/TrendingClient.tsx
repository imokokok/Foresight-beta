"use client";

import React from "react";
import GradientPage from "@/components/ui/GradientPage";
import { BackToTopButton } from "@/components/ui/BackToTopButton";
import type { Prediction } from "./trendingModel";
import { createCategoryParticlesAtCardClick } from "./trendingAnimations";
import { TrendingHero } from "./TrendingHero";
import { TrendingEditModal } from "./TrendingEditModal";
import { TrendingLoginModal } from "./TrendingLoginModal";
import { TrendingEventsSection } from "./TrendingEventsSection";
import { useTrendingPage } from "./hooks/useTrendingPage";

type TrendingPageProps = {
  initialPredictions?: Prediction[];
};

export default function TrendingPage({ initialPredictions }: TrendingPageProps) {
  const {
    canvasRef,
    canvasReady,
    showBackToTop,
    handleBackToTopClick,
    tTrending,
    tTrendingAdmin,
    tNav,
    tEvents,
    productsSectionRef,
    loading,
    error,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    sortedEvents,
    visibleEvents,
    loadingMore,
    hasMore,
    observerTargetRef,
    showLoginModal,
    setShowLoginModal,
    categoryCounts,
    followedEvents,
    followError,
    toggleFollow,
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
    categories,
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
    handleViewAllCategoriesWithScroll,
    handleCategoryClick,
    handleCreatePrediction,
  } = useTrendingPage(initialPredictions);

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
          onCreatePrediction={handleCreatePrediction}
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
