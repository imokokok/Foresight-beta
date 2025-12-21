"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  CheckCircle,
  Wallet,
  Pencil,
  Trash2,
  ArrowRightCircle,
  Sparkles,
  Flame,
  TrendingUp,
  Zap,
  Trophy,
  Activity,
  Users,
  Globe,
  BarChart3,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Target,
  Flag,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { followPrediction, unfollowPrediction } from "@/lib/follows";
import { supabase } from "@/lib/supabase";
import Leaderboard from "@/components/Leaderboard";
import DatePicker from "@/components/ui/DatePicker";
import { toast } from "@/lib/toast";
import { EventCardSkeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/EmptyState";
import FilterSort, { type FilterSortState } from "@/components/FilterSort";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useTranslations } from "@/lib/i18n";

const HERO_EVENTS = [
  {
    id: "globalClimateSummit",
    image:
      "https://images.unsplash.com/photo-1569163139394-de44cb4e4c81?auto=format&fit=crop&w=1000&q=80",
    followers: 12842,
    category: "时政",
  },
  {
    id: "aiSafetySummit",
    image:
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1000&q=80",
    followers: 9340,
    category: "科技",
  },
  {
    id: "globalFinanceForum",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1000&q=80",
    followers: 7561,
    category: "时政",
  },
  {
    id: "charitySportsMatch",
    image:
      "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=80",
    followers: 5043,
    category: "娱乐",
  },
  {
    id: "extremeWeatherAlert",
    image:
      "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1000&q=80",
    followers: 8921,
    category: "天气",
  },
  {
    id: "techProductLaunch",
    image:
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1000&q=80",
    followers: 7654,
    category: "科技",
  },
  {
    id: "worldChampionshipFinal",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1000&q=80",
    followers: 6021,
    category: "体育",
  },
];

const TRENDING_CATEGORIES = [
  { name: "科技", icon: "🚀", color: "from-blue-400 to-cyan-400" },
  { name: "娱乐", icon: "🎬", color: "from-pink-400 to-rose-400" },
  { name: "时政", icon: "🏛️", color: "from-purple-400 to-indigo-400" },
  { name: "天气", icon: "🌤️", color: "from-green-400 to-emerald-400" },
  { name: "体育", icon: "⚽", color: "from-orange-400 to-red-400" },
  { name: "商业", icon: "💼", color: "from-slate-400 to-gray-500" },
  { name: "加密货币", icon: "🪙", color: "from-yellow-400 to-amber-500" },
  { name: "更多", icon: "⋯", color: "from-gray-200 to-gray-300" },
];

const CATEGORY_MAPPING: Record<string, string> = {
  科技: "tech",
  娱乐: "entertainment",
  时政: "politics",
  天气: "weather",
  体育: "sports",
  商业: "business",
  加密货币: "crypto",
  更多: "more",
};

const ID_TO_CATEGORY_NAME: Record<string, string> = {
  tech: "科技",
  entertainment: "娱乐",
  politics: "时政",
  weather: "天气",
  sports: "体育",
  crypto: "加密货币",
  business: "商业",
  more: "更多",
};

const fetchPredictions = async () => {
  const res = await fetch("/api/predictions");
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Failed to fetch");
  return data.data;
};

