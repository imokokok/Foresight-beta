"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FilterSortState } from "@/components/FilterSort";
import {
  HERO_EVENTS,
  getActiveHeroSlideData,
  getFallbackEventImage,
  type TrendingEvent,
  type TrendingCategory,
} from "@/features/trending/trendingModel";

/**
 * 图片预加载 hook
 * 预加载当前、下一张、上一张图片，确保切换流畅
 */
function useImagePreloader(images: string[], currentIndex: number, preloadCount = 2) {
  const preloadedRef = useRef<Set<string>>(new Set());
  const imageObjectsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined" || images.length === 0) return;

    // 计算需要预加载的索引范围
    const indicesToPreload: number[] = [];
    for (let offset = -preloadCount; offset <= preloadCount; offset++) {
      const index = (currentIndex + offset + images.length) % images.length;
      indicesToPreload.push(index);
    }

    // 预加载图片
    indicesToPreload.forEach((index) => {
      const src = images[index];
      if (!src || preloadedRef.current.has(src)) return;

      const img = new Image();
      img.src = src;
      img.onload = () => {
        preloadedRef.current.add(src);
      };
      img.onerror = () => {
        // 加载失败时尝试 fallback 图片
        const fallback = getFallbackEventImage(`hero-${index}`);
        if (!preloadedRef.current.has(fallback)) {
          const fallbackImg = new Image();
          fallbackImg.src = fallback;
          imageObjectsRef.current.set(fallback, fallbackImg);
        }
      };
      imageObjectsRef.current.set(src, img);
    });

    // 清理过期的预加载图片（保留最近访问的）
    const recentImages = new Set(indicesToPreload.map((i) => images[i]));
    imageObjectsRef.current.forEach((_, key) => {
      if (!recentImages.has(key) && imageObjectsRef.current.size > 10) {
        imageObjectsRef.current.delete(key);
      }
    });
  }, [images, currentIndex, preloadCount]);

  return {
    isPreloaded: (src: string) => preloadedRef.current.has(src),
    preloadedCount: preloadedRef.current.size,
  };
}

type HeroCategories = TrendingCategory[];

type SetFiltersFn = Dispatch<SetStateAction<FilterSortState>>;

export function useTrendingHero(
  displayEvents: TrendingEvent[],
  categories: HeroCategories,
  setFilters: SetFiltersFn,
  tTrending: (key: string) => string,
  tEvents: (key: string) => string
) {
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [isHoveringHero, setIsHoveringHero] = useState(false);

  const heroSlideEvents = useMemo<TrendingEvent[]>(() => {
    const pool = displayEvents;
    if (pool.length === 0) return [];
    const now = Date.now();

    const popularitySorter = (a: TrendingEvent, b: TrendingEvent) => {
      const fa = Number(a.followers_count || 0);
      const fb = Number(b.followers_count || 0);
      if (fb !== fa) return fb - fa;
      const da = new Date(String(a?.deadline || 0)).getTime() - now;
      const db = new Date(String(b?.deadline || 0)).getTime() - now;
      const ta = da <= 0 ? Number.POSITIVE_INFINITY : da;
      const tb = db <= 0 ? Number.POSITIVE_INFINITY : db;
      return ta - tb;
    };

    const tags = Array.from(new Set(pool.map((e) => String(e.tag || "")).filter(Boolean)));
    const picks = tags
      .map<TrendingEvent | null>((tag) => {
        const group = pool.filter((e) => String(e.tag || "") === tag);
        if (group.length === 0) return null;
        return [...group].sort(popularitySorter)[0];
      })
      .filter((ev): ev is TrendingEvent => ev !== null);

    return [...picks].sort((a, b) => {
      const tagA = String(a.tag || "");
      const tagB = String(b.tag || "");
      const indexA = categories.findIndex((c) => c.name === tagA);
      const indexB = categories.findIndex((c) => c.name === tagB);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return popularitySorter(a, b);
    });
  }, [displayEvents, categories]);

  const heroSlideLength = heroSlideEvents.length || HERO_EVENTS.length;

  useEffect(() => {
    if (!heroSlideLength) {
      setCurrentHeroIndex(0);
      return;
    }
    setCurrentHeroIndex((prev) => prev % heroSlideLength);
  }, [heroSlideLength]);

  const {
    activeTitle,
    activeDescription,
    activeImage,
    activeCategory,
    activeFollowers,
    activeSlideId,
  } = useMemo(
    () => getActiveHeroSlideData(heroSlideEvents, currentHeroIndex, tTrending, tEvents),
    [heroSlideEvents, currentHeroIndex, tTrending, tEvents]
  );

  // 收集所有 Hero 图片 URL 用于预加载
  const heroImages = useMemo(() => {
    if (heroSlideEvents.length > 0) {
      return heroSlideEvents.map((e) => e.image);
    }
    return HERO_EVENTS.map((e) => e.image);
  }, [heroSlideEvents]);

  // 预加载当前、前后各 2 张图片
  useImagePreloader(heroImages, currentHeroIndex, 2);

  useEffect(() => {
    if (!heroSlideLength || heroSlideLength <= 1) return;
    if (!autoPlayEnabled) return;
    if (isHoveringHero) return;
    const interval = setInterval(() => {
      setCurrentHeroIndex((prevIndex) => (prevIndex + 1) % heroSlideLength);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroSlideLength, autoPlayEnabled, isHoveringHero]);

  const handlePrevHero = useCallback(() => {
    if (!heroSlideLength) return;
    setAutoPlayEnabled(false);
    setCurrentHeroIndex((prev) => (prev - 1 + heroSlideLength) % heroSlideLength);
  }, [heroSlideLength]);

  const handleNextHero = useCallback(() => {
    if (!heroSlideLength) return;
    setAutoPlayEnabled(false);
    setCurrentHeroIndex((prev) => (prev + 1) % heroSlideLength);
  }, [heroSlideLength]);

  const handleHeroBulletClick = useCallback((idx: number) => {
    setAutoPlayEnabled(false);
    setCurrentHeroIndex(idx);
  }, []);

  const handleViewAllCategories = useCallback(() => {
    setFilters((prev) => ({ ...prev, category: "all" }));
  }, [setFilters]);

  const handleCategoryClick = useCallback(
    (categoryName: string) => {
      setAutoPlayEnabled(false);
      const idx = heroSlideEvents.findIndex((ev) => String(ev?.tag || "") === categoryName);
      if (idx >= 0) {
        setCurrentHeroIndex(idx);
      } else {
        const fallbackIdx = HERO_EVENTS.findIndex((ev) => ev.category === categoryName);
        if (fallbackIdx >= 0) setCurrentHeroIndex(fallbackIdx);
      }
      // 热门分类点击只切换 Hero 展示，不影响筛选状态
    },
    [heroSlideEvents]
  );

  const handleHeroMouseEnter = useCallback(() => {
    setIsHoveringHero(true);
  }, []);

  const handleHeroMouseLeave = useCallback(() => {
    setIsHoveringHero(false);
  }, []);

  return {
    currentHeroIndex,
    heroSlideEvents,
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
    setCurrentHeroIndex,
    handleHeroMouseEnter,
    handleHeroMouseLeave,
  };
}
