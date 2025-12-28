import React from "react";
import { useRouter } from "next/navigation";
import {
  HeroCategoryList,
  HeroMainInfo,
  HeroMetricsBar,
  HeroPreviewCard,
  HeroSearchInput,
  type Category,
} from "./TrendingHeroParts";

type TrendingHeroProps = {
  categories: Category[];
  categoryCounts: Record<string, number>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  activeTitle: string;
  activeDescription: string;
  activeImage: string;
  activeCategory: string | null;
  activeFollowers: number;
  activeSlideId: number | null;
  currentHeroIndex: number;
  heroSlideLength: number;
  autoPlayEnabled?: boolean;
  isHoveringHero?: boolean;
  highlightHero?: boolean;
  onPrevHero: () => void;
  onNextHero: () => void;
  onHeroBulletClick: (idx: number) => void;
  onViewAllCategories: () => void;
  onCategoryClick: (categoryName: string) => void;
  onHeroMouseEnter: () => void;
  onHeroMouseLeave: () => void;
  tTrending: (key: string) => string;
  tNav: (key: string) => string;
};

type TrendingHeroViewProps = {
  categories: Category[];
  categoryCounts: Record<string, number>;
  search: {
    query: string;
    onChange: (value: string) => void;
  };
  hero: {
    title: string;
    description: string;
    image: string;
    category: string | null;
    followers: number;
    slideId: number | null;
    currentIndex: number;
    totalSlides: number;
    autoPlayEnabled?: boolean;
    isHovering?: boolean;
    highlight?: boolean;
  };
  actions: {
    onPrevHero: () => void;
    onNextHero: () => void;
    onHeroBulletClick: (idx: number) => void;
    onViewAllCategories: () => void;
    onCategoryClick: (categoryName: string) => void;
    onOpenPrediction: (id: number) => void;
    onHeroMouseEnter: () => void;
    onHeroMouseLeave: () => void;
  };
  i18n: {
    tTrending: (key: string) => string;
    tNav: (key: string) => string;
  };
};
function TrendingHeroView({
  categories,
  categoryCounts,
  search,
  hero,
  actions,
  i18n,
}: TrendingHeroViewProps) {
  const { tTrending, tNav } = i18n;
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    search.onChange(e.target.value);
  };
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      actions.onViewAllCategories();
    }
  };

  return (
    <section
      id="trending-hero-section"
      className="relative w-full pt-4 pb-8 lg:pt-8 lg:pb-12 flex flex-col justify-center overflow-hidden"
      tabIndex={-1}
      onMouseEnter={actions.onHeroMouseEnter}
      onMouseLeave={actions.onHeroMouseLeave}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          actions.onPrevHero();
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          actions.onNextHero();
        }
      }}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-purple-200/40 to-blue-200/40 rounded-full blur-[120px] mix-blend-multiply opacity-70" />
        <div className="absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] bg-gradient-to-tr from-pink-200/40 to-orange-100/40 rounded-full blur-[100px] mix-blend-multiply opacity-70" />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 md:px-8 lg:px-12 w-full relative z-10">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mb-2 lg:mb-4">
          <HeroMetricsBar tTrending={tTrending} tNav={tNav} />
          <HeroSearchInput
            value={search.query}
            placeholder={tTrending("search.placeholder")}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        <div
          className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-20 transition-shadow transition-transform duration-300 ${
            hero.highlight
              ? "shadow-[0_0_0_2px_rgba(129,140,248,0.4)] lg:shadow-[0_0_0_3px_rgba(129,140,248,0.4)] rounded-[2rem]"
              : ""
          }`}
        >
          <HeroMainInfo
            activeTitle={hero.title}
            activeDescription={hero.description}
            activeCategory={hero.category}
            activeFollowers={hero.followers}
            onPlacePrediction={() => {
              if (!hero.slideId) return;
              actions.onOpenPrediction(hero.slideId);
            }}
            placePredictionLabel={tTrending("actions.placePrediction")}
            viewDetailsLabel={tTrending("actions.viewDetails")}
            dailyPickLabel={tTrending("badges.dailyPick")}
            trendingFallbackLabel={tTrending("badges.trending")}
            poolSizeLabel={tTrending("metrics.poolSize")}
            participantsLabel={tTrending("metrics.participants")}
          />

          <HeroPreviewCard
            activeImage={hero.image}
            activeTitle={hero.title}
            activeSlideId={hero.slideId}
            currentHeroIndex={hero.currentIndex}
            heroSlideLength={hero.totalSlides}
            autoPlayEnabled={hero.autoPlayEnabled}
            isHovering={hero.isHovering}
            onPrevHero={actions.onPrevHero}
            onNextHero={actions.onNextHero}
            onHeroBulletClick={actions.onHeroBulletClick}
            onOpenPrediction={() => {
              if (!hero.slideId) return;
              actions.onOpenPrediction(hero.slideId);
            }}
            successRateLabel={tTrending("metrics.successRate")}
          />
        </div>

        <HeroCategoryList
          categories={categories}
          activeCategory={hero.category}
          categoryCounts={categoryCounts}
          title={tTrending("sections.popularCategories")}
          eventsLabel={tTrending("metrics.events")}
          viewAllLabel={tTrending("actions.viewAll")}
          onViewAllCategories={actions.onViewAllCategories}
          onCategoryClick={actions.onCategoryClick}
        />
      </div>
    </section>
  );
}

export const TrendingHero = React.memo(function TrendingHero({
  categories,
  categoryCounts,
  searchQuery,
  onSearchQueryChange,
  activeTitle,
  activeDescription,
  activeImage,
  activeCategory,
  activeFollowers,
  activeSlideId,
  currentHeroIndex,
  heroSlideLength,
  autoPlayEnabled,
  isHoveringHero,
  highlightHero,
  onPrevHero,
  onNextHero,
  onHeroBulletClick,
  onViewAllCategories,
  onCategoryClick,
  onHeroMouseEnter,
  onHeroMouseLeave,
  tTrending,
  tNav,
}: TrendingHeroProps) {
  const router = useRouter();

  const handleOpenPrediction = (id: number) => {
    router.push(`/prediction/${id}`);
  };

  return (
    <TrendingHeroView
      categories={categories}
      categoryCounts={categoryCounts}
      search={{
        query: searchQuery,
        onChange: onSearchQueryChange,
      }}
      hero={{
        title: activeTitle,
        description: activeDescription,
        image: activeImage,
        category: activeCategory,
        followers: activeFollowers,
        slideId: activeSlideId,
        currentIndex: currentHeroIndex,
        totalSlides: heroSlideLength,
        autoPlayEnabled,
        isHovering: isHoveringHero,
        highlight: highlightHero,
      }}
      actions={{
        onPrevHero,
        onNextHero,
        onHeroBulletClick,
        onViewAllCategories,
        onCategoryClick,
        onOpenPrediction: handleOpenPrediction,
        onHeroMouseEnter,
        onHeroMouseLeave,
      }}
      i18n={{
        tTrending,
        tNav,
      }}
    />
  );
});
