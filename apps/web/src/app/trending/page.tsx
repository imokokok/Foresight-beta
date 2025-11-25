"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, CheckCircle, Wallet, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { followPrediction, unfollowPrediction } from "@/lib/follows";
import { supabase } from "@/lib/supabase";

export default function TrendingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWorkerRef = useRef<Worker | null>(null);
  const offscreenActiveRef = useRef<boolean>(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // 展示模式：分页 或 滚动（默认分页以避免长列表缓慢下滑）
  


  // 添加热点事件轮播数据
  const heroEvents = [
    {
      title: "全球气候峰会",
      description: "讨论全球气候变化的应对策略",
      image:
        "https://images.unsplash.com/photo-1569163139394-de44cb4e4c81?auto=format&fit=crop&w=1000&q=80",
      followers: 12842,
      category: "时政",
    },
    {
      title: "AI安全大会",
      description: "聚焦AI监管与安全问题",
      image:
        "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1000&q=80",
      followers: 9340,
      category: "科技",
    },
    {
      title: "国际金融论坛",
      description: "探讨数字货币与未来经济",
      image:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1000&q=80",
      followers: 7561,
      category: "时政",
    },
    {
      title: "体育公益赛",
      description: "全球运动员联合助力慈善",
      image:
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=80",
      followers: 5043,
      category: "娱乐",
    },
    {
      title: "极端天气预警",
      description: "全球多地发布极端天气预警",
      image:
        "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1000&q=80",
      followers: 8921,
      category: "天气",
    },
    {
      title: "科技新品发布",
      description: "最新科技产品震撼发布",
      image:
        "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1000&q=80",
      followers: 7654,
      category: "科技",
    },
  ];


  // 专题板块数据
  const categories = [
    { name: "科技", icon: "🚀", color: "from-blue-400 to-cyan-400" },
    { name: "娱乐", icon: "🎬", color: "from-pink-400 to-rose-400" },
    { name: "时政", icon: "🏛️", color: "from-purple-400 to-indigo-400" },
    { name: "天气", icon: "🌤️", color: "from-green-400 to-emerald-400" },
  ];

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [displayCount, setDisplayCount] = useState(12);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const productsSectionRef = useRef<HTMLElement | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    {}
  );

  // 登录提示弹窗状态
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 关注功能状态管理
  const [followedEvents, setFollowedEvents] = useState<Set<number>>(new Set());
  const { account, siweLogin } = useWallet();
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
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
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

    try {
      if (wasFollowing) {
        await unfollowPrediction(Number(predictionId), accountNorm);
      } else {
        await followPrediction(Number(predictionId), accountNorm);
      }
    } catch (err) {
      console.error("关注/取消关注失败:", err);
      setFollowError(
        (err as any)?.message
          ? String((err as any).message)
          : "关注操作失败，请稍后重试"
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
    }
  };

  const createSmartClickEffect = (event: React.MouseEvent) => {
    const reduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    glow.style.background = `radial-gradient(circle at ${event.clientX}px ${event.clientY}px, ${glowColor} 0%, ${glowColor.replace("0.15", "0.1")} 25%, ${glowColor.replace("0.15", "0.05")} 40%, transparent 70%)`;
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
    const reduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
            transform: `translate(${targetX - centerX}px, ${
              targetY - centerY
            }px) scale(0.5)`,
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
  const createCategoryParticlesAtCardClick = (
    event: React.MouseEvent,
    category?: string
  ) => {
    const reduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // 输入关键字时，自动定位到匹配的热点事件（使用防抖）
  

  // 无限滚动功能
  const displayCountRef = useRef(displayCount);
  const totalEventsCountRef = useRef(totalEventsCount);
  const loadingMoreRef = useRef(false);
  useEffect(() => {
    displayCountRef.current = displayCount;
  }, [displayCount]);
  useEffect(() => {
    totalEventsCountRef.current = totalEventsCount;
  }, [totalEventsCount]);
  useEffect(() => {
    const handleScroll = () => {
      // 检查是否滚动到底部
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      // 当距离底部小于100px时加载更多
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        const current = displayCountRef.current;
        const total = totalEventsCountRef.current;
        if (!loadingMoreRef.current && current < total) {
          loadingMoreRef.current = true;
          setDisplayCount((prev) => Math.min(prev + 6, total));
          setTimeout(() => {
            loadingMoreRef.current = false;
          }, 300);
        }
      }
    };

    // 添加滚动监听
    window.addEventListener("scroll", handleScroll, { passive: true });

    // 清理函数
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [displayCount, totalEventsCount]);

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
        worker = new Worker(
          new URL("../../workers/particles.worker.ts", import.meta.url),
          { type: "module" }
        );
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
          console.warn(
            "transferControlToOffscreen 失败，回退到主线程绘制:",
            err
          );
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
      console.warn(
        "主线程 fallback 获取 2D 上下文失败（可能已 Offscreen 接管）:",
        err
      );
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
    const scaleFactor = Math.min(
      2,
      (canvasEl.width * canvasEl.height) / (1280 * 720)
    );
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
                  const alpha = Math.max(
                    0.05,
                    ((LINK_DISTANCE - dist) / LINK_DISTANCE) * 0.4
                  );
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
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取预测事件数据
  useEffect(() => {
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
          "/api/predictions?includeOutcomes=1",
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

  // 同步服务器关注状态到本地心形按钮（保存为事件ID集合）
  useEffect(() => {
    if (!accountNorm) return;
    (async () => {
      try {
        const res = await fetch(`/api/user-follows?address=${accountNorm}`);
        if (!res.ok) return;
        const data = await res.json();
        const ids = new Set<number>(
          (data?.follows || []).map((e: any) => Number(e.id))
        );
        setFollowedEvents(ids);
      } catch (err) {
        console.warn("同步关注状态失败:", err);
      }
    })();
  }, [accountNorm]);

  // 将预测事件转换为页面显示格式（包含事件ID以便关注映射）
  const allEvents = useMemo(
    () =>
      predictions.map((prediction) => ({
        id: prediction.id,
        title: prediction.title,
        description: prediction.description,
        insured: `${prediction.min_stake} USDT`,
        minInvestment: `${prediction.min_stake} USDT`,
        tag: prediction.category,
        image:
          prediction.image_url ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
            prediction.title
          )}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`,
        deadline: prediction.deadline,
        criteria: prediction.criteria,
        followers_count: Number(prediction?.followers_count || 0),
        type: prediction.type || 'binary',
        outcomes: Array.isArray(prediction?.outcomes) ? prediction.outcomes : [],
      })),
    [predictions]
  );

  // 当分类计数接口不可用时，基于已加载的预测数据进行本地回退计算
  // 本地回退逻辑已移除，分类计数仅依赖后端 /api/categories/counts

  const displayEvents = allEvents;
  const sortedEvents = allEvents;

  const bestEvent = useMemo(() => {
    const pool = displayEvents;
    if (pool.length === 0) return null as any;
    const now = Date.now();
    const pick = [...pool].sort((a, b) => {
      const fa = Number(a?.followers_count || 0);
      const fb = Number(b?.followers_count || 0);
      if (fb !== fa) return fb - fa;
      const da = new Date(String(a?.deadline || 0)).getTime() - now;
      const db = new Date(String(b?.deadline || 0)).getTime() - now;
      const ta = da <= 0 ? Number.POSITIVE_INFINITY : da;
      const tb = db <= 0 ? Number.POSITIVE_INFINITY : db;
      return ta - tb;
    })[0];
    return pick;
  }, [displayEvents]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({ title: '', category: '', status: 'active', deadline: '', minStake: 0 });
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!accountNorm) { setIsAdmin(false); return }
        const r = await fetch(`/api/user-profiles?address=${accountNorm}`, { cache: 'no-store' })
        const j = await r.json().catch(() => ({}))
        setIsAdmin(!!j?.profile?.is_admin)
      } catch {}
    }
    loadProfile()
  }, [accountNorm])

  const openEdit = (p: any) => {
    setEditTargetId(Number(p?.id));
    setEditForm({ title: String(p?.title || ''), category: String(p?.tag || p?.category || ''), status: String(p?.status || 'active'), deadline: String(p?.deadline || ''), minStake: Number(p?.min_stake || 0) });
    setEditOpen(true);
  };
  const closeEdit = () => { setEditOpen(false); setEditTargetId(null); };
  const setEditField = (k: string, v: any) => setEditForm((prev: any) => ({ ...prev, [k]: v }));
  const submitEdit = async () => {
    try {
      setSavingEdit(true);
      if (!accountNorm) return;
      try { await siweLogin() } catch {}
      const id = Number(editTargetId);
      const payload: any = { title: editForm.title, category: editForm.category, status: editForm.status, deadline: editForm.deadline, minStake: Number(editForm.minStake), walletAddress: accountNorm };
      const res = await fetch(`/api/predictions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) { throw new Error(String(j?.message || '更新失败')) }
      setPredictions((prev) => prev.map((p: any) => p?.id === id ? { ...p, title: payload.title, category: payload.category, status: payload.status, deadline: payload.deadline, min_stake: payload.minStake } : p));
      setEditOpen(false);
    } catch (e: any) {
      alert(String(e?.message || e || '更新失败'))
    } finally {
      setSavingEdit(false);
    }
  };
  const deleteEvent = async (id: number) => {
    try {
      if (!confirm('确定删除该事件？')) return;
      setDeleteBusyId(id);
      if (!accountNorm) return;
      try { await siweLogin() } catch {}
      const res = await fetch(`/api/predictions/${id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) { throw new Error(String(j?.message || '删除失败')) }
      setPredictions((prev) => prev.filter((p: any) => p?.id !== id));
    } catch (e: any) {
      alert(String(e?.message || e || '删除失败'))
    } finally {
      setDeleteBusyId(null);
    }
  };

  const heroSlideEvents = useMemo(() => {
    const pool = displayEvents;
    if (pool.length === 0) return [] as any[];
    const now = Date.now();
    const sorter = (a: any, b: any) => {
      const fa = Number(a?.followers_count || 0);
      const fb = Number(b?.followers_count || 0);
      if (fb !== fa) return fb - fa;
      const da = new Date(String(a?.deadline || 0)).getTime() - now;
      const db = new Date(String(b?.deadline || 0)).getTime() - now;
      const ta = da <= 0 ? Number.POSITIVE_INFINITY : da;
      const tb = db <= 0 ? Number.POSITIVE_INFINITY : db;
      return ta - tb;
    };
    const tags = Array.from(new Set(pool.map((e) => String(e.tag || "")).filter(Boolean)));
    const picks = tags
      .map((tag) => {
        const group = pool.filter((e) => String(e.tag || "") === tag);
        if (group.length === 0) return null as any;
        return [...group].sort(sorter)[0];
      })
      .filter(Boolean);
    return [...picks].sort(sorter);
  }, [displayEvents]);

  const activeSlide =
    heroSlideEvents.length > 0
      ? heroSlideEvents[currentHeroIndex % heroSlideEvents.length]
      : null;
  const fallbackIndex =
    heroEvents.length > 0 ? currentHeroIndex % heroEvents.length : 0;
  const activeTitle = activeSlide
    ? String(activeSlide?.title || "")
    : String(heroEvents[fallbackIndex]?.title || "");
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

    const filterIn = `event_id=in.(${ids.join(",")})`;
    const channel = (supabase as any).channel("event_follows_trending");

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
          const row = payload?.new || {};
          const eid = Number(row?.event_id);
          const uid = String(row?.user_id || "");
          if (!Number.isFinite(eid)) return;
          if (!accountNorm || (uid || "").toLowerCase() !== accountNorm) {
            setPredictions((prev) =>
              prev.map((p) =>
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
          const row = payload?.old || {};
          const eid = Number(row?.event_id);
          const uid = String(row?.user_id || "");
          if (!Number.isFinite(eid)) return;
          if (!accountNorm || (uid || "").toLowerCase() !== accountNorm) {
            setPredictions((prev) =>
              prev.map((p) =>
                p?.id === eid
                  ? {
                      ...p,
                      followers_count: Math.max(
                        0,
                        Number(p?.followers_count || 0) - 1
                      ),
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
      (supabase as any).removeChannel(channel);
    };
  }, [sortedEvents, displayCount, accountNorm]);
  


  return (
    <div className="relative min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-pink-50 overflow-hidden text-black">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-500 ease-out ${
          canvasReady ? "opacity-60" : "opacity-0"
        }`}
      />
      {/* 背景装饰，与首页一致 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-xl"></div>
      </div>

      








      {/* 修改后的英雄区 - 轮播显示 */}
      <section className="relative z-10 flex flex-col md:flex-row items-center justify-between px-16 py-20 ">
        <div className="w-full md:w-1/2 mb-10 md:mb-0 relative">
          <div
            className={`relative h-80 rounded-2xl shadow-xl overflow-hidden ${
              activeSlide?.id ? "cursor-pointer" : ""
            }`}
            onClick={() => {
              if (activeSlide?.id) router.push(`/prediction/${activeSlide.id}`);
            }}
          >
            <motion.img
              key={String(
                (activeSlide && (activeSlide?.id || activeSlide?.title)) ||
                  currentHeroIndex
              )}
              src={activeImage}
              alt={activeTitle}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/20 to-transparent"
              onClick={() => {
                if (activeSlide?.id)
                  router.push(`/prediction/${activeSlide.id}`);
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
              <div className="max-w-md">
                <h3 className="font-bold text-white text-lg mb-1">
                  {activeTitle}
                </h3>
                <p className="text-white/85 text-sm mb-2 line-clamp-2">
                  {activeDescription}
                </p>
                <span className="text-white font-bold">
                  {activeFollowers.toLocaleString()} 人关注
                </span>
              </div>
              <button className="px-4 py-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-full text-sm font-medium">
                立即关注
              </button>
            </div>
          </div>
        </div>

        {/* 右侧专题板块 */}
        <div className="w-full md:w-1/2 pl-0 md:pl-12">
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1 text-center md:text-left">
            热门专题
          </h2>
          <div className="h-1.5 w-24 mx-auto md:mx-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 mb-2" />
          <div
            className="grid grid-cols-2 gap-4"
            style={{ ["overflowAnchor" as any]: "none" }}
          >
            {categories.map((category, index) => {
              const isActive = String(activeCategory || "") === category.name;
              const categoryEvents = allEvents.filter(
                (event) => event.tag === category.name
              );

              return (
                <motion.div
                  key={category.name}
                  className={`group relative p-5 rounded-2xl shadow-xl cursor-pointer transition-all duration-300 border-2 overflow-hidden ${
                    isActive
                      ? "bg-gradient-to-r " +
                        category.color +
                        " text-white scale-105 border-transparent"
                      : "bg-white/80 text-gray-800 hover:bg-white border-purple-200/50 hover:shadow-2xl"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const y =
                      typeof window !== "undefined"
                        ? window.scrollY ||
                          document.documentElement.scrollTop ||
                          0
                        : 0;
                    const idx = heroSlideEvents.findIndex(
                      (ev: any) => String(ev?.tag || "") === category.name
                    );
                    if (idx >= 0) {
                      setCurrentHeroIndex(idx);
                    } else {
                      const fallbackIdx = heroEvents.findIndex(
                        (ev) => ev.category === category.name
                      );
                      if (fallbackIdx >= 0) setCurrentHeroIndex(fallbackIdx);
                    }
                    if (typeof window !== "undefined") {
                      requestAnimationFrame(() => {
                        window.scrollTo({ top: y, behavior: "auto" });
                      });
                    }
                  }}
                >
                  <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 bg-gradient-to-br from-white to-transparent" />
                  <div className="absolute top-3 right-3 text-xs px-2 py-1 rounded-full bg-white/80 text-black shadow">
                    {categoryCounts[category.name] || 0} 热点
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-3xl mr-3">{category.icon}</span>
                      <div>
                        <h3 className="font-bold text-xl">{category.name}</h3>
                        <p className="text-sm opacity-85">点选查看该专题</p>
                      </div>
                    </div>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0.5, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1.1 }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          repeatType: "reverse",
                        }}
                        className="w-8 h-8 rounded-full ring-2 ring-white/70"
                      />
                    )}
                  </div>

                  {/* 当前专题的活跃事件标题 */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-sm font-medium"
                    >
                      {activeTitle}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        ref={productsSectionRef}
        className="relative z-10 px-10 py-12 bg-white/50 backdrop-blur-sm rounded-t-3xl"
        style={{ contentVisibility: "auto", containIntrinsicSize: "1000px" }}
      >
        <h3 className="text-2xl font-bold text-black mb-8 text-center">
          加密货币保险产品
        </h3>

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            <p className="mt-4 text-black">正在加载数据...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-500 text-lg mb-2">加载失败</div>
            <p className="text-black">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-full"
            >
              重新加载
            </button>
          </div>
        )}

        {/* 数据展示 */}
        {!loading && !error && (
          <>
            {followError && (
              <div className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded">
                {followError}
              </div>
            )}
            {sortedEvents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-black text-lg">暂无预测事件数据</p>
                <p className="text-gray-600 mt-2">请稍后再试或联系管理员</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {sortedEvents.slice(0, displayCount).map((product, i) => {
                    const globalIndex = i;
                    return (
                      <motion.div
                        key={sortedEvents[globalIndex]?.id || globalIndex}
                        className="bg-white/80 rounded-2xl shadow-md border border-purple-200/40 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg relative transform-gpu flex flex-col h-full min-h-[260px]"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={(e) => {
                          createCategoryParticlesAtCardClick(e, product.tag);
                        }}
                      >
                        {/* 关注按钮 */}
                        {Number.isFinite(
                          Number(sortedEvents[globalIndex]?.id)
                        ) && (
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
                              followedEvents.has(
                                Number(sortedEvents[globalIndex]?.id)
                              )
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
                                followedEvents.has(
                                  Number(sortedEvents[globalIndex]?.id)
                                )
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
                                  followedEvents.has(
                                    Number(sortedEvents[globalIndex]?.id)
                                  )
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
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(sortedEvents[globalIndex]); }}
                              className="px-2 py-1 rounded-full bg-white/90 border border-gray-300 text-gray-800 shadow"
                              aria-label="编辑"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteEvent(Number(sortedEvents[globalIndex]?.id)); }}
                              className="px-2 py-1 rounded-full bg-red-600 text-white shadow disabled:opacity-50"
                              disabled={deleteBusyId === Number(sortedEvents[globalIndex]?.id)}
                              aria-label="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* 产品图片：仅在存在有效 id 时可点击跳转 */}
                        {Number.isFinite(
                          Number(sortedEvents[globalIndex]?.id)
                        ) ? (
                          <Link
                            href={`/prediction/${sortedEvents[globalIndex]?.id}`}
                          >
                            <div className="relative h-44 overflow-hidden bg-white">
                              <img
                                src={product.image}
                                alt={product.title}
                                loading="lazy"
                                decoding="async"
                                width={800}
                                height={384}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const img =
                                    e.currentTarget as HTMLImageElement;
                                  img.onerror = null;
                                  img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                                    product.title
                                  )}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
                                }}
                              />
                            </div>
                          </Link>
                        ) : (
                          <div className="relative h-44 overflow-hidden bg-white">
                            <img
                              src={product.image}
                              alt={product.title}
                              loading="lazy"
                              decoding="async"
                              width={800}
                              height={384}
                              className="w-full h-full object-cover"
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
                        <div className="p-3 flex flex-col flex-1">
                          <div className="flex justify-between items-center mb-1.5">
                            <h4 className="font-bold text-black text-base line-clamp-2">
                              {product.title}
                            </h4>
                            <span className="text-black text-xs bg-gray-100 px-2 py-1 rounded">
                              已投金额 {product.insured}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-500 text-sm mt-1.5">
                            <Heart className="w-4 h-4 mr-1" />
                            <span>
                              {sortedEvents[globalIndex]?.followers_count || 0}{" "}
                              人关注
                            </span>
                          </div>
                          {/* 多元选项 chip 展示（最多 6 个） */}
                          {Array.isArray(sortedEvents[globalIndex]?.outcomes) && sortedEvents[globalIndex]?.outcomes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {sortedEvents[globalIndex]?.outcomes.slice(0, 6).map((o: any, oi: number) => (
                                <span key={oi} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                  {String(o?.label || `选项${oi}`)}
                                </span>
                              ))}
                              {sortedEvents[globalIndex]?.outcomes.length > 6 && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">…</span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}

            
          </>
        )}
      </section>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-[92vw] max-w-md bg-white rounded-2xl shadow-xl p-6">
            <div className="text-lg font-semibold mb-4">编辑事件</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">标题</div>
                <input value={editForm.title} onChange={(e)=>setEditField('title', e.target.value)} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">分类</div>
                <input value={editForm.category} onChange={(e)=>setEditField('category', e.target.value)} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600 mb-1">状态</div>
                  <select value={editForm.status} onChange={(e)=>setEditField('status', e.target.value)} className="w-full rounded-lg border px-3 py-2">
                    <option value="active">active</option>
                    <option value="ended">ended</option>
                    <option value="settled">settled</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">截止</div>
                  <input type="datetime-local" value={editForm.deadline} onChange={(e)=>setEditField('deadline', e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">最小押注</div>
                <input type="number" value={editForm.minStake} onChange={(e)=>setEditField('minStake', e.target.value)} className="w-full rounded-lg border px-3 py-2" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={closeEdit} className="px-4 py-2 rounded-lg border">取消</button>
              <button onClick={submitEdit} disabled={savingEdit} className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50">{savingEdit?'保存中…':'保存'}</button>
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
                  请先登录
                </h3>
                <p className="text-gray-600 mb-6">
                  关注预测事件需要先连接钱包登录。请点击右上角的"连接钱包"按钮进行登录。
                </p>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-4 mb-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">
                    登录后您可以：
                  </h4>
                  <ul className="text-gray-600 space-y-2 text-left">
                    <li className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      关注感兴趣的预测事件
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      参与预测和押注
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      获得预测奖励
                    </li>
                  </ul>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200"
                  >
                    稍后再说
                  </button>
                  <button
                    onClick={() => {
                      setShowLoginModal(false);
                      // 这里可以添加跳转到连接钱包页面的逻辑
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-md"
                  >
                    立即登录
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
