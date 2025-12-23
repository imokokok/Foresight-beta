import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRightCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  Sparkles,
  TrendingUp,
  Trophy,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Category = {
  name: string;
  label: string;
  icon: React.ReactNode;
};

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
  onPrevHero: () => void;
  onNextHero: () => void;
  onHeroBulletClick: (idx: number) => void;
  onViewAllCategories: () => void;
  onCategoryClick: (categoryName: string) => void;
  tTrending: (key: string) => string;
  tNav: (key: string) => string;
};

type HeroMetricsBarProps = {
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
  };
  actions: {
    onPrevHero: () => void;
    onNextHero: () => void;
    onHeroBulletClick: (idx: number) => void;
    onViewAllCategories: () => void;
    onCategoryClick: (categoryName: string) => void;
    onOpenPrediction: (id: number) => void;
  };
  i18n: {
    tTrending: (key: string) => string;
    tNav: (key: string) => string;
  };
};

function HeroMetricsBar({ tTrending, tNav }: HeroMetricsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 w-full xl:w-auto">
      <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/40 shadow-sm">
        <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-100/50 px-2 py-0.5 rounded-md cursor-default">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{tTrending("metrics.marketVol")}</span> $2.4M
        </span>
        <div className="w-px h-4 bg-gray-300" />
        <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded-md cursor-default">
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{tTrending("metrics.greed")}</span> 76
        </span>
      </div>

      <Link href="/leaderboard">
        <button className="flex items-center gap-2 bg-gradient-to-r from-amber-100/80 to-yellow-100/80 hover:from-amber-200 hover:to-yellow-200 backdrop-blur-md px-4 py-2 rounded-full border border-amber-200/60 shadow-sm transition-all hover:scale-105 hover:shadow-amber-500/20 group">
          <div className="bg-white rounded-full p-1 shadow-sm">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="text-xs font-bold text-amber-900">{tNav("leaderboard")}</span>
        </button>
      </Link>

      <Link href="/flags">
        <button className="flex items-center gap-2 bg-gradient-to-r from-purple-100/80 to-pink-100/80 hover:from-purple-200 hover:to-pink-200 backdrop-blur-md px-4 py-2 rounded-full border border-purple-200/60 shadow-sm transition-all hover:scale-105 hover:shadow-purple-500/20 group">
          <div className="bg-white rounded-full p-1 shadow-sm">
            <Flag className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <span className="text-xs font-bold text-purple-900">{tNav("flags")}</span>
        </button>
      </Link>
    </div>
  );
}

type HeroSearchInputProps = {
  value: string;
  placeholder: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

function HeroSearchInput({ value, placeholder, onChange }: HeroSearchInputProps) {
  return (
    <div className="relative group w-full md:w-auto flex justify-center md:justify-end">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
      </div>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full md:w-64 pl-10 pr-4 py-2 bg-white/80 backdrop-blur-xl border border-white/60 rounded-full text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all hover:shadow-md"
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

type HeroMainInfoProps = {
  activeTitle: string;
  activeDescription: string;
  activeCategory: string | null;
  activeFollowers: number;
  onPlacePrediction: () => void;
  placePredictionLabel: string;
  viewDetailsLabel: string;
  dailyPickLabel: string;
  trendingFallbackLabel: string;
  poolSizeLabel: string;
  participantsLabel: string;
};

type HeroBadgesProps = {
  activeCategory: string | null;
  dailyPickLabel: string;
  trendingFallbackLabel: string;
};

function HeroBadges({ activeCategory, dailyPickLabel, trendingFallbackLabel }: HeroBadgesProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5" />
        {dailyPickLabel}
      </span>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider shadow-sm">
        {activeCategory || trendingFallbackLabel}
      </span>
    </div>
  );
}

type HeroMetricsSummaryProps = {
  activeFollowers: number;
  poolSizeLabel: string;
  participantsLabel: string;
};

function HeroMetricsSummary({
  activeFollowers,
  poolSizeLabel,
  participantsLabel,
}: HeroMetricsSummaryProps) {
  return (
    <div className="flex items-center gap-8 py-4 border-t border-b border-gray-200/60">
      <div>
        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
          {poolSizeLabel}
        </div>
        <div className="text-2xl font-black text-gray-900 font-mono tracking-tight">
          ${(activeFollowers * 12.5).toLocaleString()}
        </div>
      </div>
      <div className="w-px h-10 bg-gray-200" />
      <div>
        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
          {participantsLabel}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white" />
            ))}
          </div>
          <span className="text-lg font-black text-gray-900 font-mono">
            +{activeFollowers.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

type HeroActionsProps = {
  onPlacePrediction: () => void;
  placePredictionLabel: string;
  viewDetailsLabel: string;
};

function HeroActions({
  onPlacePrediction,
  placePredictionLabel,
  viewDetailsLabel,
}: HeroActionsProps) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <button
        onClick={onPlacePrediction}
        className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-gray-900/20 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 group"
      >
        {placePredictionLabel}
        <ArrowRightCircle className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
      <button className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-sm shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all">
        {viewDetailsLabel}
      </button>
    </div>
  );
}