export default function TrendingPage({ initialPredictions }: { initialPredictions?: any[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWorkerRef = useRef<Worker | null>(null);
  const offscreenActiveRef = useRef<boolean>(false);
  const [canvasReady, setCanvasReady] = useState(false);

  const {
    data: predictions = [],
    isLoading: loading,
    error,
  } = useQuery({
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

  const heroEvents = useMemo(
    () =>
      HERO_EVENTS.map((e) => ({
        ...e,
        title: tTrending(`hero.${e.id}.title`),
        description: tTrending(`hero.${e.id}.description`),
      })),
    [tTrending]
  );
  const categories = useMemo(
    () =>
      TRENDING_CATEGORIES.map((cat) => {
        const id = CATEGORY_MAPPING[cat.name];
        const label = id ? tTrending(`category.${id}`) : cat.name;
        return { ...cat, label };
      }),
    [tTrending]
  );

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [displayCount, setDisplayCount] = useState(12);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const productsSectionRef = useRef<HTMLElement | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // 筛选排序状态（持久化）
  const [filters, setFilters] = usePersistedState<FilterSortState>("trending_filters", {
    category: null,
    sortBy: "trending",
  });

  // 登录提示弹窗状态
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 关注功能状态管理
  const [followedEvents, setFollowedEvents] = useState<Set<number>>(new Set());
  const { account, siweLogin } = useWallet();
  const profileCtx = useUserProfileOptional();
  const accountNorm = account?.toLowerCase();
  const [followError, setFollowError] = useState<string | null>(null);
  // Realtime 订阅状态与过滤信息（用于可视化诊断）
  // 未结算视图模式

  // 返回顶部功能状态
  const [showBackToTop, setShowBackToTop] = useState(false);
  const isScrollingRef = useRef(false);
  const scrollStopTimerRef = useRef<number | null>(null);

  // 滚动监听 - 显示/隐藏返回顶部按钮
  useEffect(() => {
    let rafId = 0;
    const update = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setShowBackToTop(scrollTop > 300);
      rafId = 0;
    };

    const handleScroll = () => {
      // 标记滚动中，供画布动画降级用
      isScrollingRef.current = true;
      if (scrollStopTimerRef.current) {
        clearTimeout(scrollStopTimerRef.current);
      }
      scrollStopTimerRef.current = window.setTimeout(() => {
        isScrollingRef.current = false;
        // 通知 Worker 滚动结束
        canvasWorkerRef.current?.postMessage({
          type: "scrolling",
          isScrolling: false,
        });
      }, 120);

      // 通知 Worker 正在滚动
      canvasWorkerRef.current?.postMessage({
        type: "scrolling",
        isScrolling: true,
      });
      // 将读写合并到下一帧，降低reflow频率
      if (!rafId) {
        rafId = requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    update(); // 初始化检查

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    };
  }, []);

  // 返回顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // 获取分类热点数量
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

  // 关注/取消关注事件（持久化到后端）
  const toggleFollow = async (eventIndex: number, event: React.MouseEvent) => {
    if (!accountNorm) {
      // 如果用户未连接钱包，显示登录提示弹窗
      setShowLoginModal(true);
      return;
    }

    const predictionId = sortedEvents[eventIndex]?.id;
    if (!predictionId) return;

    const wasFollowing = followedEvents.has(Number(predictionId));

    createSmartClickEffect(event);
    createHeartParticles(event.currentTarget as HTMLElement, wasFollowing);

    // 乐观更新本地状态（按事件ID而非索引）
    setFollowedEvents((prev) => {
      const next = new Set(prev);
      const pid = Number(predictionId);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });

    // 乐观更新关注数量
    /*
    setPredictions((prev) => {
      const next = [...prev];
      const idx = next.findIndex((p) => Number(p?.id) === Number(predictionId));
      if (idx >= 0) {
        const currentCount = Number(next[idx]?.followers_count || 0);
        next[idx] = {
          ...next[idx],
          followers_count: wasFollowing
            ? Math.max(0, currentCount - 1)
            : currentCount + 1,
        };
      }
      return next;
    });
    */

    try {
      if (wasFollowing) {
        await unfollowPrediction(Number(predictionId), accountNorm);
      } else {
        await followPrediction(Number(predictionId), accountNorm);
      }
    } catch (err) {
      console.error("关注/取消关注失败:", err);
      setFollowError(
        (err as any)?.message ? String((err as any).message) : tErrors("followActionFailed")
      );
      setTimeout(() => setFollowError(null), 3000);
      // 回滚本地状态（按事件ID回滚）
      setFollowedEvents((prev) => {
        const rollback = new Set(prev);
        const pid = Number(predictionId);
        if (wasFollowing) {
          rollback.add(pid);
        } else {
          rollback.delete(pid);
        }
        return rollback;
      });

      // 回滚关注数量
      /*
      setPredictions((prev) => {
        const next = [...prev];
        const idx = next.findIndex(
          (p) => Number(p?.id) === Number(predictionId)
        );
        if (idx >= 0) {
          const currentCount = Number(next[idx]?.followers_count || 0);
          next[idx] = {
            ...next[idx],
            followers_count: wasFollowing
              ? currentCount + 1
              : Math.max(0, currentCount - 1),
          };
        }
        return next;
      });
      */
    }
  };

  const createSmartClickEffect = (event: React.MouseEvent) => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const buttonSize = Math.max(rect.width, rect.height);
    const glowColor = "rgba(139, 92, 246, 0.15)";
    const baseColor = "#8B5CF6";

    const sizeMultiplier = Math.max(0.8, Math.min(2.0, buttonSize / 50));
    const rippleSize = Math.max(rect.width, rect.height) * (1.5 + sizeMultiplier * 0.3);
    const glowSize = 1.5 + sizeMultiplier * 0.5;

    const glow = document.createElement("div");
    glow.style.position = "fixed";
    glow.style.top = "0";
    glow.style.left = "0";
    glow.style.width = "100%";
    glow.style.height = "100%";
    glow.style.background = `radial-gradient(circle at ${event.clientX}px ${
      event.clientY
    }px, ${glowColor} 0%, ${glowColor.replace(
      "0.15",
      "0.1"
    )} 25%, ${glowColor.replace("0.15", "0.05")} 40%, transparent 70%)`;
    glow.style.pointerEvents = "none";
    glow.style.zIndex = "9999";
    glow.style.opacity = "0";
    document.body.appendChild(glow);
    glow.animate(
      [
        { opacity: 0, transform: "scale(0.8)" },
        { opacity: 0.6, transform: `scale(${glowSize})` },
        { opacity: 0, transform: `scale(${glowSize * 1.2})` },
      ],
      { duration: 600, easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }
    );
    setTimeout(() => glow.remove(), 600);

    const buttonRect = button.getBoundingClientRect();
    const clickX = event.clientX - buttonRect.left;
    const clickY = event.clientY - buttonRect.top;

    const ripple = document.createElement("span");
    ripple.className = "absolute rounded-full pointer-events-none";
    ripple.style.width = ripple.style.height = rippleSize + "px";
    ripple.style.left = clickX - rippleSize / 2 + "px";
    ripple.style.top = clickY - rippleSize / 2 + "px";
    ripple.style.background = `radial-gradient(circle, rgba(255,255,255,0.8) 0%, ${baseColor}40 40%, ${baseColor}20 70%, transparent 95%)`;
    ripple.style.boxShadow = `0 0 20px ${baseColor}30`;
    ripple.style.transform = "scale(0)";

    const originalPosition = button.style.position;
    if (getComputedStyle(button).position === "static") {
      button.style.position = "relative";
    }
    button.appendChild(ripple);

    const rippleDuration = Math.max(400, Math.min(800, 500 + sizeMultiplier * 100));
    ripple.animate(
      [
        { transform: "scale(0)", opacity: 0.8 },
        { transform: "scale(1)", opacity: 0.4 },
        { transform: "scale(1.5)", opacity: 0 },
      ],
      { duration: rippleDuration, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    );

    setTimeout(() => {
      ripple.remove();
      button.style.position = originalPosition;
    }, rippleDuration);

    let scaleAmount = Math.max(0.85, Math.min(0.98, 0.95 - sizeMultiplier * 0.03));
    const bounceAmount = 1.05;
    button.style.transition = "transform 150ms ease-out";
    button.style.transform = `scale(${scaleAmount})`;
    setTimeout(() => {
      button.style.transform = `scale(${bounceAmount})`;
      setTimeout(() => {
        button.style.transform = "scale(1)";
        setTimeout(() => {
          button.style.transition = "";
        }, 150);
      }, 75);
    }, 75);
  };

  // 创建爱心粒子效果
  const createHeartParticles = (button: HTMLElement, isUnfollowing: boolean) => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // 创建粒子容器
    const particlesContainer = document.createElement("div");
    particlesContainer.className = "fixed pointer-events-none z-50";
    particlesContainer.style.left = "0";
    particlesContainer.style.top = "0";
    particlesContainer.style.width = "100vw";
    particlesContainer.style.height = "100vh";

    document.body.appendChild(particlesContainer);

    // 创建多个粒子
    const particleCount = isUnfollowing ? 8 : 12;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "absolute w-2 h-2 rounded-full";
      particle.style.background = isUnfollowing ? "#9ca3af" : "#ef4444";
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      particle.style.transform = "translate(-50%, -50%)";

      particlesContainer.appendChild(particle);
      particles.push(particle);
    }

    // 粒子动画
    particles.forEach((particle, index) => {
      const angle = (index / particleCount) * Math.PI * 2;
      const distance = isUnfollowing ? 40 : 80;
      const duration = isUnfollowing ? 600 : 800;

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = centerY + Math.sin(angle) * distance;

      particle.animate(
        [
          {
            transform: "translate(-50%, -50%) scale(1)",
            opacity: 1,
          },
          {
            transform: `translate(${targetX - centerX}px, ${targetY - centerY}px) scale(0.5)`,
            opacity: 0,
          },
        ],
        {
          duration: duration,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
        }
      );
    });

    // 清理粒子容器
    setTimeout(() => {
      particlesContainer.remove();
    }, 1000);
  };

  // 卡片点击：在鼠标点击位置生成对应分类颜色的粒子（比分类按钮略大）
  const createCategoryParticlesAtCardClick = (event: React.MouseEvent, category?: string) => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const x = event.clientX;
    const y = event.clientY;

    // 映射分类到颜色
    const color =
      category === "科技"
        ? "#3B82F6"
        : category === "娱乐"
          ? "#EC4899"
          : category === "时政"
            ? "#8B5CF6"
            : category === "天气"
              ? "#10B981"
              : "#8B5CF6";

    // 粒子容器
    const particlesContainer = document.createElement("div");
    particlesContainer.className = "fixed pointer-events-none z-[9999]";
    particlesContainer.style.left = "0";
    particlesContainer.style.top = "0";
    particlesContainer.style.width = "100vw";
    particlesContainer.style.height = "100vh";
    document.body.appendChild(particlesContainer);

    // 比分类按钮略大的爱心粒子
    const particleCount = 12; // 稍多于分类按钮的 8 个
    const particles: HTMLDivElement[] = [];
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "absolute w-4 h-4"; // 比分类按钮 w-3 h-3 略大
      particle.style.background = color;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.transform = "translate(-50%, -50%)";
      particle.style.clipPath =
        "polygon(50% 15%, 61% 0, 75% 0, 85% 15%, 100% 35%, 100% 50%, 85% 65%, 75% 100%, 50% 85%, 25% 100%, 15% 65%, 0 50%, 0 35%, 15% 15%, 25% 0, 39% 0)";
      particlesContainer.appendChild(particle);
      particles.push(particle);
    }

    // 动画：更大的扩散半径与更快收敛，减少重绘时间
    particles.forEach((particle, index) => {
      const angle = (index / particleCount) * Math.PI * 2 + Math.random() * 0.3;
      const distance = 80 + Math.random() * 60; // 比分类按钮更远
      const duration = 700 + Math.random() * 300; // 稍快一些

      const targetX = x + Math.cos(angle) * distance;
      const targetY = y - Math.abs(Math.sin(angle)) * distance * 1.4;

      particle.animate(
        [
          {
            transform: "translate(-50%, -50%) scale(1) rotate(0deg)",
            opacity: 1,
          },
          {
            transform: `translate(${targetX - x}px, ${
              targetY - y
            }px) scale(0.35) rotate(${Math.random() * 360}deg)`,
            opacity: 0,
          },
        ],
        { duration, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
      );
    });

    setTimeout(() => {
      particlesContainer.remove();
    }, 1200);
  };

  // 自动轮播效果
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroIndex((prevIndex) => prevIndex + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 输入关键字时，自动定位到匹配的热点事件（使用防抖）

  // 无限滚动功能（使用 useInfiniteScroll Hook）
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMore = displayCount < totalEventsCount;

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    // 模拟加载延迟，实际项目中这里可能是 API 调用
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl: HTMLCanvasElement = canvas;
    const supportsOffscreen =
      typeof (canvasEl as any).transferControlToOffscreen === "function" &&
      typeof Worker !== "undefined";
    if (supportsOffscreen) {
      // OffscreenCanvas + Worker 路线（长期最佳）
      let worker: Worker | null = null;
      try {
        worker = new Worker(new URL("../../workers/particles.worker.ts", import.meta.url), {
          type: "module",
        });
      } catch (err) {
        console.warn("Worker 初始化失败，回退到主线程绘制:", err);
      }
      if (worker) {
        canvasWorkerRef.current = worker;
        // 监听 Worker 首帧就绪，触发画布淡入
        try {
          worker.addEventListener("message", (ev: MessageEvent<any>) => {
            const data = (ev as any)?.data;
            if (data && data.type === "ready") {
              setCanvasReady(true);
            }
          });
        } catch {}
        let offscreen: OffscreenCanvas | null = null;
        try {
          offscreen = (canvasEl as any).transferControlToOffscreen();
        } catch (err) {
          console.warn("transferControlToOffscreen 失败，回退到主线程绘制:", err);
        }
        if (offscreen) {
          const init = () => {
            const dpr = window.devicePixelRatio || 1;
            worker!.postMessage(
              {
                type: "init",
                canvas: offscreen!,
                width: window.innerWidth,
                height: window.innerHeight,
                dpr,
              },
              [offscreen!]
            );
          };
          init();
          const onResize = () => {
            const dpr = window.devicePixelRatio || 1;
            worker!.postMessage({
              type: "resize",
              width: window.innerWidth,
              height: window.innerHeight,
              dpr,
            });
          };
          let rafPending = false;
          const onMouseMove = (e: MouseEvent) => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
              const rect = canvasEl.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              worker!.postMessage({ type: "mouse", x, y, active: true });
              rafPending = false;
            });
          };
          const onMouseLeave = () => {
            worker!.postMessage({ type: "mouse", x: 0, y: 0, active: false });
          };
          window.addEventListener("resize", onResize);
          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseleave", onMouseLeave);
          // 初始滚动状态同步
          worker!.postMessage({ type: "scrolling", isScrolling: false });
          // 标记 Offscreen 已接管，避免 fallback 再次取主线程上下文
          offscreenActiveRef.current = true;
          return () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseleave", onMouseLeave);
            try {
              worker!.postMessage({ type: "destroy" });
            } catch {}
            worker!.terminate();
            canvasWorkerRef.current = null;
            offscreenActiveRef.current = false;
          };
        }
      }
      // 如果创建失败或不可转移，继续走主线程绘制
    }
    // 如果 Offscreen 已接管（例如 Fast Refresh 未及时清理），跳过主线程绘制
    if (offscreenActiveRef.current) return;
    // Fallback：主线程绘制（原有实现）
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvasEl.getContext("2d");
    } catch (err) {
      console.warn("主线程 fallback 获取 2D 上下文失败（可能已 Offscreen 接管）:", err);
      return;
    }
    if (!context) return;
    const ctx = context;
    let animId = 0;

    type Shape =
      | "circle"
      | "square"
      | "triangle"
      | "diamond"
      | "ring"
      | "pentagon"
      | "hexagon"
      | "octagon";
    const COLORS = [
      "rgba(255, 140, 180, 0.48)", // rose pink
      "rgba(179, 136, 255, 0.45)", // lilac purple
      "rgba(100, 200, 255, 0.42)", // sky blue
      "rgba(120, 230, 190, 0.44)", // mint green
      "rgba(255, 190, 120, 0.40)", // peach orange
    ];

    const LINK_DISTANCE = 90; // 连线最大距离
    const CELL_SIZE = 24; // 空间哈希网格大小

    class Particle {
      x: number;
      y: number;
      baseSize: number;
      size: number; // 动态尺寸（脉动）
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      shape: Shape;
      color: string;
      radius: number; // 碰撞半径（按外接圆估算）
      pulsePhase: number; // 脉动相位
      constructor() {
        this.x = Math.random() * canvasEl.width;
        this.y = Math.random() * canvasEl.height;
        // 更大的基础尺寸（尽量一致）：约 6 - 6.8
        this.baseSize = 6 + Math.random() * 0.8;
        this.size = this.baseSize;
        // 轻微移动，避免过快
        this.speedX = Math.random() * 0.6 - 0.3;
        this.speedY = Math.random() * 0.6 - 0.3;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = Math.random() * 0.01 - 0.005;
        // 减少三角形频率，增加对称多边形（五/六/八边形）
        const shapesPool: Shape[] = [
          "circle",
          "square",
          "diamond",
          "ring",
          "pentagon",
          "hexagon",
          "octagon",
          "circle",
          "square",
          "diamond",
          "ring",
          "pentagon",
          "hexagon",
          "circle",
          "square",
          "diamond",
          "triangle",
        ];
        this.shape = shapesPool[Math.floor(Math.random() * shapesPool.length)];
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.pulsePhase = Math.random() * Math.PI * 2;
        // 估算不同形状的外接圆半径，作为碰撞半径
        switch (this.shape) {
          case "circle":
            this.radius = this.baseSize;
            break;
          case "square": {
            // s = baseSize * 1.6，半径约 s * sqrt(2)/2
            const s = this.baseSize * 1.6;
            this.radius = (s * Math.SQRT2) / 2;
            break;
          }
          case "triangle": {
            // s = baseSize * 2，半径近似 s/2
            const s = this.baseSize * 2;
            this.radius = s / 2;
            break;
          }
          case "diamond": {
            // s = baseSize * 2，半径近似 s/2
            const s = this.baseSize * 2;
            this.radius = s / 2;
            break;
          }
          case "ring":
            this.radius = this.baseSize * 1.4;
            break;
          case "pentagon":
          case "hexagon":
          case "octagon":
            this.radius = this.baseSize * 1.8;
            break;
        }
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        // 轻微脉动但保持一致性（±3%）
        this.size = this.baseSize * (1 + 0.03 * Math.sin(this.pulsePhase));
        this.pulsePhase += 0.015;
        if (this.x < 0 || this.x > canvasEl.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvasEl.height) this.speedY *= -1;
      }
      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8; // 略强光晕效果
        switch (this.shape) {
          case "circle": {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case "square": {
            const s = this.size * 1.6;
            ctx.fillRect(-s / 2, -s / 2, s, s);
            break;
          }
          case "triangle": {
            const s = this.size * 2;
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, s / 2);
            ctx.lineTo(-s / 2, s / 2);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case "diamond": {
            const s = this.size * 2;
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, 0);
            ctx.lineTo(0, s / 2);
            ctx.lineTo(-s / 2, 0);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case "ring": {
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 1.4, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case "pentagon": {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 5; k++) {
              const ang = (Math.PI * 2 * k) / 5 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
          case "hexagon": {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const ang = (Math.PI * 2 * k) / 6 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
          case "octagon": {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 8; k++) {
              const ang = (Math.PI * 2 * k) / 8 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
        }
        ctx.restore();
      }
    }

    let particles: Particle[] = [];

    const resize = () => {
      canvasEl.width = window.innerWidth;
      canvasEl.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    // 粒子数量更少：基础数量 60（按窗口大小可扩展）
    const baseCount = 60;
    const scaleFactor = Math.min(2, (canvasEl.width * canvasEl.height) / (1280 * 720));
    const particleCount = Math.floor(baseCount * scaleFactor);
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // 鼠标交互：靠近时粒子加速散开（与首页一致）
    let mouseX = 0,
      mouseY = 0,
      mouseActive = false;
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      mouseActive = true;
    };
    const onMouseLeave = () => {
      mouseActive = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    let firstFrameDone = false;
    const animate = () => {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      // 更新位置与尺寸
      particles.forEach((p) => p.update());

      // 鼠标靠近加速散开（径向推力，与首页一致）
      if (mouseActive) {
        const influenceR = 150; // 影响半径
        const forceBase = 0.12; // 基础加速度
        const maxSpeed = 1.4; // 限制最大速度，避免失控
        for (const p of particles) {
          const dx = p.x - mouseX;
          const dy = p.y - mouseY;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && dist < influenceR) {
            const strength = 1 - dist / influenceR;
            const accel = forceBase * strength;
            const nx = dx / dist;
            const ny = dy / dist;
            p.speedX += nx * accel;
            p.speedY += ny * accel;
            // 速度限制
            const v = Math.hypot(p.speedX, p.speedY);
            if (v > maxSpeed) {
              p.speedX = (p.speedX / v) * maxSpeed;
              p.speedY = (p.speedY / v) * maxSpeed;
            }
          }
        }
      }

      // 在滚动过程中跳过重型邻接计算，减轻主线程压力
      if (!isScrollingRef.current) {
        // 构建空间哈希网格
        const grid = new Map<string, number[]>();
        const keyOf = (x: number, y: number) =>
          `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
        particles.forEach((p, i) => {
          const key = keyOf(p.x, p.y);
          const cell = grid.get(key);
          if (cell) cell.push(i);
          else grid.set(key, [i]);
        });

        // 计算碰撞与连线（仅检查邻近单元格）
        const neighborsOffsets = [-1, 0, 1];
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const cx = Math.floor(p.x / CELL_SIZE);
          const cy = Math.floor(p.y / CELL_SIZE);
          for (const ox of neighborsOffsets) {
            for (const oy of neighborsOffsets) {
              const key = `${cx + ox},${cy + oy}`;
              const bucket = grid.get(key);
              if (!bucket) continue;
              for (const j of bucket) {
                if (j <= i) continue;
                const q = particles[j];
                const dx = q.x - p.x;
                const dy = q.y - p.y;
                const dist = Math.hypot(dx, dy);
                // 连线效果
                if (dist < LINK_DISTANCE) {
                  const alpha = Math.max(0.05, ((LINK_DISTANCE - dist) / LINK_DISTANCE) * 0.4);
                  ctx.save();
                  ctx.globalAlpha = alpha;
                  ctx.strokeStyle = "#c4b5fd"; // 薰衣草紫的连线
                  ctx.lineWidth = 0.7;
                  ctx.beginPath();
                  ctx.moveTo(p.x, p.y);
                  ctx.lineTo(q.x, q.y);
                  ctx.stroke();
                  ctx.restore();
                }
                // 碰撞处理：外接圆近似
                const rSum = p.radius + q.radius;
                if (dist > 0 && dist < rSum) {
                  const overlap = rSum - dist;
                  const nx = dx / dist;
                  const ny = dy / dist;
                  const sep = overlap * 0.5;
                  p.x -= nx * sep;
                  p.y -= ny * sep;
                  q.x += nx * sep;
                  q.y += ny * sep;

                  const pNorm = p.speedX * nx + p.speedY * ny;
                  const qNorm = q.speedX * nx + q.speedY * ny;
                  const diff = qNorm - pNorm;
                  p.speedX += diff * nx;
                  p.speedY += diff * ny;
                  q.speedX -= diff * nx;
                  q.speedY -= diff * ny;

                  p.speedX *= 0.98;
                  p.speedY *= 0.98;
                  q.speedX *= 0.98;
                  q.speedY *= 0.98;
                }
              }
            }
          }
        }
      }

      // 绘制所有粒子
      particles.forEach((p) => p.draw());
      // 首帧完成后触发淡入
      if (!firstFrameDone) {
        firstFrameDone = true;
        try {
          setCanvasReady(true);
        } catch {}
      }

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      if (animId) cancelAnimationFrame(animId);
    };
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

  // 同步服务器关注状态到本地心形按钮（保存为事件ID集合）
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

  // 将预测事件转换为页面显示格式（包含事件ID以便关注映射）
  const allEvents = useMemo(
    () =>
      predictions.map((prediction: any) => ({
        id: prediction.id,
        title: prediction.title,
        description: prediction.description,
        insured: `${prediction.min_stake} USDC`,
        minInvestment: `${prediction.min_stake} USDC`,
        tag: prediction.category,
        category: prediction.category,
        image:
          prediction.image_url ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
            prediction.title
          )}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`,
        deadline: prediction.deadline,
        status: prediction.status,
        criteria: prediction.criteria,
        followers_count: Number(prediction?.followers_count || 0),
        type: prediction.type || "binary",
        outcomes: Array.isArray(prediction?.outcomes) ? prediction.outcomes : [],
      })),
    [predictions]
  );

  // 当分类计数接口不可用时，基于已加载的预测数据进行本地回退计算
  // 本地回退逻辑已移除，分类计数仅依赖后端 /api/categories/counts

  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  const sortedEvents = useMemo(() => {
    const now = Date.now();
    let events = [...displayEvents];

    // 1. 筛选分类
    if (filters.category && filters.category !== "all") {
      events = events.filter((e: any) => {
        const eventCategory = String(e?.category || e?.tag || "").toLowerCase();
        const filterId = filters.category?.toLowerCase() || "";

        // 尝试匹配英文ID
        if (eventCategory === filterId) return true;

        // 尝试匹配中文名
        const categoryName = ID_TO_CATEGORY_NAME[filterId];
        if (categoryName && eventCategory.includes(categoryName.toLowerCase())) return true;

        return false;
      });
    }

    // 2. 排序
    events.sort((a: any, b: any) => {
      if (filters.sortBy === "trending") {
        // 热门优先：关注数 > 成交额 > 截止时间
        const fa = Number(a?.followers_count || 0);
        const fb = Number(b?.followers_count || 0);
        if (fb !== fa) return fb - fa;

        const taTotal = Number(a?.stats?.totalAmount || 0);
        const tbTotal = Number(b?.stats?.totalAmount || 0);
        if (tbTotal !== taTotal) return tbTotal - taTotal;

        const da = new Date(String(a?.deadline || 0)).getTime() - now;
        const db = new Date(String(b?.deadline || 0)).getTime() - now;
        const ta = da <= 0 ? Number.POSITIVE_INFINITY : da;
        const tb = db <= 0 ? Number.POSITIVE_INFINITY : db;
        if (Math.abs(ta - tb) > 1000) return ta - tb;
      } else if (filters.sortBy === "newest") {
        // 最新发布：创建时间倒序
        const ta = new Date(String(a?.created_at || 0)).getTime();
        const tb = new Date(String(b?.created_at || 0)).getTime();
        if (tb !== ta) return tb - ta;
      } else if (filters.sortBy === "ending") {
        // 即将截止：截止时间正序（最早截止的在前）
        const da = new Date(String(a?.deadline || 0)).getTime();
        const db = new Date(String(b?.deadline || 0)).getTime();
        if (da !== db) return da - db;
      } else if (filters.sortBy === "popular") {
        // 最多关注：关注数倒序
        const fa = Number(a?.followers_count || 0);
        const fb = Number(b?.followers_count || 0);
        if (fb !== fa) return fb - fa;
      }

      // 默认按 ID 倒序
      return Number(b.id) - Number(a.id);
    });

    return events;
  }, [displayEvents, filters]);

  const bestEvent = useMemo(() => {
    if (sortedEvents.length > 0) return sortedEvents[0];
    return null;
  }, [sortedEvents]);

  useEffect(() => {
    if (!accountNorm) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(!!profileCtx?.isAdmin);
  }, [accountNorm, profileCtx?.isAdmin]);

  const openEdit = (p: any) => {
    setEditTargetId(Number(p?.id));
    setEditForm({
      title: String(p?.title || ""),
      category: String(p?.tag || p?.category || ""),
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
      const payload: any = {
        title: editForm.title,
        category: editForm.category,
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
  const fallbackIndex = heroEvents.length > 0 ? currentHeroIndex % heroEvents.length : 0;
  const rawActiveTitle = activeSlide
    ? String(activeSlide?.title || "")
    : String(heroEvents[fallbackIndex]?.title || "");
  const activeTitle = activeSlide ? tEvents(rawActiveTitle) : rawActiveTitle;
  const activeDescription = activeSlide
    ? String(activeSlide?.description || "")
    : String(heroEvents[fallbackIndex]?.description || "");
  const activeImage = activeSlide
    ? String(activeSlide?.image || "")
    : String(heroEvents[fallbackIndex]?.image || "");
  const activeCategory = activeSlide
    ? String(activeSlide?.tag || "")
    : String(heroEvents[fallbackIndex]?.category || "");
  const activeFollowers = activeSlide
    ? Number(activeSlide?.followers_count || 0)
    : Number(heroEvents[fallbackIndex]?.followers || 0);

  // 展示模式：分页 或 滚动相关的重置逻辑

  useEffect(() => {
    let windowIds: number[] = [];
    windowIds = sortedEvents
      .slice(0, Math.max(0, displayCount))
      .map((e) => Number(e?.id))
      .filter(Number.isFinite) as number[];
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

    // 清理函数
    return () => {
      isSubscribed = false;

      if (channel) {
        try {
          // 先取消订阅
          channel.unsubscribe();
          // 再移除频道
          (supabase as any).removeChannel(channel);
          channel = null;
        } catch (error) {
          console.error("Failed to cleanup WebSocket channel:", error);
        }
      }
    };
  }, [sortedEvents, displayCount, accountNorm, queryClient]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-violet-100 via-fuchsia-50 to-rose-100 overflow-hidden text-gray-900">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-500 ease-out ${
          canvasReady ? "opacity-40" : "opacity-0"
        }`}
      />
      {/* 现代清新科技风 Hero 区域 - Light & Airy Tech Style */}
      <section className="relative w-full pt-4 pb-8 lg:pt-8 lg:pb-12 flex flex-col justify-center overflow-hidden">
        {/* 背景装饰：柔和的渐变与光晕 */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br from-purple-200/40 to-blue-200/40 rounded-full blur-[120px] mix-blend-multiply opacity-70" />
          <div className="absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] bg-gradient-to-tr from-pink-200/40 to-orange-100/40 rounded-full blur-[100px] mix-blend-multiply opacity-70" />
        </div>

        <div className="max-w-[1440px] mx-auto px-4 md:px-8 lg:px-12 w-full relative z-10">
          {/* 顶部导航与 Ticker */}
          <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mb-2 lg:mb-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 w-full xl:w-auto">
              {/* 市场数据 - 静态展示 */}
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

              {/* 功能入口 - 强引流区域 */}
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

            {/* 搜索框 - 悬浮胶囊样式 */}
            <div className="relative group w-full md:w-auto flex justify-center md:justify-end">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder={tTrending("search.placeholder")}
                className="w-full md:w-64 pl-10 pr-4 py-2 bg-white/80 backdrop-blur-xl border border-white/60 rounded-full text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all hover:shadow-md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            {/* 左侧：内容排版 (Typography & Content) */}
            <div className="flex-1 w-full lg:w-1/2 space-y-8 min-h-[420px] flex flex-col justify-center">
              <motion.div
                key={`text-${activeSlide?.id || currentHeroIndex}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                {/* 标签 */}
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    {tTrending("badges.dailyPick")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider shadow-sm">
                    {activeCategory || tTrending("badges.trending")}
                  </span>
                </div>

                {/* 标题 */}
                <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight line-clamp-2 h-[2.2em]">
                  {activeTitle}
                </h1>

                {/* 描述 */}
                <p className="text-lg text-gray-600 leading-relaxed max-w-xl line-clamp-2 h-[3.5em]">
                  {activeDescription}
                </p>

                {/* 数据指标 */}
                <div className="flex items-center gap-8 py-4 border-t border-b border-gray-200/60">
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                      {tTrending("metrics.poolSize")}
                    </div>
                    <div className="text-2xl font-black text-gray-900 font-mono tracking-tight">
                      ${(activeFollowers * 12.5).toLocaleString()}
                    </div>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                      {tTrending("metrics.participants")}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white"
                          />
                        ))}
                      </div>
                      <span className="text-lg font-black text-gray-900 font-mono">
                        +{activeFollowers.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 按钮组 */}
                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={() => activeSlide?.id && router.push(`/prediction/${activeSlide.id}`)}
                    className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-gray-900/20 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 group"
                  >
                    {tTrending("actions.placePrediction")}
                    <ArrowRightCircle className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button className="px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-sm shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all">
                    {tTrending("actions.viewDetails")}
                  </button>
                </div>
              </motion.div>
            </div>

            {/* 右侧：视觉焦点 (Visual Focus - 3D Card Stack) */}
            <div className="w-full lg:w-1/2 relative h-[400px] md:h-[500px] flex items-center justify-center lg:justify-end">
              {/* 装饰背景元素 */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-gradient-to-tr from-purple-100 to-blue-50 rounded-[3rem] rotate-6 opacity-60 pointer-events-none" />

              <motion.div
                key={`img-${activeSlide?.id || currentHeroIndex}`}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-lg aspect-[4/3] rounded-[2rem] shadow-2xl shadow-purple-900/10 bg-white p-3 cursor-pointer group"
                onClick={() => activeSlide?.id && router.push(`/prediction/${activeSlide.id}`)}
                whileHover={{ y: -5, rotate: -1 }}
              >
                <div className="relative w-full h-full rounded-[1.5rem] overflow-hidden">
                  <img
                    src={activeImage}
                    alt={activeTitle}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* 图片内渐变遮罩 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />

                  {/* 切换箭头 - 移至卡片内部右下角 */}
                  <div
                    className="absolute bottom-6 right-6 flex gap-3 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentHeroIndex((prev) =>
                          prev === 0 ? (heroSlideEvents.length || heroEvents.length) - 1 : prev - 1
                        );
                      }}
                      className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white hover:text-purple-600 transition-all hover:-translate-y-1 active:translate-y-0"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentHeroIndex((prev) => prev + 1);
                      }}
                      className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white hover:text-purple-600 transition-all hover:-translate-y-1 active:translate-y-0"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 悬浮的数据卡片装饰 */}
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
                    <div className="text-xs text-gray-500 font-bold">
                      {tTrending("metrics.successRate")}
                    </div>
                    <div className="text-lg font-black text-gray-900">84.5%</div>
                  </div>
                </motion.div>
              </motion.div>

              {/* 轮播控制条 - 垂直排列在右侧 */}
              <div className="absolute right-[-20px] lg:right-[-40px] top-1/2 -translate-y-1/2 flex flex-col gap-3">
                {heroEvents.slice(0, 5).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentHeroIndex(idx)}
                    className={`w-1.5 rounded-full transition-all duration-300 ${
                      currentHeroIndex === idx
                        ? "h-8 bg-purple-600"
                        : "h-2 bg-gray-300 hover:bg-purple-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 分类导航 - 悬浮胶囊栏 */}
          <div className="mt-2">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                {tTrending("sections.popularCategories")}
              </h3>
              <button
                onClick={() => {
                  setFilters((prev) => ({ ...prev, category: "all" }));
                  productsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-sm font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                {tTrending("actions.viewAll")} <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {categories.map((category) => {
                const isActive = String(activeCategory || "") === category.name;
                return (
                  <button
                    key={category.name}
                    onClick={() => {
                      const idx = heroSlideEvents.findIndex(
                        (ev: any) => String(ev?.tag || "") === category.name
                      );
                      if (idx >= 0) setCurrentHeroIndex(idx);
                      else {
                        const fallbackIdx = heroEvents.findIndex(
                          (ev) => ev.category === category.name
                        );
                        if (fallbackIdx >= 0) setCurrentHeroIndex(fallbackIdx);
                      }
                      const categoryId = CATEGORY_MAPPING[category.name];
                      if (categoryId) {
                        setFilters((prev) => ({ ...prev, category: categoryId }));
                        // 移除自动滚动，避免打断用户在 Hero 区域的浏览体验
                        // productsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={`
                        group flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 shrink-0
                        ${
                          isActive
                            ? "bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-900/20 transform -translate-y-1"
                            : "bg-white text-gray-600 border-gray-200 hover:border-purple-200 hover:shadow-md hover:-translate-y-0.5"
                        }
                      `}
                  >
                    <span
                      className={`text-xl ${isActive ? "grayscale-0" : "grayscale group-hover:grayscale-0 transition-all"}`}
                    >
                      {category.icon}
                    </span>
                    <div className="text-left">
                      <div
                        className={`text-sm font-bold ${isActive ? "text-white" : "text-gray-900"}`}
                      >
                        {category.label}
                      </div>
                      <div
                        className={`text-[10px] font-medium ${isActive ? "text-gray-400" : "text-gray-400"}`}
                      >
                        {categoryCounts[category.name] || 0} {tTrending("metrics.events")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        ref={productsSectionRef}
        className="relative z-10 px-10 py-12 bg-white/40 backdrop-blur-xl rounded-t-[3rem] border-t border-white/50"
      >
        <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center flex items-center justify-center gap-3">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          {tTrending("sections.hotEvents")}
          <span className="w-2 h-2 rounded-full bg-purple-500" />
        </h3>

        {/* 筛选排序 */}
        {!loading && !error && (
          <div className="mb-8">
            <FilterSort onFilterChange={setFilters} initialFilters={filters} />
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-gray-600">{tTrending("state.loading")}</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-500 text-lg mb-2">{tTrending("state.errorTitle")}</div>
            <p className="text-gray-600">{(error as any)?.message || String(error)}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
            >
              {tTrending("state.reload")}
            </button>
          </div>
        )}

        {/* 数据展示 */}
        {!loading && !error && (
          <>
            {followError && (
              <div className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded">{followError}</div>
            )}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <EventCardSkeleton key={i} />
                ))}
              </div>
            ) : sortedEvents.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title={tTrending("empty.title")}
                description={tTrending("empty.description")}
                action={{
                  label: tTrending("actions.createPrediction"),
                  onClick: () => router.push("/prediction/new"),
                }}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {sortedEvents.slice(0, displayCount).map((product, i) => {
                    const globalIndex = i;
                    return (
                      <motion.div
                        key={sortedEvents[globalIndex]?.id || globalIndex}
                        className="glass-card glass-card-hover rounded-2xl overflow-hidden relative transform-gpu flex flex-col h-full min-h-[250px] group"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={(e) => {
                          createCategoryParticlesAtCardClick(e, product.tag);
                        }}
                      >
                        {/* 关注按钮 */}
                        {Number.isFinite(Number(sortedEvents[globalIndex]?.id)) && (
                          <motion.button
                            data-event-index={globalIndex}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFollow(globalIndex, e);
                            }}
                            className="absolute top-3 left-3 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md overflow-hidden"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            animate={
                              followedEvents.has(Number(sortedEvents[globalIndex]?.id))
                                ? "liked"
                                : "unliked"
                            }
                            variants={{
                              liked: {
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                transition: { duration: 0.3 },
                              },
                              unliked: {
                                backgroundColor: "rgba(255, 255, 255, 0.9)",
                                transition: { duration: 0.3 },
                              },
                            }}
                          >
                            <motion.div
                              animate={
                                followedEvents.has(Number(sortedEvents[globalIndex]?.id))
                                  ? "liked"
                                  : "unliked"
                              }
                              variants={{
                                liked: {
                                  scale: [1, 1.2, 1],
                                  transition: {
                                    duration: 0.6,
                                    ease: "easeInOut",
                                  },
                                },
                                unliked: {
                                  scale: 1,
                                  transition: { duration: 0.3 },
                                },
                              }}
                            >
                              <Heart
                                className={`w-5 h-5 ${
                                  followedEvents.has(Number(sortedEvents[globalIndex]?.id))
                                    ? "fill-red-500 text-red-500"
                                    : "text-gray-500"
                                }`}
                              />
                            </motion.div>
                          </motion.button>
                        )}

                        {isAdmin && Number.isFinite(Number(sortedEvents[globalIndex]?.id)) && (
                          <div className="absolute top-3 right-3 z-10 flex gap-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openEdit(sortedEvents[globalIndex]);
                              }}
                              className="px-2 py-1 rounded-full bg-white/90 border border-gray-300 text-gray-800 shadow"
                              aria-label={tTrendingAdmin("editAria")}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteEvent(Number(sortedEvents[globalIndex]?.id));
                              }}
                              className="px-2 py-1 rounded-full bg-red-600 text-white shadow disabled:opacity-50"
                              disabled={deleteBusyId === Number(sortedEvents[globalIndex]?.id)}
                              aria-label={tTrendingAdmin("deleteAria")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* 产品图片：仅在存在有效 id 时可点击跳转 */}
                        {Number.isFinite(Number(sortedEvents[globalIndex]?.id)) ? (
                          <Link href={`/prediction/${sortedEvents[globalIndex]?.id}`}>
                            <div className="relative h-40 overflow-hidden bg-gray-100">
                              <img
                                src={product.image}
                                alt={product.title}
                                loading="lazy"
                                decoding="async"
                                width={800}
                                height={320}
                                className="w-full h-full object-cover transition-opacity duration-300"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  img.onerror = null;
                                  img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                                    product.title
                                  )}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
                                }}
                              />
                            </div>
                          </Link>
                        ) : (
                          <div className="relative h-40 overflow-hidden bg-gray-100">
                            <img
                              src={product.image}
                              alt={product.title}
                              loading="lazy"
                              decoding="async"
                              width={800}
                              height={320}
                              className="w-full h-full object-cover transition-opacity duration-300"
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.onerror = null;
                                img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                                  product.title
                                )}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
                              }}
                            />
                          </div>
                        )}

                        {/* 产品信息 */}
                        <div className="p-4 flex flex-col flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-gray-900 text-base line-clamp-2 group-hover:text-purple-700 transition-colors">
                              {tEvents(product.title)}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                              {tTrending("card.volumePrefix")}
                              {Number(sortedEvents[globalIndex]?.stats?.totalAmount || 0).toFixed(
                                2
                              )}
                            </span>
                            <div className="flex items-center text-gray-500 text-[10px] font-medium">
                              <Users className="w-3 h-3 mr-1" />
                              <span>
                                {Number(sortedEvents[globalIndex]?.stats?.participantCount || 0)}
                              </span>
                            </div>
                            <div className="flex items-center text-gray-500 text-[10px] font-medium">
                              <Heart className="w-3 h-3 mr-1" />
                              <span>{sortedEvents[globalIndex]?.followers_count || 0}</span>
                            </div>
                          </div>
                          {/* 多元选项 chip 展示（最多 6 个） */}
                          {Array.isArray(sortedEvents[globalIndex]?.outcomes) &&
                            sortedEvents[globalIndex]?.outcomes.length > 0 && (
                              <div className="mt-auto pt-2 border-t border-gray-100 flex flex-wrap gap-1">
                                {sortedEvents[globalIndex]?.outcomes
                                  .slice(0, 4)
                                  .map((o: any, oi: number) => (
                                    <span
                                      key={oi}
                                      className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-50 text-gray-600 border border-gray-200/60"
                                    >
                                      {String(
                                        o?.label || `${tTrending("card.optionFallbackPrefix")}${oi}`
                                      )}
                                    </span>
                                  ))}
                                {sortedEvents[globalIndex]?.outcomes.length > 4 && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-50 text-gray-400 border border-gray-200/60">
                                    +{sortedEvents[globalIndex]?.outcomes.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* 无限滚动触发器 */}
                {hasMore && (
                  <div ref={observerTargetRef} className="flex justify-center py-8">
                    {loadingMore ? (
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-3 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-600 text-sm font-medium">
                          {tTrending("state.loadMore")}
                        </span>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-sm">{tTrending("state.scrollHint")}</div>
                    )}
                  </div>
                )}

                {/* 已加载完全部数据 */}
                {!hasMore && sortedEvents.length > 0 && (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>
                        {tTrending("state.allLoadedPrefix")}
                        {sortedEvents.length}
                        {tTrending("state.allLoadedSuffix")}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-[92vw] max-w-md bg-white rounded-2xl shadow-xl p-6">
            <div className="text-lg font-semibold mb-4">{tTrendingAdmin("editDialogTitle")}</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldTitle")}</div>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditField("title", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldCategory")}</div>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditField("category", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="科技">科技</option>
                  <option value="娱乐">娱乐</option>
                  <option value="时政">时政</option>
                  <option value="天气">天气</option>
                  <option value="体育">体育</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldStatus")}</div>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditField("status", e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    <option value="active">active</option>
                    <option value="ended">ended</option>
                    <option value="settled">settled</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">
                    {tTrendingAdmin("fieldDeadline")}
                  </div>
                  <DatePicker
                    value={editForm.deadline}
                    onChange={(val) => setEditField("deadline", val)}
                    includeTime={true}
                    className="w-full"
                    placeholder={tTrendingAdmin("deadlinePlaceholder")}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">{tTrendingAdmin("fieldMinStake")}</div>
                <input
                  type="number"
                  value={editForm.minStake}
                  onChange={(e) => setEditField("minStake", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={closeEdit} className="px-4 py-2 rounded-lg border">
                {tTrendingAdmin("cancel")}
              </button>
              <button
                onClick={submitEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50"
              >
                {savingEdit ? tTrendingAdmin("saving") : tTrendingAdmin("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 登录提示弹窗 */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLoginModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-md w-full bg-gradient-to-br from-white via-white to-purple-50 rounded-3xl shadow-2xl border border-white/20 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 背景装饰 */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-2xl"></div>
              </div>

              {/* 弹窗内容 */}
              <div className="relative z-10 p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-6">
                  <Wallet className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                  {tTrending("login.title")}
                </h3>
                <p className="text-gray-600 mb-6">{tTrending("login.description")}</p>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-4 mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">
                    {tTrending("login.benefitsTitle")}
                  </h4>
                  <ul className="text-gray-600 space-y-2 text-left">
                    <li className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      {tTrending("login.benefitFollow")}
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      {tTrending("login.benefitParticipate")}
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      {tTrending("login.benefitRewards")}
                    </li>
                  </ul>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200"
                  >
                    {tTrending("login.later")}
                  </button>
                  <button
                    onClick={() => {
                      setShowLoginModal(false);
                      // 这里可以添加跳转到连接钱包页面的逻辑
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-md"
                  >
                    {tTrending("login.now")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
