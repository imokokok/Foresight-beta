"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { followPrediction, unfollowPrediction } from "@/lib/follows";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import FilterSort, { type FilterSortState } from "@/components/FilterSort";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useTranslations } from "@/lib/i18n";
import {
  HERO_EVENTS,
  TRENDING_CATEGORIES,
  CATEGORY_MAPPING,
  ID_TO_CATEGORY_NAME,
  type Prediction,
  type TrendingEvent,
  fetchPredictions,
  mapPredictionToEvent,
  filterEventsByCategory,
  filterEventsByStatus,
  sortEvents,
} from "./trendingModel";
import {
  createSmartClickEffect,
  createHeartParticles,
  createCategoryParticlesAtCardClick,
} from "./trendingAnimations";
import { useTrendingCanvas } from "./useTrendingCanvas";
import { TrendingHero } from "./TrendingHero";
import { TrendingEditModal } from "./TrendingEditModal";
import { TrendingLoginModal } from "./TrendingLoginModal";
import { TrendingEventsSection } from "./TrendingEventsSection";

const useTrendingFollowState = (
  accountNorm: string | undefined,
  setShowLoginModal: (open: boolean) => void,
  tErrors: (key: string) => string,
  queryClient: QueryClient,
  visibleEvents: TrendingEvent[]
) => {
  const [followedEvents, setFollowedEvents] = useState<Set<number>>(new Set());
  const [followError, setFollowError] = useState<string | null>(null);

  const toggleFollow = useCallback(
    async (predictionId: number, event: React.MouseEvent) => {
      if (!accountNorm) {
        setShowLoginModal(true);
        return;
      }

      if (!Number.isFinite(Number(predictionId))) return;

      const normalizedId = Number(predictionId);
      const wasFollowing = followedEvents.has(normalizedId);

      createSmartClickEffect(event);
      createHeartParticles(event.currentTarget as HTMLElement, wasFollowing);

      setFollowedEvents((prev) => {
        const next = new Set(prev);
        if (next.has(normalizedId)) {
          next.delete(normalizedId);
        } else {
          next.add(normalizedId);
        }
        return next;
      });

      try {
        if (wasFollowing) {
          await unfollowPrediction(normalizedId, accountNorm);
        } else {
          await followPrediction(normalizedId, accountNorm);
        }
      } catch (err) {
        console.error("关注/取消关注失败:", err);
        setFollowError(
          (err as any)?.message ? String((err as any).message) : tErrors("followActionFailed")
        );
        setTimeout(() => setFollowError(null), 3000);
        setFollowedEvents((prev) => {
          const rollback = new Set(prev);
          if (wasFollowing) {
            rollback.add(normalizedId);
          } else {
            rollback.delete(normalizedId);
          }
          return rollback;
        });
      }
    },
    [accountNorm, followedEvents, setShowLoginModal, tErrors]
  );

  useEffect(() => {
    if (!accountNorm) return;
    (async () => {
      try {
        const res = await fetch(`/api/user-follows?address=${accountNorm}`);
        if (!res.ok) return;
        const data = await res.json();
        const ids = new Set<number>((data?.follows || []).map((e: any) => Number(e.id)));
        setFollowedEvents(ids);
      } catch (err) {
        console.warn("同步关注状态失败:", err);
      }
    })();
  }, [accountNorm]);

  useEffect(() => {
    let windowIds: number[] = [];
    windowIds = visibleEvents.map((e) => Number(e?.id)).filter(Number.isFinite) as number[];
    const ids = Array.from(new Set(windowIds));
    if (ids.length === 0) return;
    if (!supabase || typeof (supabase as any).channel !== "function") {
      return;
    }

    let channel: any = null;
    let isSubscribed = true;

    const filterIn = `event_id=in.(${ids.join(",")})`;
    channel = (supabase as any).channel("event_follows_trending");

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_follows",
          filter: filterIn,
        },
        (payload: any) => {
          if (!isSubscribed) return;
          const row = payload?.new || {};
          const eid = Number(row?.event_id);
          const uid = String(row?.user_id || "");
          if (!Number.isFinite(eid)) return;
          if (!accountNorm || (uid || "").toLowerCase() !== accountNorm) {
            queryClient.setQueryData(["predictions"], (old: any[]) =>
              old?.map((p: any) =>
                p?.id === eid
                  ? {
                      ...p,
                      followers_count: Number(p?.followers_count || 0) + 1,
                    }
                  : p
              )
            );
          }
          if (accountNorm && (uid || "").toLowerCase() === accountNorm) {
            setFollowedEvents((prev) => {
              const s = new Set(prev);
              s.add(eid);
              return s;
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "event_follows",
          filter: filterIn,
        },
        (payload: any) => {
          if (!isSubscribed) return;
          const row = payload?.old || {};
          const eid = Number(row?.event_id);
          const uid = String(row?.user_id || "");
          if (!Number.isFinite(eid)) return;
          if (!accountNorm || (uid || "").toLowerCase() !== accountNorm) {
            queryClient.setQueryData(["predictions"], (old: any[]) =>
              old?.map((p: any) =>
                p?.id === eid
                  ? {
                      ...p,
                      followers_count: Math.max(0, Number(p?.followers_count || 0) - 1),
                    }
                  : p
              )
            );
          }
          if (accountNorm && (uid || "").toLowerCase() === accountNorm) {
            setFollowedEvents((prev) => {
              const s = new Set(prev);
              s.delete(eid);
              return s;
            });
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;

      if (channel) {
        try {
          channel.unsubscribe();
          (supabase as any).removeChannel(channel);
          channel = null;
        } catch (error) {
          console.error("Failed to cleanup WebSocket channel:", error);
        }
      }
    };
  }, [visibleEvents, accountNorm, queryClient]);

  return { followedEvents, followError, toggleFollow };
};

const useTrendingEventList = (predictions: Prediction[], filters: FilterSortState) => {
  const [displayCount, setDisplayCount] = useState(12);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const allEvents: TrendingEvent[] = useMemo(
    () => predictions.map((prediction) => mapPredictionToEvent(prediction as Prediction)),
    [predictions]
  );

  const displayEvents = useMemo(() => {
    if (!searchQuery.trim()) return allEvents;
    const q = searchQuery.toLowerCase();
    return allEvents.filter(
      (e: any) =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q) ||
        (e.tag || "").toLowerCase().includes(q)
    );
  }, [allEvents, searchQuery]);

  useEffect(() => {
    setTotalEventsCount(displayEvents.length);
  }, [displayEvents]);

  const sortedEvents: TrendingEvent[] = useMemo(() => {
    const filteredByCategory = filterEventsByCategory(
      displayEvents as TrendingEvent[],
      filters.category || null
    );
    const filteredByStatus = filterEventsByStatus(filteredByCategory, filters.status || null);
    return sortEvents(filteredByStatus, filters.sortBy);
  }, [displayEvents, filters.category, filters.sortBy, filters.status]) as TrendingEvent[];

  const visibleEvents = useMemo(
    () => sortedEvents.slice(0, Math.max(0, displayCount)),
    [sortedEvents, displayCount]
  );

  const hasMore = displayCount < totalEventsCount;

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + 6, totalEventsCount));
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, hasMore, totalEventsCount]);

  const observerTargetRef = useInfiniteScroll({
    loading: loadingMore,
    hasNextPage: hasMore,
    onLoadMore: handleLoadMore,
    threshold: 0.1,
  });

  return {
    searchQuery,
    setSearchQuery,
    allEvents,
    displayEvents,
    sortedEvents,
    visibleEvents,
    totalEventsCount,
    loadingMore,
    hasMore,
    observerTargetRef,
  };
};

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
  const { canvasReady, showBackToTop, scrollToTop } = useTrendingCanvas(
    canvasRef,
    canvasWorkerRef,
    offscreenActiveRef
  );

  const {
    data: predictions = [],
    isLoading: loading,
    error,
  } = useQuery<Prediction[]>({
    queryKey: ["predictions"],
    queryFn: fetchPredictions,
    initialData: initialPredictions,
    staleTime: 1000 * 60,
    enabled: !initialPredictions,
  });

  const tErrors = useTranslations("errors");
  const tTrending = useTranslations("trending");
  const tTrendingAdmin = useTranslations("trending.admin");
  const tNav = useTranslations("nav");
  const tEvents = useTranslations();

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const productsSectionRef = useRef<HTMLElement | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // 筛选排序状态（持久化）
  const [filters, setFilters] = usePersistedState<FilterSortState>("trending_filters", {
    category: null,
    sortBy: "trending",
  });

  const [showLoginModal, setShowLoginModal] = useState(false);
  const { account, siweLogin } = useWallet();
  const profileCtx = useUserProfileOptional();
  const accountNorm = account?.toLowerCase();

  const {
    searchQuery,
    setSearchQuery,
    allEvents,
    displayEvents,
    sortedEvents,
    visibleEvents,
    totalEventsCount,
    loadingMore,
    hasMore,
    observerTargetRef,
  } = useTrendingEventList(predictions, filters);

  useEffect(() => {
    const fetchCategoryCounts = async () => {
      try {
        const controller = new AbortController();
        const response = await fetch("/api/categories/counts", {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // 将数组转换为对象，方便查找
            const countsObj: Record<string, number> = {};
            data.data.forEach((item: { category: string; count: number }) => {
              countsObj[item.category] = item.count;
            });
            setCategoryCounts(countsObj);
          }
        }
      } catch (error) {
        // 忽略主动中止与热更新导致的网络中断
        if ((error as any)?.name !== "AbortError") {
          console.error("获取分类热点数量失败:", error);
        }
      }
    };

    fetchCategoryCounts();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroIndex((prevIndex) => prevIndex + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const [isAdmin, setIsAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    title: "",
    category: "",
    status: "active",
    deadline: "",
    minStake: 0,
  });
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);

  const { followedEvents, followError, toggleFollow } = useTrendingFollowState(
    accountNorm,
    setShowLoginModal,
    tErrors,
    queryClient,
    visibleEvents
  );

  useEffect(() => {
    if (!accountNorm) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(!!profileCtx?.isAdmin);
  }, [accountNorm, profileCtx?.isAdmin]);

  const openEdit = (p: any) => {
    setEditTargetId(Number(p?.id));
    const rawCategory = String(p?.tag || p?.category || "");
    const categoryId = rawCategory ? CATEGORY_MAPPING[rawCategory] || rawCategory : "";
    setEditForm({
      title: String(p?.title || ""),
      category: categoryId,
      status: String(p?.status || "active"),
      deadline: String(p?.deadline || ""),
      minStake: Number(p?.min_stake || 0),
    });
    setEditOpen(true);
  };
  const closeEdit = () => {
    setEditOpen(false);
    setEditTargetId(null);
  };
  const setEditField = (k: string, v: any) => setEditForm((prev: any) => ({ ...prev, [k]: v }));
  const submitEdit = async () => {
    try {
      setSavingEdit(true);
      if (!accountNorm) return;
      try {
        await siweLogin();
      } catch {}
      const id = Number(editTargetId);
      const categoryId = String(editForm.category || "");
      const categoryName = ID_TO_CATEGORY_NAME[categoryId] || categoryId;
      const payload: any = {
        title: editForm.title,
        category: categoryName,
        status: editForm.status,
        deadline: editForm.deadline,
        minStake: Number(editForm.minStake),
        walletAddress: accountNorm,
      };
      const res = await fetch(`/api/predictions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) {
        throw new Error(String(j?.message || tTrendingAdmin("updateFailed")));
      }
      queryClient.setQueryData(["predictions"], (old: any[]) =>
        old?.map((p: any) =>
          p?.id === id
            ? {
                ...p,
                title: payload.title,
                category: payload.category,
                status: payload.status,
                deadline: payload.deadline,
                min_stake: payload.minStake,
              }
            : p
        )
      );
      toast.success(tTrendingAdmin("updateSuccessTitle"), tTrendingAdmin("updateSuccessDesc"));
      setEditOpen(false);
    } catch (e: any) {
      toast.error(
        tTrendingAdmin("updateFailed"),
        String(e?.message || e || tTrendingAdmin("retryLater"))
      );
    } finally {
      setSavingEdit(false);
    }
  };
  const deleteEvent = async (id: number) => {
    try {
      if (!confirm(tTrendingAdmin("confirmDelete"))) return;
      setDeleteBusyId(id);
      if (!accountNorm) return;
      try {
        await siweLogin();
      } catch {}
      const res = await fetch(`/api/predictions/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) {
        throw new Error(String(j?.message || tTrendingAdmin("deleteFailed")));
      }
      queryClient.setQueryData(["predictions"], (old: any[]) =>
        old?.filter((p: any) => p?.id !== id)
      );
      toast.success(tTrendingAdmin("deleteSuccessTitle"), tTrendingAdmin("deleteSuccessDesc"));
    } catch (e: any) {
      toast.error(
        tTrendingAdmin("deleteFailed"),
        String(e?.message || e || tTrendingAdmin("retryLater"))
      );
    } finally {
      setDeleteBusyId(null);
    }
  };

  const categories = useMemo(
    () =>
      TRENDING_CATEGORIES.map((cat) => {
        const id = CATEGORY_MAPPING[cat.name];
        const label = id ? tTrending(`category.${id}`) : cat.name;
        return { ...cat, label };
      }),
    [tTrending]
  );

  const heroSlideEvents = useMemo(() => {
    const pool = displayEvents;
    if (pool.length === 0) return [] as any[];
    const now = Date.now();

    // 组内排序：按热度
    const popularitySorter = (a: any, b: any) => {
      const fa = Number(a?.followers_count || 0);
      const fb = Number(b?.followers_count || 0);
      if (fb !== fa) return fb - fa;
      const da = new Date(String(a?.deadline || 0)).getTime() - now;
      const db = new Date(String(b?.deadline || 0)).getTime() - now;
      const ta = da <= 0 ? Number.POSITIVE_INFINITY : da;
      const tb = db <= 0 ? Number.POSITIVE_INFINITY : db;
      return ta - tb;
    };

    const tags = Array.from(new Set(pool.map((e: any) => String(e.tag || "")).filter(Boolean)));
    const picks = tags
      .map((tag) => {
        const group = pool.filter((e: any) => String(e.tag || "") === tag);
        if (group.length === 0) return null as any;
        return [...group].sort(popularitySorter)[0];
      })
      .filter(Boolean);

    // 最终排序：按分类固定顺序
    return [...picks].sort((a, b) => {
      const tagA = String(a.tag || "");
      const tagB = String(b.tag || "");
      const indexA = categories.findIndex((c) => c.name === tagA);
      const indexB = categories.findIndex((c) => c.name === tagB);

      // 如果都在列表中，按列表顺序
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // 如果只有一个在列表中，在列表中的排前面
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // 都不在列表中，按热度
      return popularitySorter(a, b);
    });
  }, [displayEvents, categories]);

  const activeSlide =
    heroSlideEvents.length > 0 ? heroSlideEvents[currentHeroIndex % heroSlideEvents.length] : null;
  const fallbackIndex = HERO_EVENTS.length > 0 ? currentHeroIndex % HERO_EVENTS.length : 0;
  const rawActiveTitle = activeSlide
    ? String(activeSlide?.title || "")
    : tTrending(`hero.${HERO_EVENTS[fallbackIndex].id}.title`);
  const activeTitle = activeSlide ? tEvents(rawActiveTitle) : rawActiveTitle;
  const activeDescription = activeSlide
    ? String(activeSlide?.description || "")
    : tTrending(`hero.${HERO_EVENTS[fallbackIndex].id}.description`);
  const activeImage = activeSlide
    ? String(activeSlide?.image || "")
    : String(HERO_EVENTS[fallbackIndex]?.image || "");
  const activeCategory = activeSlide
    ? String(activeSlide?.tag || "")
    : String(HERO_EVENTS[fallbackIndex]?.category || "");
  const activeFollowers = activeSlide
    ? Number(activeSlide?.followers_count || 0)
    : Number(HERO_EVENTS[fallbackIndex]?.followers || 0);
  const activeSlideId = activeSlide ? Number(activeSlide.id) : null;

  const heroSlideLength = heroSlideEvents.length || HERO_EVENTS.length;

  const handlePrevHero = useCallback(() => {
    setCurrentHeroIndex((prev) =>
      prev === 0 ? (heroSlideEvents.length || HERO_EVENTS.length) - 1 : prev - 1
    );
  }, [heroSlideEvents]);

  const handleNextHero = useCallback(() => {
    setCurrentHeroIndex((prev) => prev + 1);
  }, []);

  const handleHeroBulletClick = (idx: number) => {
    setCurrentHeroIndex(idx);
  };

  const handleViewAllCategories = () => {
    setFilters((prev) => ({ ...prev, category: "all" }));
    productsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCategoryClick = (categoryName: string) => {
    const idx = heroSlideEvents.findIndex((ev: any) => String(ev?.tag || "") === categoryName);
    if (idx >= 0) {
      setCurrentHeroIndex(idx);
    } else {
      const fallbackIdx = HERO_EVENTS.findIndex((ev) => ev.category === categoryName);
      if (fallbackIdx >= 0) setCurrentHeroIndex(fallbackIdx);
    }
    const categoryId = CATEGORY_MAPPING[categoryName as keyof typeof CATEGORY_MAPPING];
    if (categoryId) {
      setFilters((prev) => ({ ...prev, category: categoryId }));
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-violet-100 via-fuchsia-50 to-rose-100 overflow-x-hidden text-gray-900">
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
        onViewAllCategories={handleViewAllCategories}
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

      {/* 返回顶部按钮 */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={(e) => {
              scrollToTop();
              createSmartClickEffect(e);
            }}
            className="fixed bottom-8 right-8 z-50 w-10 h-10 bg-gradient-to-br from-white/90 to-pink-100/90 rounded-full shadow-lg border border-pink-200/50 backdrop-blur-sm overflow-hidden group"
            whileHover={{
              scale: 1.1,
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15)",
            }}
            whileTap={{ scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 17,
            }}
          >
            {/* 背景质感效果 */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-pink-100/40 group-hover:from-white/60 group-hover:to-pink-100/60 transition-all duration-300"></div>

            {/* 箭头图标 */}
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <div className="animate-bounce">
                <svg
                  className="w-4 h-4 text-gray-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </div>
            </div>

            {/* 悬浮提示 */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              返回顶部
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