function HeroMainInfo({
  activeTitle,
  activeDescription,
  activeCategory,
  activeFollowers,
  onPlacePrediction,
  placePredictionLabel,
  viewDetailsLabel,
  dailyPickLabel,
  trendingFallbackLabel,
  poolSizeLabel,
  participantsLabel,
}: HeroMainInfoProps) {
  return (
    <div className="flex-1 w-full lg:w-1/2 space-y-8 min-h-[420px] flex flex-col justify-center">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <HeroBadges
          activeCategory={activeCategory}
          dailyPickLabel={dailyPickLabel}
          trendingFallbackLabel={trendingFallbackLabel}
        />

        <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight line-clamp-2 h-[2.2em]">
          {activeTitle}
        </h1>

        <p className="text-lg text-gray-600 leading-relaxed max-w-xl line-clamp-2 h-[3.5em]">
          {activeDescription}
        </p>

        <HeroMetricsSummary
          activeFollowers={activeFollowers}
          poolSizeLabel={poolSizeLabel}
          participantsLabel={participantsLabel}
        />

        <HeroActions
          onPlacePrediction={onPlacePrediction}
          placePredictionLabel={placePredictionLabel}
          viewDetailsLabel={viewDetailsLabel}
        />
      </motion.div>
    </div>
  );
}

type HeroPreviewCardProps = {
  activeImage: string;
  activeTitle: string;
  activeSlideId: number | null;
  currentHeroIndex: number;
  heroSlideLength: number;
  onPrevHero: () => void;
  onNextHero: () => void;
  onHeroBulletClick: (idx: number) => void;
  onOpenPrediction: () => void;
  successRateLabel: string;
};

function HeroPreviewCard({
  activeImage,
  activeTitle,
  activeSlideId,
  currentHeroIndex,
  heroSlideLength,
  onPrevHero,
  onNextHero,
  onHeroBulletClick,
  onOpenPrediction,
  successRateLabel,
}: HeroPreviewCardProps) {
  const canOpenPrediction = typeof activeSlideId === "number" && Number.isFinite(activeSlideId);

  return (
    <div className="w-full lg:w-1/2 relative h-[400px] md:h-[500px] flex items-center justify-center lg:justify-end">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-gradient-to-tr from-purple-100 to-blue-50 rounded-[3rem] rotate-6 opacity-60 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg aspect-[4/3] rounded-[2rem] shadow-2xl shadow-purple-900/10 bg-white p-3 cursor-pointer group"
        whileHover={{ y: -5, rotate: -1 }}
        onClick={() => {
          if (!canOpenPrediction) return;
          onOpenPrediction();
        }}
      >
        <div className="relative w-full h-full rounded-[1.5rem] overflow-hidden">
          <img
            src={activeImage}
            alt={activeTitle}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />

          <div
            className="absolute bottom-6 right-6 flex gap-3 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrevHero();
              }}
              className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white hover:text-purple-600 transition-all hover:-translate-y-1 active:translate-y-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNextHero();
              }}
              className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white hover:text-purple-600 transition-all hover:-translate-y-1 active:translate-y-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl border border-gray-100 flex items-center gap-4 max-w-[200px]"
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-bold">{successRateLabel}</div>
            <div className="text-lg font-black text-gray-900">84.5%</div>
          </div>
        </motion.div>
      </motion.div>

      <div className="absolute right-[-20px] lg:right-[-40px] top-1/2 -translate-y-1/2 flex flex-col gap-3">
        {Array.from({ length: Math.min(heroSlideLength, 5) }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => onHeroBulletClick(idx)}
            className={`w-1.5 rounded-full transition-all duration-300 ${
              currentHeroIndex === idx ? "h-8 bg-purple-600" : "h-2 bg-gray-300 hover:bg-purple-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

type HeroCategoryListProps = {
  categories: Category[];
  activeCategory: string | null;
  categoryCounts: Record<string, number>;
  title: string;
  eventsLabel: string;
  viewAllLabel: string;
  onViewAllCategories: () => void;
  onCategoryClick: (categoryName: string) => void;
};

function HeroCategoryList({
  categories,
  activeCategory,
  categoryCounts,
  title,
  eventsLabel,
  viewAllLabel,
  onViewAllCategories,
  onCategoryClick,
}: HeroCategoryListProps) {
  return (
    <div className="mt-2">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          {title}
        </h3>
        <button
          onClick={onViewAllCategories}
          className="text-sm font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
        >
          {viewAllLabel} <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {categories.map((category) => {
          const isActive = String(activeCategory || "") === category.name;
          return (
            <button
              key={category.name}
              onClick={() => onCategoryClick(category.name)}
              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 shrink-0 ${
                isActive
                  ? "bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-900/20 transform -translate-y-1"
                  : "bg-white text-gray-600 border-gray-200 hover:border-purple-200 hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              <span
                className={`text-xl ${
                  isActive ? "grayscale-0" : "grayscale group-hover:grayscale-0 transition-all"
                }`}
              >
                {category.icon}
              </span>
              <div className="text-left">
                <div className={`text-sm font-bold ${isActive ? "text-white" : "text-gray-900"}`}>
                  {category.label}
                </div>
                <div className="text-[10px] font-medium text-gray-400">
                  {categoryCounts[category.name] || 0} {eventsLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

  return (
    <section className="relative w-full pt-4 pb-8 lg:pt-8 lg:pb-12 flex flex-col justify-center overflow-hidden">
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
          />
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
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

export function TrendingHero({
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
  onPrevHero,
  onNextHero,
  onHeroBulletClick,
  onViewAllCategories,
  onCategoryClick,
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
      }}
      actions={{
        onPrevHero,
        onNextHero,
        onHeroBulletClick,
        onViewAllCategories,
        onCategoryClick,
        onOpenPrediction: handleOpenPrediction,
      }}
      i18n={{
        tTrending,
        tNav,
      }}
    />
  );
}
