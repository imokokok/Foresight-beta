"use client";

import Link from "next/link";
import GradientPage from "@/components/ui/GradientPage";
import { BackToTopButton } from "@/components/ui/BackToTopButton";
import type { Prediction } from "@/features/trending/trendingModel";
import { createCategoryParticlesAtCardClick } from "@/features/trending/trendingAnimations";
import { TrendingHero } from "./TrendingHero";
import { TrendingEditModal } from "./TrendingEditModal";
import { TrendingLoginModal } from "./TrendingLoginModal";
import { TrendingEventsSection } from "./TrendingEventsSection";
import { useTrendingPage } from "./hooks/useTrendingPage";

type TrendingPageProps = {
  initialPredictions?: Prediction[];
};

type TrendingPageViewProps = ReturnType<typeof useTrendingPage>;

function TrendingPageView({
  canvas,
  i18n,
  list,
  follow,
  admin,
  hero,
  modals,
  actions,
}: TrendingPageViewProps) {
  return (
    <GradientPage className="relative overflow-x-hidden text-gray-900">
      <canvas
        aria-hidden="true"
        ref={canvas.canvasRef}
        className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-500 ease-out ${
          canvas.canvasReady ? "opacity-40" : "opacity-0"
        }`}
      />
      <TrendingHero
        categories={hero.categories}
        categoryCounts={follow.categoryCounts}
        searchQuery={list.searchQuery}
        onSearchQueryChange={list.setSearchQuery}
        activeTitle={hero.activeTitle}
        activeDescription={hero.activeDescription}
        activeImage={hero.activeImage}
        activeCategory={hero.activeCategory}
        activeFollowers={hero.activeFollowers}
        activeSlideId={hero.activeSlideId}
        currentHeroIndex={hero.currentHeroIndex}
        heroSlideLength={hero.heroSlideLength}
        autoPlayEnabled={hero.autoPlayEnabled}
        isHoveringHero={hero.isHoveringHero}
        onHeroMouseEnter={hero.handleHeroMouseEnter}
        onHeroMouseLeave={hero.handleHeroMouseLeave}
        onPrevHero={hero.handlePrevHero}
        onNextHero={hero.handleNextHero}
        onHeroBulletClick={hero.handleHeroBulletClick}
        onViewAllCategories={hero.handleViewAllCategoriesWithScroll}
        onCategoryClick={hero.handleCategoryClick}
        tTrending={i18n.tTrending}
        tNav={i18n.tNav}
      />

      <section
        ref={list.eventsSectionRef}
        className="relative z-10 px-4 sm:px-6 lg:px-10 py-10 sm:py-12 bg-white/40 backdrop-blur-xl rounded-t-[3rem] border-t border-white/50"
        aria-labelledby="trending-events-heading"
      >
        <h3
          id="trending-events-heading"
          className="text-2xl font-bold text-gray-900 mb-4 text-center flex items-center justify-center gap-3"
        >
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          {i18n.tTrending("sections.hotEvents")}
          <span className="w-2 h-2 rounded-full bg-purple-500" />
        </h3>
        <p className="max-w-2xl mx-auto text-xs sm:text-sm text-gray-600 text-center mb-6">
          {i18n.tTrending("sections.descPart1")}{" "}
          <Link href="/proposals" className="text-purple-600 hover:text-purple-700 hover:underline">
            {i18n.tNav("proposals")}
          </Link>{" "}
          {i18n.tTrending("sections.descPart2")}{" "}
          <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
            {i18n.tNav("forum")}
          </Link>{" "}
          {i18n.tTrending("sections.descPart3")}{" "}
          <Link href="/flags" className="text-purple-600 hover:text-purple-700 hover:underline">
            {i18n.tNav("flags")}
          </Link>{" "}
          {i18n.tTrending("sections.descPart4")}{" "}
          <Link
            href="/leaderboard"
            className="text-purple-600 hover:text-purple-700 hover:underline"
          >
            {i18n.tNav("leaderboard")}
          </Link>{" "}
          {i18n.tTrending("sections.descPart5")}{" "}
          <Link href="/search" className="text-purple-600 hover:text-purple-700 hover:underline">
            {i18n.tTrending("sections.searchLink")}
          </Link>{" "}
          {i18n.tTrending("sections.descPart6")}
        </p>
        <TrendingEventsSection
          loading={list.loading}
          error={list.error}
          filters={list.filters}
          onFilterChange={list.setFilters}
          followError={follow.followError}
          sortedEvents={list.sortedEvents}
          visibleEvents={list.visibleEvents}
          searchQuery={list.searchQuery}
          totalEvents={list.displayEvents.length}
          onClearSearch={() => list.setSearchQuery("")}
          followedEvents={follow.followedEvents}
          pendingFollows={follow.pendingFollows}
          isAdmin={admin.isAdmin}
          deleteBusyId={admin.deleteBusyId}
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          observerTargetRef={list.observerTargetRef}
          toggleFollow={follow.toggleFollow}
          createCategoryParticlesAtCardClick={createCategoryParticlesAtCardClick}
          openEdit={admin.openEdit}
          deleteEvent={admin.deleteEvent}
          onCreatePrediction={actions.handleCreatePrediction}
          tTrending={i18n.tTrending}
          tTrendingAdmin={i18n.tTrendingAdmin}
          tEvents={i18n.tEvents}
        />
      </section>

      <TrendingEditModal
        open={admin.editOpen}
        editForm={admin.editForm}
        savingEdit={admin.savingEdit}
        onChangeField={admin.setEditField}
        onClose={admin.closeEdit}
        onSubmit={admin.submitEdit}
        tTrendingAdmin={i18n.tTrendingAdmin}
        tTrending={i18n.tTrending}
      />

      <TrendingLoginModal
        open={modals.showLoginModal}
        onClose={modals.handleCloseLoginModal}
        tTrending={i18n.tTrending}
      />

      <footer className="relative z-10 text-center py-8 text-black text-sm">
        {i18n.tTrending("footer.copyright")}
      </footer>

      <BackToTopButton
        show={canvas.showBackToTop}
        onClick={canvas.handleBackToTopClick}
        label={i18n.tNav("backToTop")}
      />
    </GradientPage>
  );
}

export default function TrendingPage({ initialPredictions }: TrendingPageProps) {
  const state = useTrendingPage(initialPredictions);

  return <TrendingPageView {...state} />;
}
