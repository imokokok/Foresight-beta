import React from "react";
import {
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
import { getFallbackEventImage } from "@/features/trending/trendingModel";

export type Category = {
  name: string;
  label: string;
  icon: React.ReactNode;
};

export type HeroMetricsBarProps = {
  tTrending: (key: string) => string;
  tNav: (key: string) => string;
};

export function HeroMetricsBar({ tTrending, tNav }: HeroMetricsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 w-full xl:w-auto">
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

export type HeroSearchInputProps = {
  value: string;
  placeholder: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function HeroSearchInput({ value, placeholder, onChange, onKeyDown }: HeroSearchInputProps) {
  return (
    <div className="relative group w-full md:w-auto flex justify-center md:justify-end">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
      </div>
      <input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full md:w-64 pl-10 pr-4 py-2 bg-white/80 backdrop-blur-xl border border-white/60 rounded-full text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all hover:shadow-md"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

export type HeroMainInfoProps = {
  activeTitle: string;
  activeDescription: string;
  activeCategory: string | null;
  activeFollowers: number;
  onPlacePrediction: () => void;
  placePredictionLabel: string;
  dailyPickLabel: string;
  trendingFallbackLabel: string;
  poolSizeLabel: string;
  participantsLabel: string;
  platformDescription: string;
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
};

function HeroActions({ onPlacePrediction, placePredictionLabel }: HeroActionsProps) {
  return (
    <div className="pt-2">
      <button
        onClick={onPlacePrediction}
        className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-gray-900/20 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 group"
      >
        {placePredictionLabel}
        <ArrowRightCircle className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}

export function HeroMainInfo({
  activeTitle,
  activeDescription,
  activeCategory,
  activeFollowers,
  onPlacePrediction,
  placePredictionLabel,
  dailyPickLabel,
  trendingFallbackLabel,
  poolSizeLabel,
  participantsLabel,
  platformDescription,
}: HeroMainInfoProps) {
  return (
    <div className="flex-1 w-full lg:w-1/2 space-y-8 min-h-[420px] flex flex-col justify-center">
      <div className="space-y-6">
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

        <p className="text-sm text-gray-500 leading-relaxed max-w-xl">{platformDescription}</p>

        <HeroMetricsSummary
          activeFollowers={activeFollowers}
          poolSizeLabel={poolSizeLabel}
          participantsLabel={participantsLabel}
        />

        <HeroActions
          onPlacePrediction={onPlacePrediction}
          placePredictionLabel={placePredictionLabel}
        />
      </div>
    </div>
  );
}

export type HeroPreviewCardProps = {
  activeImage: string;
  activeTitle: string;
  activeSlideId: number | null;
  currentHeroIndex: number;
  heroSlideLength: number;
  autoPlayEnabled?: boolean;
  isHovering?: boolean;
  onPrevHero: () => void;
  onNextHero: () => void;
  onHeroBulletClick: (idx: number) => void;
  onOpenPrediction: () => void;
  successRateLabel: string;
};

export function HeroPreviewCard({
  activeImage,
  activeTitle,
  activeSlideId,
  currentHeroIndex,
  heroSlideLength,
  autoPlayEnabled = true,
  isHovering = false,
  onPrevHero,
  onNextHero,
  onHeroBulletClick,
  onOpenPrediction,
  successRateLabel,
}: HeroPreviewCardProps) {
  const canOpenPrediction = typeof activeSlideId === "number" && Number.isFinite(activeSlideId);
  const hasMultipleSlides = heroSlideLength > 1;
  const shouldAnimate = autoPlayEnabled && !isHovering && hasMultipleSlides;

  return (
    <div className="w-full lg:w-1/2 relative h-[400px] md:h-[500px] flex items-center justify-center lg:justify-end">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-gradient-to-tr from-purple-100 to-blue-50 rounded-[3rem] rotate-6 opacity-60 pointer-events-none" />

      <div
        className="relative z-10 w-full max-w-lg aspect-[4/3] rounded-[2rem] shadow-2xl shadow-purple-900/10 bg-white p-3 cursor-pointer group transition-transform duration-200 hover:-translate-y-1 hover:-rotate-1"
        role="button"
        tabIndex={canOpenPrediction ? 0 : -1}
        aria-disabled={!canOpenPrediction}
        aria-label={activeTitle}
        onKeyDown={(e) => {
          if (!canOpenPrediction) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenPrediction();
          }
        }}
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
            onError={(e) => {
              const img = e.currentTarget;
              img.onerror = null;
              img.src = getFallbackEventImage(activeTitle);
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />

          {/* 底部进度条区域 */}
          {hasMultipleSlides && (
            <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-4">
              {/* 分段进度条 */}
              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {Array.from({ length: Math.min(heroSlideLength, 5) }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onHeroBulletClick(idx)}
                    className="relative flex-1 h-1 rounded-full overflow-hidden bg-white/30 backdrop-blur-sm cursor-pointer hover:bg-white/50 transition-colors"
                    aria-label={`Go to slide ${idx + 1}`}
                    aria-current={currentHeroIndex === idx ? "true" : undefined}
                  >
                    {/* 已播放的进度 */}
                    {idx < currentHeroIndex && (
                      <div className="absolute inset-0 bg-white rounded-full" />
                    )}
                    {/* 当前播放的进度动画 */}
                    {idx === currentHeroIndex && (
                      <div
                        className={`absolute inset-y-0 left-0 bg-white rounded-full ${
                          shouldAnimate ? "animate-progress-bar" : "w-0"
                        }`}
                        style={{
                          animationDuration: shouldAnimate ? "5s" : "0s",
                          animationPlayState: shouldAnimate ? "running" : "paused",
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasMultipleSlides && (
            <div
              className="absolute bottom-14 right-6 flex gap-3 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrevHero();
                }}
                className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white hover:text-purple-600 transition-all hover:-translate-y-1 active:translate-y-0"
                aria-label="Previous hero slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNextHero();
                }}
                className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white hover:text-purple-600 transition-all hover:-translate-y-1 active:translate-y-0"
                aria-label="Next hero slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl border border-gray-100 flex items-center gap-4 max-w-[200px]">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-bold">{successRateLabel}</div>
            <div className="text-lg font-black text-gray-900">84.5%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type HeroCategoryListProps = {
  categories: Category[];
  activeCategory: string | null;
  categoryCounts: Record<string, number>;
  title: string;
  eventsLabel: string;
  viewAllLabel: string;
  onViewAllCategories: () => void;
  onCategoryClick: (categoryName: string) => void;
};

export function HeroCategoryList({
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
          const count = categoryCounts[category.name] || 0;
          return (
            <button
              key={category.name}
              type="button"
              onClick={() => onCategoryClick(category.name)}
              aria-pressed={isActive}
              aria-label={`${category.label}, ${count} ${eventsLabel}`}
              className={`group flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 shrink-0 active:scale-[0.97] ${
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
                  {count} {eventsLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
