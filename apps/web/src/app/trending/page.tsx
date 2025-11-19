"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, CheckCircle, Wallet, ChevronRight, ChevronsUpDown, TrendingUp, Users, Flame, Gift, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { followPrediction, unfollowPrediction } from "@/lib/follows";
import { supabase } from "@/lib/supabase";

export default function TrendingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWorkerRef = useRef<Worker | null>(null);
  const offscreenActiveRef = useRef<boolean>(false);
  
  const mainContentRef = useRef<HTMLDivElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  // 展示模式：分页 或 滚动（默认分页以避免长列表缓慢下滑）
  const [viewMode, setViewMode] = useState<'paginate' | 'scroll'>('paginate');
  const [page, setPage] = useState(0);
  const pageSize = 12;

  // 侧边栏数据
  const sidebarData = {
    recentEvents: [
      { name: "以太坊2.0升级", icon: "🚀", time: "2小时前", category: "科技" },
      { name: "比特币减半", icon: "💰", time: "5小时前", category: "区块链" },
      { name: "AI技术突破", icon: "🤖", time: "1天前", category: "科技" },
      { name: "全球气候峰会", icon: "🌍", time: "1天前", category: "时政" },
      { name: "电影票房预测", icon: "🎬", time: "2天前", category: "娱乐" },
      { name: "体育赛事结果", icon: "⚽", time: "3天前", category: "体育" },
    ],
    trendingPredictions: [
      { name: "以太坊价格预测", volume: "245 USDT", trend: "up" },
      { name: "比特币减半影响", volume: "189 USDT", trend: "up" },
      { name: "AI技术突破预测", volume: "320 USDT", trend: "down" },
      { name: "全球气候峰会结果", volume: "150 USDT", trend: "down" },
      { name: "电影票房预测", volume: "210 USDT", trend: "up" },
      { name: "体育赛事结果", volume: "133 USDT", trend: "up" },
    ],
    platformStats: {
      totalInsured: "1,208 USDT",
      activeUsers: "2,456",
      claimsPaid: "89 USDT",
    },
  };

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

  // 从查询参数初始化搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState(searchQuery);
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setSearchQuery(q);
      setSearchInput(q);
    }
  }, [searchParams]);

  // 专题板块数据
  const categories = [
    { name: "科技", icon: "🚀", color: "from-blue-400 to-cyan-400" },
    { name: "娱乐", icon: "🎬", color: "from-pink-400 to-rose-400" },
    { name: "时政", icon: "🏛️", color: "from-purple-400 to-indigo-400" },
    { name: "天气", icon: "🌤️", color: "from-green-400 to-emerald-400" },
  ];

  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortOption, setSortOption] = useState<"default" | "minInvestment-asc" | "insured-desc">("default");
  const [displayCount, setDisplayCount] = useState(6);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [totalEventsCount, setTotalEventsCount] = useState(0);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const productsSectionRef = useRef<HTMLElement | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // 登录提示弹窗状态
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // 关注功能状态管理
  const [followedEvents, setFollowedEvents] = useState<Set<number>>(new Set());
  const { account } = useWallet();
  const accountNorm = account?.toLowerCase();
  const [followError, setFollowError] = useState<string | null>(null);
  // Realtime 订阅状态与过滤信息（用于可视化诊断）
  const [rtStatus, setRtStatus] = useState<string>('INIT');
  const [rtFilter, setRtFilter] = useState<string>('');
  // 未结算视图模式
  const [pendingMode, setPendingMode] = useState<'soon' | 'popular'>('soon');
  // 活动日志（关注/取消关注/访问）
  const [activityLog, setActivityLog] = useState<Array<{ type: 'follow' | 'unfollow' | 'visit'; id: number; title: string; category: string; ts: string }>>([]);

  function pushActivity(item: { type: 'follow' | 'unfollow' | 'visit'; id: number; title: string; category: string; ts: string }) {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('activity_log') : null;
      const arr = raw ? JSON.parse(raw) : [];
      const next = [item, ...(Array.isArray(arr) ? arr : [])].slice(0, 20);
      window.localStorage.setItem('activity_log', JSON.stringify(next));
      setActivityLog(next);
    } catch {}
  }

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('activity_log') : null;
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setActivityLog(arr);
    } catch {}
  }, []);
  
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
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollProgress(progress);
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
        canvasWorkerRef.current?.postMessage({ type: 'scrolling', isScrolling: false });
      }, 120);

      // 通知 Worker 正在滚动
      canvasWorkerRef.current?.postMessage({ type: 'scrolling', isScrolling: true });
      // 将读写合并到下一帧，降低reflow频率
      if (!rafId) {
        rafId = requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    update(); // 初始化检查

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    };
  }, []);

  // 返回顶部函数
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 获取分类热点数量
  useEffect(() => {
    const fetchCategoryCounts = async () => {
      try {
        const controller = new AbortController();
        const response = await fetch('/api/categories/counts', { signal: controller.signal });
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
        if ((error as any)?.name !== 'AbortError') {
          console.error('获取分类热点数量失败:', error);
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

    // 创建涟漪效果
    createSmartClickEffect(event);
    // 立即触发爱心粒子效果，避免等待网络响应导致的延迟
    createHeartParticles(eventIndex, wasFollowing);

    // 乐观更新本地状态（按事件ID而非索引）
    setFollowedEvents(prev => {
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
    setPredictions(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => Number(p?.id) === Number(predictionId));
      if (idx >= 0) {
        const currentCount = Number(next[idx]?.followers_count || 0);
        next[idx] = {
          ...next[idx],
          followers_count: wasFollowing ? Math.max(0, currentCount - 1) : currentCount + 1,
        };
      }
      return next;
    });

    try {
      if (wasFollowing) {
        await unfollowPrediction(Number(predictionId), accountNorm);
        // 记录取消关注活动
        const p = predictions.find(e => Number(e?.id) === Number(predictionId));
        pushActivity({ type: 'unfollow', id: Number(predictionId), title: String(p?.title || `事件 #${predictionId}`), category: String(p?.category || ''), ts: new Date().toISOString() });
      } else {
        await followPrediction(Number(predictionId), accountNorm);
        // 记录关注活动
        const p = predictions.find(e => Number(e?.id) === Number(predictionId));
        pushActivity({ type: 'follow', id: Number(predictionId), title: String(p?.title || `事件 #${predictionId}`), category: String(p?.category || ''), ts: new Date().toISOString() });
      }
    } catch (err) {
      console.error('关注/取消关注失败:', err);
      setFollowError((err as any)?.message ? String((err as any).message) : '关注操作失败，请稍后重试');
      setTimeout(() => setFollowError(null), 3000);
      // 回滚本地状态（按事件ID回滚）
      setFollowedEvents(prev => {
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
      setPredictions(prev => {
        const next = [...prev];
        const idx = next.findIndex(p => Number(p?.id) === Number(predictionId));
        if (idx >= 0) {
          const currentCount = Number(next[idx]?.followers_count || 0);
          next[idx] = {
            ...next[idx],
            followers_count: wasFollowing ? currentCount + 1 : Math.max(0, currentCount - 1),
          };
        }
        return next;
      });
    }
  };

  // 优雅点击反馈效果
  const createSmartClickEffect = (event: React.MouseEvent) => {
    const button = event.currentTarget as HTMLElement;
    
    // 分析按钮类型和特征
    const buttonText = button.textContent?.toLowerCase() || '';
    const buttonClasses = button.className || '';
    const rect = button.getBoundingClientRect();
    const buttonSize = Math.max(rect.width, rect.height);
    
    // 根据按钮特征确定特效类型和颜色
    let effectType = 'default';
    let effectColor = '#8B5CF6'; // 默认紫色
    let glowColor = 'rgba(139, 92, 246, 0.15)';
    
    if (buttonText.includes('关注') || buttonText.includes('follow') || buttonClasses.includes('heart')) {
      // 关注按钮 - 使用爱心粒子特效（不在这里处理，在toggleFollow中处理）
      effectType = 'heart';
      effectColor = '#EF4444';
      glowColor = 'rgba(239, 68, 68, 0.15)';
    } else if (buttonText.includes('搜索') || buttonText.includes('search')) {
      // 搜索按钮 - 蓝色光晕+缩放
      effectType = 'search';
      effectColor = '#3B82F6';
      glowColor = 'rgba(59, 130, 246, 0.15)';
    } else if (buttonText.includes('重置') || buttonText.includes('reset')) {
      // 重置按钮 - 灰色涟漪+缩放
      effectType = 'reset';
      effectColor = '#6B7280';
      glowColor = 'rgba(107, 114, 128, 0.15)';
    } else if (buttonClasses.includes('category') || buttonText.includes('科技') || buttonText.includes('娱乐') || 
               buttonText.includes('时政') || buttonText.includes('天气')) {
      // 分类标签 - 使用爱心粒子特效，根据方框颜色调整粒子颜色
      effectType = 'category';
      
      // 根据分类名称设置对应的粒子颜色
      if (buttonText.includes('科技')) {
        effectColor = '#3B82F6'; // 蓝色
        glowColor = 'rgba(59, 130, 246, 0.15)';
      } else if (buttonText.includes('娱乐')) {
        effectColor = '#EC4899'; // 粉色
        glowColor = 'rgba(236, 72, 153, 0.15)';
      } else if (buttonText.includes('时政')) {
        effectColor = '#8B5CF6'; // 紫色
        glowColor = 'rgba(139, 92, 246, 0.15)';
      } else if (buttonText.includes('天气')) {
        effectColor = '#10B981'; // 绿色
        glowColor = 'rgba(16, 185, 129, 0.15)';
      } else {
        effectColor = '#8B5CF6'; // 默认紫色
        glowColor = 'rgba(139, 92, 246, 0.15)';
      }
      
      // 为分类按钮创建爱心粒子特效
      createHeartParticlesForCategory(event.nativeEvent, effectColor);
      return; // 直接返回，不执行后续的通用特效
    } else if (buttonClasses.includes('product') || buttonClasses.includes('card')) {
      // 产品卡片 - 渐变光晕
      effectType = 'product';
      effectColor = '#A855F7';
      glowColor = 'rgba(168, 85, 247, 0.15)';
    } else {
      // 默认按钮 - 紫色光晕+涟漪
      effectType = 'default';
    }
    
    // 根据按钮大小调整特效尺寸
    const sizeMultiplier = Math.max(0.8, Math.min(2.5, buttonSize / 50));
    const rippleSize = Math.max(rect.width, rect.height) * (1.5 + sizeMultiplier * 0.3);
    const glowSize = 1.5 + sizeMultiplier * 0.5;
    
    // 1. 智能光晕扩散效果 - 根据按钮类型调整颜色（移除震动效果）
    const glow = document.createElement('div');
    glow.style.position = 'fixed';
    glow.style.top = '0';
    glow.style.left = '0';
    glow.style.width = '100%';
    glow.style.height = '100%';
    glow.style.background = `radial-gradient(circle at ${event.clientX}px ${event.clientY}px, 
      ${glowColor} 0%, 
      ${glowColor.replace('0.15', '0.1')} 25%, 
      ${glowColor.replace('0.15', '0.05')} 40%, 
      transparent 70%)`;
    glow.style.pointerEvents = 'none';
    glow.style.zIndex = '9999';
    glow.style.opacity = '0';
    
    document.body.appendChild(glow);
    
    // 智能光晕动画 - 根据按钮大小调整扩散范围
    glow.animate([
      { opacity: 0, transform: 'scale(0.8)' },
      { opacity: 0.6, transform: `scale(${glowSize})` },
      { opacity: 0, transform: `scale(${glowSize * 1.2})` }
    ], {
      duration: 600,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });
    
    setTimeout(() => glow.remove(), 600);
    
    // 2. 智能水波纹效果 - 根据按钮类型调整效果
    const buttonRect = button.getBoundingClientRect();
    const clickX = event.clientX - buttonRect.left;
    const clickY = event.clientY - buttonRect.top;
    
    const ripple = document.createElement('span');
    ripple.className = 'absolute rounded-full pointer-events-none';
    ripple.style.width = ripple.style.height = rippleSize + 'px';
    ripple.style.left = clickX - rippleSize / 2 + 'px';
    ripple.style.top = clickY - rippleSize / 2 + 'px';
    
    // 根据按钮类型设置不同的波纹效果
    if (effectType === 'search') {
      // 搜索按钮：蓝色渐变波纹
      ripple.style.background = `radial-gradient(circle, rgba(255,255,255,0.9) 0%, 
        ${effectColor}50 30%, ${effectColor}30 60%, transparent 90%)`;
      ripple.style.boxShadow = `0 0 25px ${effectColor}40`;
    } else if (effectType === 'reset') {
      // 重置按钮：灰色简洁波纹
      ripple.style.background = `radial-gradient(circle, rgba(255,255,255,0.8) 0%, 
        ${effectColor}40 50%, transparent 80%)`;
      ripple.style.boxShadow = `0 0 15px ${effectColor}30`;
    } else if (effectType === 'category') {
      // 分类标签：彩色强烈波纹
      ripple.style.background = `radial-gradient(circle, rgba(255,255,255,1) 0%, 
        ${effectColor}60 40%, ${effectColor}30 70%, transparent 95%)`;
      ripple.style.boxShadow = `0 0 30px ${effectColor}50`;
    } else {
      // 默认：紫色渐变波纹
      ripple.style.background = `radial-gradient(circle, rgba(255,255,255,0.8) 0%, 
        ${effectColor}40 40%, ${effectColor}20 70%, transparent 95%)`;
      ripple.style.boxShadow = `0 0 20px ${effectColor}30`;
    }
    
    ripple.style.transform = 'scale(0)';
    
    // 确保按钮有相对定位
    const originalPosition = button.style.position;
    if (getComputedStyle(button).position === 'static') {
      button.style.position = 'relative';
    }
    
    button.appendChild(ripple);
    
    // 智能水波纹动画 - 根据按钮大小调整动画时长
    const rippleDuration = Math.max(400, Math.min(800, 500 + sizeMultiplier * 100));
    ripple.animate([
      { transform: 'scale(0)', opacity: 0.8 },
      { transform: 'scale(1)', opacity: 0.4 },
      { transform: 'scale(1.5)', opacity: 0 }
    ], {
      duration: rippleDuration,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
    
    setTimeout(() => {
      ripple.remove();
      // 恢复按钮的原始定位
      button.style.position = originalPosition;
    }, rippleDuration);
    
    // 3. 智能按钮缩放反馈 - 根据按钮类型调整缩放效果
    let scaleAmount = 0.95;
    let bounceAmount = 1.05;
    
    // 根据按钮类型调整缩放参数
    if (effectType === 'search') {
      scaleAmount = 0.92;
      bounceAmount = 1.08;
    } else if (effectType === 'reset') {
      scaleAmount = 0.93;
      bounceAmount = 1.04;
    } else if (effectType === 'category') {
      scaleAmount = 0.90;
      bounceAmount = 1.10;
    } else if (effectType === 'product') {
      scaleAmount = 0.88;
      bounceAmount = 1.12;
    }
    
    // 根据按钮大小微调缩放比例
    scaleAmount = Math.max(0.85, Math.min(0.98, scaleAmount - sizeMultiplier * 0.03));
    
    button.style.transition = 'transform 150ms ease-out';
    button.style.transform = `scale(${scaleAmount})`;
    setTimeout(() => {
      button.style.transform = `scale(${bounceAmount})`;
      setTimeout(() => {
        button.style.transform = 'scale(1)';
        setTimeout(() => {
          button.style.transition = '';
        }, 150);
      }, 75);
    }, 75);
  };

  // 创建爱心粒子效果
  const createHeartParticles = (eventIndex: number, isUnfollowing: boolean) => {
    const button = document.querySelector(`[data-event-index="${eventIndex}"]`);
    if (!button) return;
    
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // 创建粒子容器
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'fixed pointer-events-none z-50';
    particlesContainer.style.left = '0';
    particlesContainer.style.top = '0';
    particlesContainer.style.width = '100vw';
    particlesContainer.style.height = '100vh';
    
    document.body.appendChild(particlesContainer);
    
    // 创建多个粒子
    const particleCount = isUnfollowing ? 8 : 12;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute w-2 h-2 rounded-full';
      particle.style.background = isUnfollowing ? '#9ca3af' : '#ef4444';
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      particle.style.transform = 'translate(-50%, -50%)';
      
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
      
      particle.animate([
        { 
          transform: 'translate(-50%, -50%) scale(1)', 
          opacity: 1 
        },
        { 
          transform: `translate(${targetX - centerX}px, ${targetY - centerY}px) scale(0.5)`, 
          opacity: 0 
        }
      ], {
        duration: duration,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards'
      });
    });
    
    // 清理粒子容器
    setTimeout(() => {
      particlesContainer.remove();
    }, 1000);
  };

  // 创建分类按钮的爱心粒子效果
  const createHeartParticlesForCategory = (event: MouseEvent, color: string) => {
    const button = event.target as HTMLElement;
    if (!button) return;
    
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // 创建粒子容器
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'fixed pointer-events-none z-50';
    particlesContainer.style.left = '0';
    particlesContainer.style.top = '0';
    particlesContainer.style.width = '100vw';
    particlesContainer.style.height = '100vh';
    
    document.body.appendChild(particlesContainer);
    
    // 创建多个爱心粒子
    const particleCount = 8;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute w-3 h-3';
      particle.style.background = color;
      particle.style.left = `${centerX}px`;
      particle.style.top = `${centerY}px`;
      particle.style.transform = 'translate(-50%, -50%)';
      particle.style.clipPath = 'polygon(50% 15%, 61% 0, 75% 0, 85% 15%, 100% 35%, 100% 50%, 85% 65%, 75% 100%, 50% 85%, 25% 100%, 15% 65%, 0 50%, 0 35%, 15% 15%, 25% 0, 39% 0)';
      
      particlesContainer.appendChild(particle);
      particles.push(particle);
    }
    
    // 爱心粒子动画 - 向上扩散
    particles.forEach((particle, index) => {
      const angle = (index / particleCount) * Math.PI * 2;
      const distance = 60 + Math.random() * 40; // 随机距离
      const duration = 800 + Math.random() * 400; // 随机时长
      
      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = centerY - Math.abs(Math.sin(angle)) * distance * 1.5; // 主要向上扩散
      
      particle.animate([
        { 
          transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', 
          opacity: 1 
        },
        { 
          transform: `translate(${targetX - centerX}px, ${targetY - centerY}px) scale(0.3) rotate(${Math.random() * 360}deg)`, 
          opacity: 0 
        }
      ], {
        duration: duration,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards'
      });
    });
    
    // 清理粒子容器
    setTimeout(() => {
      particlesContainer.remove();
    }, 1200);
  };

  // 卡片点击：在鼠标点击位置生成对应分类颜色的粒子（比分类按钮略大）
  const createCategoryParticlesAtCardClick = (event: React.MouseEvent, category?: string) => {
    const x = event.clientX;
    const y = event.clientY;

    // 映射分类到颜色
    const color = category === '科技'
      ? '#3B82F6'
      : category === '娱乐'
      ? '#EC4899'
      : category === '时政'
      ? '#8B5CF6'
      : category === '天气'
      ? '#10B981'
      : '#8B5CF6';

    // 粒子容器
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'fixed pointer-events-none z-[9999]';
    particlesContainer.style.left = '0';
    particlesContainer.style.top = '0';
    particlesContainer.style.width = '100vw';
    particlesContainer.style.height = '100vh';
    document.body.appendChild(particlesContainer);

    // 比分类按钮略大的爱心粒子
    const particleCount = 12; // 稍多于分类按钮的 8 个
    const particles: HTMLDivElement[] = [];
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute w-4 h-4'; // 比分类按钮 w-3 h-3 略大
      particle.style.background = color;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.transform = 'translate(-50%, -50%)';
      particle.style.clipPath = 'polygon(50% 15%, 61% 0, 75% 0, 85% 15%, 100% 35%, 100% 50%, 85% 65%, 75% 100%, 50% 85%, 25% 100%, 15% 65%, 0 50%, 0 35%, 15% 15%, 25% 0, 39% 0)';
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
          { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(${targetX - x}px, ${targetY - y}px) scale(0.35) rotate(${Math.random() * 360}deg)`, opacity: 0 }
        ],
        { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
      );
    });

    setTimeout(() => { particlesContainer.remove(); }, 1200);
  };

  // 自动轮播效果
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroIndex((prevIndex) => prevIndex + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  

  const nextHero = () => {
    setCurrentHeroIndex((prevIndex) => (prevIndex + 1) % heroEvents.length);
  };

  const prevHero = () => {
    setCurrentHeroIndex(
      (prevIndex) => (prevIndex - 1 + heroEvents.length) % heroEvents.length
    );
  };

  // 输入关键字时，自动定位到匹配的热点事件（使用防抖）
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const q = debouncedQuery;
    if (!q) return;
    setCurrentHeroIndex(0);
  }, [debouncedQuery]);

  // 选择类型时，自动定位到该类型的第一个热点事件
  useEffect(() => {
    if (!selectedCategory) return;
    setCurrentHeroIndex(0);
  }, [selectedCategory]);

  // 点击外部时关闭排序菜单
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!sortOpen) return;
      const el = sortRef.current;
      if (el && !el.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [sortOpen]);

  // 无限滚动功能
  const displayCountRef = useRef(displayCount);
  const totalEventsCountRef = useRef(totalEventsCount);
  const loadingMoreRef = useRef(false);
  useEffect(() => { displayCountRef.current = displayCount; }, [displayCount]);
  useEffect(() => { totalEventsCountRef.current = totalEventsCount; }, [totalEventsCount]);
  useEffect(() => {
    if (viewMode !== 'scroll') return;
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
          setDisplayCount(prev => Math.min(prev + 6, total));
          setTimeout(() => { loadingMoreRef.current = false; }, 300);
        }
      }
    };

    // 添加滚动监听
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 清理函数
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [displayCount, totalEventsCount, viewMode]);
 
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl: HTMLCanvasElement = canvas;
    const supportsOffscreen = typeof (canvasEl as any).transferControlToOffscreen === 'function' && typeof Worker !== 'undefined';
    if (supportsOffscreen) {
      // OffscreenCanvas + Worker 路线（长期最佳）
      let worker: Worker | null = null;
      try {
        worker = new Worker(new URL('../../workers/particles.worker.ts', import.meta.url), { type: 'module' });
      } catch (err) {
        console.warn('Worker 初始化失败，回退到主线程绘制:', err);
      }
      if (worker) {
        canvasWorkerRef.current = worker;
        // 监听 Worker 首帧就绪，触发画布淡入
        try {
          worker.addEventListener('message', (ev: MessageEvent<any>) => {
            const data = (ev as any)?.data;
            if (data && data.type === 'ready') {
              setCanvasReady(true);
            }
          });
        } catch {}
        let offscreen: OffscreenCanvas | null = null;
        try {
          offscreen = (canvasEl as any).transferControlToOffscreen();
        } catch (err) {
          console.warn('transferControlToOffscreen 失败，回退到主线程绘制:', err);
        }
        if (offscreen) {
          const init = () => {
            const dpr = window.devicePixelRatio || 1;
            worker!.postMessage({ type: 'init', canvas: offscreen!, width: window.innerWidth, height: window.innerHeight, dpr }, [offscreen!]);
          };
          init();
          const onResize = () => {
            const dpr = window.devicePixelRatio || 1;
            worker!.postMessage({ type: 'resize', width: window.innerWidth, height: window.innerHeight, dpr });
          };
          const onMouseMove = (e: MouseEvent) => {
            const rect = canvasEl.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            worker!.postMessage({ type: 'mouse', x, y, active: true });
          };
          const onMouseLeave = () => { worker!.postMessage({ type: 'mouse', x: 0, y: 0, active: false }); };
          window.addEventListener('resize', onResize);
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseleave', onMouseLeave);
          // 初始滚动状态同步
          worker!.postMessage({ type: 'scrolling', isScrolling: false });
          // 标记 Offscreen 已接管，避免 fallback 再次取主线程上下文
          offscreenActiveRef.current = true;
          return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseleave', onMouseLeave);
            try { worker!.postMessage({ type: 'destroy' }); } catch {}
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
      console.warn('主线程 fallback 获取 2D 上下文失败（可能已 Offscreen 接管）:', err);
      return;
    }
    if (!context) return;
    const ctx = context;
    let animId = 0;

    type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'ring' | 'pentagon' | 'hexagon' | 'octagon';
    const COLORS = [
      'rgba(255, 140, 180, 0.48)', // rose pink
      'rgba(179, 136, 255, 0.45)', // lilac purple
      'rgba(100, 200, 255, 0.42)', // sky blue
      'rgba(120, 230, 190, 0.44)', // mint green
      'rgba(255, 190, 120, 0.40)', // peach orange
    ];

    const LINK_DISTANCE = 90; // 连线最大距离
    const CELL_SIZE = 24;     // 空间哈希网格大小

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
      radius: number;      // 碰撞半径（按外接圆估算）
      pulsePhase: number;  // 脉动相位
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
        this.rotationSpeed = (Math.random() * 0.01) - 0.005;
        // 减少三角形频率，增加对称多边形（五/六/八边形）
        const shapesPool: Shape[] = ['circle','square','diamond','ring','pentagon','hexagon','octagon','circle','square','diamond','ring','pentagon','hexagon','circle','square','diamond','triangle'];
        this.shape = shapesPool[Math.floor(Math.random() * shapesPool.length)];
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.pulsePhase = Math.random() * Math.PI * 2;
        // 估算不同形状的外接圆半径，作为碰撞半径
        switch (this.shape) {
          case 'circle':
            this.radius = this.baseSize;
            break;
          case 'square': { // s = baseSize * 1.6，半径约 s * sqrt(2)/2
            const s = this.baseSize * 1.6;
            this.radius = (s * Math.SQRT2) / 2;
            break;
          }
          case 'triangle': { // s = baseSize * 2，半径近似 s/2
            const s = this.baseSize * 2;
            this.radius = s / 2;
            break;
          }
          case 'diamond': { // s = baseSize * 2，半径近似 s/2
            const s = this.baseSize * 2;
            this.radius = s / 2;
            break;
          }
          case 'ring':
            this.radius = this.baseSize * 1.4;
            break;
          case 'pentagon':
          case 'hexagon':
          case 'octagon':
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
          case 'circle': {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'square': {
            const s = this.size * 1.6;
            ctx.fillRect(-s / 2, -s / 2, s, s);
            break;
          }
          case 'triangle': {
            const s = this.size * 2;
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, s / 2);
            ctx.lineTo(-s / 2, s / 2);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'diamond': {
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
          case 'ring': {
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 1.4, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'pentagon': {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 5; k++) {
              const ang = (Math.PI * 2 * k) / 5 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'hexagon': {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const ang = (Math.PI * 2 * k) / 6 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'octagon': {
            const r = this.size * 1.8;
            ctx.beginPath();
            for (let k = 0; k < 8; k++) {
              const ang = (Math.PI * 2 * k) / 8 - Math.PI / 2;
              const px = Math.cos(ang) * r;
              const py = Math.sin(ang) * r;
              if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
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
    let mouseX = 0, mouseY = 0, mouseActive = false;
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      mouseActive = true;
    };
    const onMouseLeave = () => { mouseActive = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    let firstFrameDone = false;
    const animate = () => {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      // 更新位置与尺寸
      particles.forEach((p) => p.update());

      // 鼠标靠近加速散开（径向推力，与首页一致）
      if (mouseActive) {
        const influenceR = 150; // 影响半径
        const forceBase = 0.12; // 基础加速度
        const maxSpeed = 1.4;   // 限制最大速度，避免失控
        for (const p of particles) {
          const dx = p.x - mouseX;
          const dy = p.y - mouseY;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && dist < influenceR) {
            const strength = 1 - (dist / influenceR);
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
        const keyOf = (x: number, y: number) => `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
        particles.forEach((p, i) => {
          const key = keyOf(p.x, p.y);
          const cell = grid.get(key);
          if (cell) cell.push(i); else grid.set(key, [i]);
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
                  const alpha = Math.max(0.05, (LINK_DISTANCE - dist) / LINK_DISTANCE * 0.40);
                  ctx.save();
                  ctx.globalAlpha = alpha;
                  ctx.strokeStyle = '#c4b5fd'; // 薰衣草紫的连线
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
                  p.x -= nx * sep; p.y -= ny * sep;
                  q.x += nx * sep; q.y += ny * sep;

                  const pNorm = p.speedX * nx + p.speedY * ny;
                  const qNorm = q.speedX * nx + q.speedY * ny;
                  const diff = qNorm - pNorm;
                  p.speedX += diff * nx; p.speedY += diff * ny;
                  q.speedX -= diff * nx; q.speedY -= diff * ny;

                  p.speedX *= 0.98; p.speedY *= 0.98;
                  q.speedX *= 0.98; q.speedY *= 0.98;
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
        try { setCanvasReady(true); } catch {}
      }

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  const events = [
    {
      title: "全球气候峰会",
      description: "讨论全球气候变化的应对策略",
      followers: 12842,
    },
    {
      title: "AI安全大会",
      description: "聚焦AI监管与安全问题",
      followers: 9340,
    },
    {
      title: "国际金融论坛",
      description: "探讨数字货币与未来经济",
      followers: 7561,
    },
    {
      title: "体育公益赛",
      description: "全球运动员联合助力慈善",
      followers: 5043,
    },
  ];

  // 从API获取预测事件数据
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取预测事件数据
  useEffect(() => {
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))
    const fetchWithRetry = async (url: string, opts: RequestInit = {}, retries = 2, baseDelay = 300) => {
      let attempt = 0
      while (true) {
        try {
          const res = await fetch(url, opts)
          return res
        } catch (err: any) {
          // 忽略 AbortError（热更新/页面切换常见），不进入失败状态
          if (err?.name === 'AbortError') {
            throw err
          }
          if (attempt >= retries) throw err
          const delay = baseDelay * Math.pow(2, attempt)
          await sleep(delay)
          attempt++
        }
      }
    }

    const fetchPredictions = async () => {
      try {
        setLoading(true);
        // 移除limit参数，获取所有事件数据；增加轻量重试与中断忽略
        const controller = new AbortController();
        const response = await fetchWithRetry('/api/predictions', { signal: controller.signal }, 2, 300);
        const result = await response.json();
        
        if (result.success) {
          setPredictions(result.data);
          setTotalEventsCount(result.data.length);
          // 确保displayCount不超过实际数据长度
          if (result.data.length < 6) {
            setDisplayCount(result.data.length);
          }
        } else {
          setError(result.message || '获取数据失败');
        }
      } catch (err) {
        // 热更新或主动取消时不显示失败
        if ((err as any)?.name === 'AbortError') {
          console.warn('预测列表请求已中止（可能由热更新触发）');
        } else {
          setError('网络请求失败');
          console.error('获取预测事件失败:', err);
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
        const ids = new Set<number>((data?.follows || []).map((e: any) => Number(e.id)));
        setFollowedEvents(ids);
      } catch (err) {
        console.warn('同步关注状态失败:', err);
      }
    })();
  }, [accountNorm]);

  

  // 将预测事件转换为页面显示格式（包含事件ID以便关注映射）
  const allEvents = useMemo(() => predictions.map(prediction => ({
    id: prediction.id,
    title: prediction.title,
    description: prediction.description,
    insured: `${prediction.min_stake} USDT`,
    minInvestment: `${prediction.min_stake} USDT`,
    tag: prediction.category,
    image: prediction.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(prediction.title)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`,
    deadline: prediction.deadline,
    criteria: prediction.criteria,
    followers_count: Number(prediction?.followers_count || 0)
  })), [predictions]);

  // 当分类计数接口不可用时，基于已加载的预测数据进行本地回退计算
  // 本地回退逻辑已移除，分类计数仅依赖后端 /api/categories/counts

  // 搜索与类型筛选
  const q = searchQuery.toLowerCase().trim();
  const hasQuery = q.length > 0;
  const hasCategory = !!selectedCategory;
  const filteredHeroEvents = heroEvents.filter(
    (e) =>
      (!hasQuery ||
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)) &&
      (!hasCategory || e.category === selectedCategory)
  );
  const filteredAllEvents = useMemo(() => allEvents.filter(
    (p) =>
      (!hasQuery ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tag || "").toLowerCase().includes(q)) &&
      (!hasCategory || (p.tag || "") === selectedCategory)
  ), [allEvents, hasQuery, q, hasCategory, selectedCategory]);
  const displayEvents = useMemo(() => (hasQuery || hasCategory ? filteredAllEvents : allEvents), [filteredAllEvents, allEvents, hasQuery, hasCategory]);
  const parseEth = (s: string) => parseFloat(String(s ?? '').replace(/[^0-9.]/g, '')) || 0;
  const sortedEvents = useMemo(() => [...displayEvents].sort((a, b) => {
    if (sortOption === 'minInvestment-asc') {
      return parseEth(a.minInvestment) - parseEth(b.minInvestment);
    }
    if (sortOption === 'insured-desc') {
      return parseEth(b.insured) - parseEth(a.insured);
    }
    return 0;
  }), [displayEvents, sortOption]);

  const bestEvent = useMemo(() => {
    const pool = displayEvents.filter(e => !selectedCategory || (String(e.tag || '') === String(selectedCategory)));
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
  }, [displayEvents, selectedCategory]);

  const heroSlideEvents = useMemo(() => {
    const pool = displayEvents.filter(e => !selectedCategory || (String(e.tag || '') === String(selectedCategory)));
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
    const tags = selectedCategory
      ? [String(selectedCategory)]
      : Array.from(new Set(pool.map(e => String(e.tag || '')).filter(Boolean)));
    const picks = tags.map(tag => {
      const group = pool.filter(e => String(e.tag || '') === tag);
      if (group.length === 0) return null as any;
      return [...group].sort(sorter)[0];
    }).filter(Boolean);
    return [...picks].sort(sorter);
  }, [displayEvents, selectedCategory]);

  const activeSlide = heroSlideEvents.length > 0 ? heroSlideEvents[currentHeroIndex % heroSlideEvents.length] : null;
  const fallbackIndex = heroEvents.length > 0 ? (currentHeroIndex % heroEvents.length) : 0;
  const activeTitle = activeSlide ? String(activeSlide?.title || '') : String(heroEvents[fallbackIndex]?.title || '');
  const activeDescription = activeSlide ? String(activeSlide?.description || '') : String(heroEvents[fallbackIndex]?.description || '');
  const activeImage = activeSlide ? String(activeSlide?.image || '') : String(heroEvents[fallbackIndex]?.image || '');
  const activeCategory = activeSlide ? String(activeSlide?.tag || '') : String(heroEvents[fallbackIndex]?.category || '');
  const activeFollowers = activeSlide ? Number(activeSlide?.followers_count || 0) : Number(heroEvents[fallbackIndex]?.followers || 0);

  const rtBadgeClass = rtStatus === 'SUBSCRIBED'
    ? 'bg-green-100 text-green-700 border-green-300'
    : (rtStatus === 'CHANNEL_ERROR' || rtStatus === 'CLOSED')
    ? 'bg-red-100 text-red-700 border-red-300'
    : (rtStatus === 'TIMED_OUT')
    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
    : 'bg-gray-100 text-gray-700 border-gray-300';

  const rtDotClass = rtStatus === 'SUBSCRIBED'
    ? 'bg-green-500'
    : (rtStatus === 'CHANNEL_ERROR' || rtStatus === 'CLOSED')
    ? 'bg-red-500'
    : (rtStatus === 'TIMED_OUT')
    ? 'bg-yellow-500'
    : 'bg-gray-400';

  // 展示模式：分页 或 滚动相关的重置逻辑
  useEffect(() => { setPage(0); }, [searchQuery, selectedCategory, sortOption]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const goPrevPage = () => setPage((p) => Math.max(0, p - 1));
  const goNextPage = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  useEffect(() => {
    let windowIds: number[] = [];
    if (viewMode === 'paginate') {
      const start = page * pageSize;
      const end = Math.min(sortedEvents.length, (page + 1) * pageSize);
      windowIds = sortedEvents.slice(start, end).map(e => Number(e?.id)).filter(Number.isFinite) as number[];
    } else {
      windowIds = sortedEvents.slice(0, Math.max(0, displayCount)).map(e => Number(e?.id)).filter(Number.isFinite) as number[];
    }
    const ids = Array.from(new Set(windowIds));
    if (ids.length === 0) return;
    if (!supabase || typeof (supabase as any).channel !== 'function') {
      setRtStatus('DISABLED');
      return;
    }

    const filterIn = `event_id=in.(${ids.join(',')})`;
    const channel = (supabase as any).channel('event_follows_trending');
    setRtStatus('CONNECTING');
    setRtFilter(filterIn);

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_follows', filter: filterIn }, (payload: any) => {
        const row = payload?.new || {};
        const eid = Number(row?.event_id);
        const uid = String(row?.user_id || '');
        if (!Number.isFinite(eid)) return;
        if (!accountNorm || (uid || '').toLowerCase() !== accountNorm) {
          setPredictions(prev => prev.map(p => p?.id === eid ? { ...p, followers_count: Number(p?.followers_count || 0) + 1 } : p));
        }
        if (accountNorm && (uid || '').toLowerCase() === accountNorm) {
          setFollowedEvents(prev => { const s = new Set(prev); s.add(eid); return s; });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_follows', filter: filterIn }, (payload: any) => {
        const row = payload?.old || {};
        const eid = Number(row?.event_id);
        const uid = String(row?.user_id || '');
        if (!Number.isFinite(eid)) return;
        if (!accountNorm || (uid || '').toLowerCase() !== accountNorm) {
          setPredictions(prev => prev.map(p => p?.id === eid ? { ...p, followers_count: Math.max(0, Number(p?.followers_count || 0) - 1) } : p));
        }
        if (accountNorm && (uid || '').toLowerCase() === accountNorm) {
          setFollowedEvents(prev => { const s = new Set(prev); s.delete(eid); return s; });
        }
      })
      .subscribe((status: string) => {
        setRtStatus(status || 'UNKNOWN');
      });

    return () => {
      (supabase as any).removeChannel(channel);
      setRtStatus('CLOSED');
    };
  }, [sortedEvents, viewMode, page, pageSize, displayCount, accountNorm]);

  // 近期浏览事件：从 localStorage 读取，展示最近在详情页浏览的事件
  const [recentViewed, setRecentViewed] = useState<Array<{ id: number; title: string; category: string; seen_at: string }>>([]);
  const [recentFilter, setRecentFilter] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('recent_events') : null;
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const norm = arr
          .filter((x: any) => Number.isFinite(Number(x?.id)))
          .map((x: any) => ({
            id: Number(x.id),
            title: String(x.title || ''),
            category: String(x.category || ''),
            seen_at: String(x.seen_at || new Date().toISOString())
          }));
        setRecentViewed(norm);
      }
    } catch {}
  }, []);

  function formatRelative(iso: string): string {
    const ts = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const m = 60 * 1000, h = 60 * m, d = 24 * h;
    if (diff < m) return '刚刚';
    if (diff < h) return `${Math.floor(diff / m)} 分钟前`;
    if (diff < d) return `${Math.floor(diff / h)} 小时前`;
    return `${Math.floor(diff / d)} 天前`;
  }

  function formatTimeLeft(deadlineIso?: string): { label: string; dot: string } {
    if (!deadlineIso) return { label: '未知', dot: 'bg-gray-400' };
    const end = new Date(deadlineIso).getTime();
    const now = Date.now();
    const diff = end - now;
    const m = 60 * 1000, h = 60 * m, d = 24 * h;
    if (diff <= 0) return { label: '已到期', dot: 'bg-gray-400' };
    if (diff < h) return { label: `${Math.ceil(diff / m)} 分钟`, dot: 'bg-red-500' };
    if (diff < 3 * d) return { label: `${Math.ceil(diff / h)} 小时`, dot: 'bg-yellow-500' };
    return { label: `${Math.ceil(diff / d)} 天`, dot: 'bg-green-500' };
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-pink-50 overflow-hidden text-black">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-500 ease-out ${canvasReady ? 'opacity-60' : 'opacity-0'}`}
      />
      {/* 背景装饰，与首页一致 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-xl"></div>
      </div>
      

      {/* 集成筛选栏 - 搜索、分类筛选、排序一体化 */}
      <div className="relative z-10 px-16 mt-6">
        {/* Realtime 状态指示已移除 */}
        {/* 搜索栏 */}
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm border border-purple-200 rounded-2xl px-4 py-3 shadow mb-4">
          <Search className="w-5 h-5 text-purple-600" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearchQuery(searchInput.trim());
                productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            placeholder="输入事件关键字，定位热点事件与产品"
            className="flex-1 bg-transparent outline-none text-black placeholder:text-gray-500"
          />
          <motion.button
            type="button"
            onClick={(e) => { 
              setSearchQuery(searchInput.trim()); 
              productsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              createSmartClickEffect(e);
            }}
            className="btn-base btn-sm btn-cta"
            aria-label="去探索"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            去探索
          </motion.button>
        </div>

        {/* 集成筛选栏 - 分类筛选 + 排序 + 重置 */}
        <div className="bg-white/90 backdrop-blur-sm border border-purple-200/60 rounded-2xl p-5 shadow-lg">
          <div className="space-y-6">
            {/* 分类筛选区域 */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-gray-800">分类筛选：</span>
                <div className="flex flex-wrap gap-2">
                  <motion.div
                    className={`text-sm px-4 py-2 rounded-full border-2 transition-all duration-200 font-medium relative overflow-hidden ${
                      selectedCategory === "" ? "btn-primary" : "btn-subtle"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    全部
                  </motion.div>
                  {Array.from(
                    new Set([
                      ...heroEvents.map((e) => e.category),
                      ...allEvents.map((p) => p.tag).filter(Boolean),
                    ])
                  ).map((cat) => {
                    // 根据分类名称设置对应的边框和文字颜色
                    let borderColor = "border-purple-300";
                    let textColor = "text-purple-700";
                    let hoverBorderColor = "hover:border-purple-400";
                    let hoverBgColor = "hover:bg-purple-50";
                    let activeGradient = "from-pink-500 to-purple-600";
                    
                    if (cat === "科技") {
                      borderColor = "border-blue-300";
                      textColor = "text-blue-700";
                      hoverBorderColor = "hover:border-blue-400";
                      hoverBgColor = "hover:bg-blue-50";
                      activeGradient = "from-blue-400 to-cyan-400";
                    } else if (cat === "娱乐") {
                      borderColor = "border-pink-300";
                      textColor = "text-pink-700";
                      hoverBorderColor = "hover:border-pink-400";
                      hoverBgColor = "hover:bg-pink-50";
                      activeGradient = "from-pink-400 to-rose-400";
                    } else if (cat === "时政") {
                      borderColor = "border-purple-300";
                      textColor = "text-purple-700";
                      hoverBorderColor = "hover:border-purple-400";
                      hoverBgColor = "hover:bg-purple-50";
                      activeGradient = "from-purple-400 to-indigo-400";
                    } else if (cat === "天气") {
                      borderColor = "border-green-300";
                      textColor = "text-green-700";
                      hoverBorderColor = "hover:border-green-400";
                      hoverBgColor = "hover:bg-green-50";
                      activeGradient = "from-green-400 to-emerald-400";
                    }
                    
                    return (
                      <motion.div
                        key={cat as string}
                        className={`text-sm px-4 py-2 rounded-full border-2 transition-all duration-200 font-medium relative overflow-hidden ${
                          selectedCategory === cat
                            ? `bg-gradient-to-r ${activeGradient} text-white border-transparent shadow-lg transform scale-105`
                            : `${borderColor} ${textColor} ${hoverBgColor} ${hoverBorderColor} hover:shadow-md`
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {cat as string}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 排序区域 - 垂直平行放置 */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-gray-800">排序：</span>
                <div className="flex flex-wrap gap-2">
                  <motion.button
                    onClick={(e) => {
                      setSortOption("default");
                      createSmartClickEffect(e);
                    }}
                    className={`text-sm px-4 py-2 rounded-full border-2 transition-all duration-200 font-medium relative overflow-hidden ${
                      sortOption === "default"
                        ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-lg transform scale-105"
                        : "border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-400 hover:shadow-md"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    默认
                  </motion.button>
                  <motion.button
                    onClick={(e) => {
                      setSortOption("minInvestment-asc");
                      createSmartClickEffect(e);
                    }}
                    className={`text-sm px-4 py-2 rounded-full border-2 transition-all duration-200 font-medium relative overflow-hidden ${
                      sortOption === "minInvestment-asc"
                        ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-lg transform scale-105"
                        : "border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-400 hover:shadow-md"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    起投最低(USDT)
                  </motion.button>
                  <motion.button
                    onClick={(e) => {
                      setSortOption("insured-desc");
                      createSmartClickEffect(e);
                    }}
                    className={`text-sm px-4 py-2 rounded-full border-2 transition-all duration-200 font-medium relative overflow-hidden ${
                      sortOption === "insured-desc"
                        ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-lg transform scale-105"
                        : "border-pink-300 text-pink-700 hover:bg-pink-50 hover:border-pink-400 hover:shadow-md"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    投保最多(USDT)
                  </motion.button>
                </div>
              </div>
            </div>

            {/* 右侧：重置按钮 */}
            <div className="flex items-center gap-4">
              {/* 重置按钮 */}
              <motion.button
                onClick={(e) => {
                  setSearchQuery("");
                  setSearchInput("");
                  setSelectedCategory("");
                  setSortOption("default");
                  setDisplayCount(9);
                  setSortOpen(false);
                  createSmartClickEffect(e);
                }}
                className="px-4 py-2.5 text-sm bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 rounded-xl border-2 border-gray-200 hover:border-gray-300 font-medium shadow-sm transition-all duration-200 relative overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                重置筛选
              </motion.button>
            </div>
          </div>

          {/* 筛选状态显示 */}
          {(selectedCategory || sortOption !== "default") && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 pt-4 border-t border-purple-100"
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-gray-700">当前筛选：</span>
                <div className="flex flex-wrap gap-2">
                  {selectedCategory && (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full font-medium shadow-sm">
                      📊 分类：{selectedCategory}
                    </span>
                  )}
                  {sortOption !== "default" && (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 rounded-full font-medium shadow-sm">
                      🔄 排序：{sortOption === "minInvestment-asc" ? "起投金额最低(USDT)" : "已投保最多(USDT)"}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 搜索结果提示 */}
        {searchQuery && filteredHeroEvents.length > 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredHeroEvents.slice(0, 8).map((ev) => (
              <motion.div
                key={ev.title}
                className="px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl transition-colors relative overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {ev.title}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      
        

        <div style={{ display: "none" }}>
        {/* 近期浏览事件 */}
        <div className="p-4">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">近期浏览事件</h3>
              {recentViewed.length > 0 && (
                <button
                  onClick={(e) => { try { window.localStorage.removeItem('recent_events'); setRecentViewed([]); } catch {}; createSmartClickEffect(e); }}
                  className="text-xs px-2 py-1 rounded-full bg-white/60 hover:bg-white text-black border border-gray-200"
                >清空</button>
              )}
            </div>
          )}
          <div className="space-y-2">
            {recentViewed.length > 0 && !sidebarCollapsed && (() => {
              const sorted = [...recentViewed].sort((a, b) => new Date(b.seen_at).getTime() - new Date(a.seen_at).getTime());
              const last = sorted[0];
              const lastSeenText = formatRelative(last.seen_at);
              const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
              const count7d = sorted.filter((x) => new Date(x.seen_at).getTime() >= sevenDaysAgo).length;
              const categoryCounts = new Map<string, number>();
              for (const x of sorted) {
                const key = x.category || '未知';
                categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
              }
              const uniqueCategories = categoryCounts.size;
              const topCategory = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知';
              return (
                <>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRecentFilter(null); createSmartClickEffect(e); }}
                      className={`text-xs px-2 py-1 rounded-full border ${recentFilter === null ? 'bg-purple-200 text-purple-700 border-transparent' : 'bg-white/60 text-black border-gray-200 hover:bg-white'}`}
                    >全部</button>
                    {Array.from(categoryCounts.keys()).map((cat) => (
                      <button
                        key={cat}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRecentFilter(cat); createSmartClickEffect(e); }}
                        className={`text-xs px-2 py-1 rounded-full border ${recentFilter === cat ? 'bg-purple-200 text-purple-700 border-transparent' : 'bg-white/60 text-black border-gray-200 hover:bg-white'}`}
                      >{cat}</button>
                    ))}
                  </div>
                  <Link href={`/prediction/${last.id}`}>
                    <motion.div
                      className="flex items-center p-3 rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/50 bg-gradient-to-r from-purple-100 to-pink-100 justify-between"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { const color = last.category === '科技' ? '#3B82F6' : last.category === '娱乐' ? '#EC4899' : last.category === '时政' ? '#8B5CF6' : last.category === '天气' ? '#10B981' : '#8B5CF6'; createHeartParticlesForCategory(e.nativeEvent as MouseEvent, color); createSmartClickEffect(e); }}
                      title="继续浏览上次查看的事件"
                    >
                      <div className="flex items-center">
                        <span className="text-lg">
                          {last.category === '科技' ? '🚀' : last.category === '娱乐' ? '🎬' : last.category === '时政' ? '🏛️' : last.category === '天气' ? '🌤️' : '📊'}
                        </span>
                        <div className="ml-3">
                          <span className="text-black font-medium block truncate max-w-[12rem]">{last.title}</span>
                          <span className="text-xs text-gray-600">继续浏览 · {formatRelative(last.seen_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded-full">上次</span>
                        <ChevronRight className="w-4 h-4 text-purple-600" />
                      </div>
                    </motion.div>
                  </Link>
                </>
              );
            })()}
            {recentViewed.length > 0 ? (() => {
              const base = [...recentViewed].sort((a, b) => new Date(b.seen_at).getTime() - new Date(a.seen_at).getTime());
              const filtered = recentFilter ? base.filter((x) => x.category === recentFilter) : base;
              const take = filtered.slice(0, 6);
              return take.map((ev) => (
                <Link key={ev.id} href={`/prediction/${ev.id}`}>
                  <motion.div
                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/50 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => { const color = ev.category === '科技' ? '#3B82F6' : ev.category === '娱乐' ? '#EC4899' : ev.category === '时政' ? '#8B5CF6' : ev.category === '天气' ? '#10B981' : '#8B5CF6'; createHeartParticlesForCategory(e.nativeEvent as MouseEvent, color); createSmartClickEffect(e); }}
                  >
                    <div className="flex items-center">
                      <span className="text-lg">
                        {ev.category === '科技' ? '🚀' : ev.category === '娱乐' ? '🎬' : ev.category === '时政' ? '🏛️' : ev.category === '天气' ? '🌤️' : '📊'}
                      </span>
                      {!sidebarCollapsed && (
                        <div className="ml-3">
                          <span className="text-black font-medium block truncate max-w-[12rem]">{ev.title}</span>
                          <span className="text-xs text-gray-600">{formatRelative(ev.seen_at)}</span>
                        </div>
                      )}
                    </div>
                    {!sidebarCollapsed && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-purple-100 text-black px-2 py-1 rounded-full">{ev.category || '未知'}</span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              const next = recentViewed.filter((x) => x.id !== ev.id);
                              setRecentViewed(next);
                              if (typeof window !== 'undefined') {
                                window.localStorage.setItem('recent_events', JSON.stringify(next));
                              }
                            } catch {}
                            createSmartClickEffect(e);
                          }}
                          className="text-[11px] px-2 py-1 rounded-full bg-white/60 hover:bg-white border border-gray-200 text-gray-700"
                          title="从近期浏览移除"
                        >移除</button>
                      </div>
                    )}
                  </motion.div>
                </Link>
              ));
            })() : null}

            {recentViewed.length === 0 && (
              <motion.div
                className={`flex items-center p-3 rounded-xl transition-all duration-300 hover:bg-white/50 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title="暂无近期浏览记录"
              >
                <div className="flex items-center">
                  <span className="text-lg">📭</span>
                  {!sidebarCollapsed && (
                    <div className="ml-3">
                      <span className="text-black font-medium block">无浏览记录</span>
                      <span className="text-xs text-gray-600">浏览事件后将显示在此处</span>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">近期浏览</span>
                )}
              </motion.div>
            )}
          </div>
          {/* 我的活动 */}
          <div className="mt-4">
            {!sidebarCollapsed && (
              <h3 className="text-sm font-semibold text-black mb-2 uppercase tracking-wide">我的活动</h3>
            )}
            <div className="space-y-2">
              {(activityLog.slice(0, 6)).map((act, i) => (
                <Link key={`${act.id}_${act.ts}_${i}`} href={act.type === 'visit' ? `/prediction/${act.id}` : `/prediction/${act.id}`}>
                  <motion.div
                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/50 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    title={act.title}
                  >
                    <div className="flex items-center">
                      <span className="text-lg">
                        {act.type === 'follow' ? '❤️' : act.type === 'unfollow' ? '💔' : '👀'}
                      </span>
                      {!sidebarCollapsed && (
                        <div className="ml-3">
                          <span className="text-black font-medium block truncate max-w-[12rem]">
                            {act.type === 'follow' ? '关注了 ' : act.type === 'unfollow' ? '取消关注 ' : '浏览了 '}{act.title}
                          </span>
                          <span className="text-xs text-gray-600">{formatRelative(act.ts)}</span>
                        </div>
                      )}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="text-xs bg-purple-100 text-black px-2 py-1 rounded-full">{act.category || '事件'}</span>
                    )}
                  </motion.div>
                </Link>
              ))}
              {activityLog.length === 0 && (
                <div className="text-xs text-gray-600 px-3 py-2">暂无活动记录</div>
              )}
            </div>
          </div>
        </div>
        </div>

        <div style={{ display: "none" }}>
        {/* 我的关注 */}
        <div className="p-4 border-t border-gray-200/50">
          {!sidebarCollapsed && (
            <h3 className="text-sm font-semibold text-black mb-3 uppercase tracking-wide">
              我的关注
            </h3>
          )}
          <Link href="/my-follows">
            <motion.div
              className={`flex items-center p-3 rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/50 bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200 ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title={`我的关注（${followedEvents.size}）`}
            >
              <div className="flex items-center">
                <Heart className="w-5 h-5 text-purple-600" />
                {!sidebarCollapsed && (
                  <div className="ml-3">
                    <span className="text-black font-medium block">
                      查看我的关注
                    </span>
                    <span className="text-xs text-gray-600">管理关注的事件</span>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded-full">
                    {followedEvents.size} 项
                  </span>
                  <ChevronRight className="w-4 h-4 text-purple-600" />
                </div>
              )}
            </motion.div>
          </Link>
        </div>
        </div>

        <div style={{ display: "none" }}>
        {/* 快捷筛选 */}
        <div className="p-4 border-t border-gray-200/50">
          {!sidebarCollapsed && (
            <h3 className="text-sm font-semibold text-black mb-3 uppercase tracking-wide">快捷筛选</h3>
          )}
          <div className={`grid ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
            <motion.button
              onClick={(e) => { setSelectedCategory(""); createSmartClickEffect(e); }}
              className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-xl border transition-all duration-300 ${selectedCategory === "" ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-white/40' : 'bg-white/50 text-black border-gray-200 hover:bg-white/70'}`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              aria-label="筛选 全部"
            >
              <ChevronsUpDown className="w-4 h-4" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">全部</span>
              )}
              {!sidebarCollapsed && (
                <span className="text-xs text-gray-600">{sortedEvents.length} 个</span>
              )}
            </motion.button>

            {categories.map((cat) => (
              <motion.button
                key={cat.name}
                onClick={(e) => { setSelectedCategory(cat.name); createSmartClickEffect(e); }}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} p-2 rounded-xl border transition-all duration-300 ${selectedCategory === cat.name ? 'bg-gradient-to-r ' + cat.color + ' text-white border-white/40' : 'bg-white/50 text-black border-gray-200 hover:bg-white/70'}`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                aria-label={`筛选 ${cat.name}`}
                title={cat.name}
              >
                <span className="text-lg">{cat.icon}</span>
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{cat.name}</span>
                )}
                {!sidebarCollapsed && (
                  <span className="text-xs text-gray-600">{categoryCounts[cat.name] || 0} 个</span>
                )}
              </motion.button>
            ))}
          </div>
        </div>
        </div>

        <div style={{ display: "none" }}>
        {/* 未结算事件（依据真实数据） */}
        <div className="p-4 border-t border-gray-200/50">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">未结算事件</h3>
              <div className="flex items-center gap-2 bg-white/60 border border-gray-200 rounded-full p-1">
                <button
                  onClick={(e) => { setPendingMode('soon'); createSmartClickEffect(e); }}
                  className={`text-xs px-2 py-1 rounded-full ${pendingMode === 'soon' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'text-black hover:bg-white'}`}
                >临近截止</button>
                <button
                  onClick={(e) => { setPendingMode('popular'); createSmartClickEffect(e); }}
                  className={`text-xs px-2 py-1 rounded-full ${pendingMode === 'popular' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'text-black hover:bg-white'}`}
                >关注最多</button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {(pendingMode === 'soon'
              ? predictions
                  .filter(p => (p?.status || 'active') === 'active')
                  .sort((a, b) => new Date(a?.deadline || 0).getTime() - new Date(b?.deadline || 0).getTime())
              : predictions
                  .filter(p => (p?.status || 'active') === 'active')
                  .sort((a, b) => Number(b?.followers_count || 0) - Number(a?.followers_count || 0))
            )
              .slice(0, 6)
              .map((p) => {
                const tl = formatTimeLeft(String(p?.deadline || ''));
                const lineColor = (tl.dot || 'bg-gray-400').replace('bg-', 'text-');
                return (
                  <Link key={p.id} href={`/prediction/${p.id}`}>
                    <motion.div
                      className={`flex items-center p-3 rounded-xl cursor-pointer transition-all duration-300 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center">
                        <div className={`${tl.dot} w-1 h-6 rounded mr-2`} />
                        <TrendingUp className={`w-4 h-4 ${tl.dot.replace('bg-', 'text-')}`} />
                        {!sidebarCollapsed && (
                          <div className="ml-3">
                            <p className="text-sm font-medium text-black truncate max-w-[12rem]">{p.title}</p>
                            {pendingMode === 'soon' ? (
                              <p className="text-xs text-black">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full mr-2 ${tl.dot === 'bg-red-500' ? 'bg-red-500/20 text-red-600' : tl.dot === 'bg-yellow-500' ? 'bg-yellow-500/20 text-yellow-600' : tl.dot === 'bg-green-500' ? 'bg-green-500/20 text-green-600' : 'bg-gray-400/20 text-gray-600'}`}>剩余 {tl.label}</span>
                                · {Number(p?.followers_count || 0)} 人关注
                              </p>
                            ) : (
                              <p className="text-xs text-black">{Number(p?.followers_count || 0)} 人关注 · 截止 {new Date(p?.deadline || Date.now()).toLocaleDateString()}</p>
                            )}
                          </div>
                        )}
                      </div>
                      {!sidebarCollapsed && (
                        <div className={`w-2 h-2 rounded-full ${tl.dot} ${(tl.dot || '').includes('bg-red-500') ? 'animate-pulse' : ''}`} />
                      )}
                    </motion.div>
                  </Link>
                );
              })}
          </div>
        </div>
        </div>

        <div style={{ display: "none" }}>
        {/* 平台数据统计 */}
        <div className="p-4 border-t border-gray-200/50">
          {!sidebarCollapsed && (
            <h3 className="text-sm font-semibold text-black mb-3 uppercase tracking-wide">
              平台数据
            </h3>
          )}
          <div className="space-y-3">
            <div
              className={`flex items-center p-3 rounded-xl bg-gradient-to-r from-purple-100 to-pink-100 ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-black" />
              {!sidebarCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-black">事件总数</p>
                  <p className="text-xs text-black">1,234</p>
                </div>
              )}
            </div>

            <div
              className={`flex items-center p-3 rounded-xl bg-gradient-to-r from-purple-100 to-pink-100 ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              }`}
            >
              <TrendingUp className="w-4 h-4 text-black" />
              {!sidebarCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-black">活跃事件</p>
                  <p className="text-xs text-black">876</p>
                </div>
              )}
            </div>

            <div
              className={`flex items-center p-3 rounded-xl bg-gradient-to-r from-purple-100 to-pink-100 ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              }`}
            >
              <Users className="w-4 h-4 text-black" />
              {!sidebarCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-black">累计关注数</p>
                  <p className="text-xs text-black">12,540</p>
                </div>
              )}
            </div>

            <div className={`flex items-center p-3 rounded-xl bg-gradient-to-r from-purple-100 to-pink-100 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
              <Flame className="w-4 h-4 text-red-600" />
              {!sidebarCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-black">24小时新增事件</p>
                  <p className="text-xs text-black">18</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        <div style={{ display: "none" }}>
        {/* 快速操作 */}
        <div className="p-4 border-t border-gray-200/50 mt-auto">
          <div className="space-y-2">
            <button className="btn-base btn-md btn-cta w-full flex items-center justify-center">
              <Wallet className="w-4 h-4 mr-2" />
              {!sidebarCollapsed && "立即投保"}
            </button>
            <button className="btn-base btn-md btn-cta w-full flex items-center justify-center">
              <Gift className="w-4 h-4 mr-2" />
              {!sidebarCollapsed && "领取奖励"}
            </button>
          </div>
        </div>
        </div>
      

      {/* 修改后的英雄区 - 轮播显示 */}
      <section className="relative z-10 flex flex-col md:flex-row items-center justify-between px-16 py-20 mt-20">
        <div className="w-full md:w-1/2 mb-10 md:mb-0 relative">
          <div className={`relative h-80 rounded-2xl shadow-xl overflow-hidden ${activeSlide?.id ? 'cursor-pointer' : ''}`} onClick={() => { if (activeSlide?.id) router.push(`/prediction/${activeSlide.id}`); }}>
            <motion.img
              key={String((activeSlide && (activeSlide?.id || activeSlide?.title)) || currentHeroIndex)}
              src={activeImage}
              alt={activeTitle}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/20 to-transparent" onClick={() => { if (activeSlide?.id) router.push(`/prediction/${activeSlide.id}`); }} />
            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
              <div className="max-w-md">
                <h3 className="font-bold text-white text-lg mb-1">{activeTitle}</h3>
                <p className="text-white/85 text-sm mb-2 line-clamp-2">{activeDescription}</p>
                <span className="text-white font-bold">{activeFollowers.toLocaleString()} 人关注</span>
              </div>
              <button className="px-4 py-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-full text-sm font-medium">立即关注</button>
            </div>
          </div>
        </div>

        {/* 右侧专题板块 */}
        <div className="w-full md:w-1/2 pl-0 md:pl-12">
          <h2 className="text-3xl font-bold text-black mb-6 text-center md:text-left">
            热门专题
          </h2>
          <div className="grid grid-cols-2 gap-4" style={{ ['overflowAnchor' as any]: 'none' }}>
            {categories.map((category, index) => {
              const isActive = (String(activeCategory || '') === category.name);
              const categoryEvents = allEvents.filter(
                (event) => event.tag === category.name
              );

              return (
                <motion.div
                  key={category.name}
                  className={`relative p-4 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r " +
                        category.color +
                        " text-white scale-105"
                      : "bg-white/70 text-gray-700 hover:bg-white/90"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  tabIndex={-1}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const y = typeof window !== 'undefined' ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
                    const idx = heroSlideEvents.findIndex((ev: any) => String(ev?.tag || '') === category.name);
                    if (idx >= 0) {
                      setCurrentHeroIndex(idx);
                    } else {
                      const fallbackIdx = heroEvents.findIndex((ev) => ev.category === category.name);
                      if (fallbackIdx >= 0) setCurrentHeroIndex(fallbackIdx);
                    }
                    if (typeof window !== 'undefined') {
                      requestAnimationFrame(() => {
                        window.scrollTo({ top: y, behavior: 'auto' });
                      });
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{category.icon}</span>
                      <div>
                        <h3 className="font-bold text-lg">{category.name}</h3>
                        <p className="text-sm opacity-80">
                          {categoryCounts[category.name] || 0}个热点
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-3 h-3 bg-white rounded-full"
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
        style={{ contentVisibility: 'auto', containIntrinsicSize: '1000px' }}
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
                <div className="flex items-center justify-between mb-3">
                  <div className="inline-flex rounded-xl overflow-hidden border bg-white/70">
                    <button onClick={() => setViewMode('paginate')} className={`px-3 py-1 text-sm ${viewMode === 'paginate' ? 'bg-purple-600 text-white' : 'text-black'}`}>分页</button>
                    <button onClick={() => setViewMode('scroll')} className={`px-3 py-1 text-sm ${viewMode === 'scroll' ? 'bg-purple-600 text-white' : 'text-black'}`}>滚动</button>
                  </div>
                  {viewMode === 'paginate' ? (
                    <div className="flex items-center gap-2">
                      <button onClick={goPrevPage} className="px-3 py-1 rounded-xl border bg-white/70">上一页</button>
                      <span className="text-sm text-black">第 {page + 1} / {Math.max(1, Math.ceil(sortedEvents.length / pageSize))} 页</span>
                      <button onClick={goNextPage} className="px-3 py-1 rounded-xl border bg-white/70">下一页</button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">自动加载更多</div>
                  )}
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedEvents.slice(
                  viewMode === 'paginate' ? page * pageSize : 0,
                  viewMode === 'paginate' ? Math.min(sortedEvents.length, (page + 1) * pageSize) : displayCount
                ).map((product, i) => {
                  const globalIndex = viewMode === 'paginate' ? i + page * pageSize : i;
                  return (
                <motion.div
                  key={sortedEvents[globalIndex]?.id || globalIndex}
                  className="bg-white/70 rounded-2xl shadow-md border border-white/30 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 relative transform-gpu"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
                      animate={followedEvents.has(Number(sortedEvents[globalIndex]?.id)) ? "liked" : "unliked"}
                      variants={{
                        liked: { 
                          backgroundColor: "rgba(239, 68, 68, 0.1)",
                          transition: { duration: 0.3 }
                        },
                        unliked: { 
                          backgroundColor: "rgba(255, 255, 255, 0.9)",
                          transition: { duration: 0.3 }
                        }
                      }}
                    >
                      <motion.div
                        animate={followedEvents.has(Number(sortedEvents[globalIndex]?.id)) ? "liked" : "unliked"}
                        variants={{
                          liked: { 
                            scale: [1, 1.2, 1],
                            transition: { 
                              duration: 0.6,
                              ease: "easeInOut"
                            }
                          },
                          unliked: { 
                            scale: 1,
                            transition: { duration: 0.3 }
                          }
                        }}
                      >
                        <Heart 
                          className={`w-5 h-5 ${
                            followedEvents.has(Number(sortedEvents[globalIndex]?.id)) 
                              ? 'fill-red-500 text-red-500' 
                              : 'text-gray-500'
                          }`} 
                        />
                      </motion.div>
                    </motion.button>
                  )}
                  
                  {/* 产品图片：仅在存在有效 id 时可点击跳转 */}
                  {Number.isFinite(Number(sortedEvents[globalIndex]?.id)) ? (
                    <Link href={`/prediction/${sortedEvents[globalIndex]?.id}`}>
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={product.image}
                          alt={product.title}
                          loading="lazy"
                          decoding="async"
                          width={800}
                          height={384}
                          className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.onerror = null;
                            img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(product.title)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
                          }}
                        />
                        <div className="absolute top-3 right-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white text-sm px-3 py-1 rounded-full">
                          {product.tag}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="relative h-48 overflow-hidden">
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
                          img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(product.title)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
                        }}
                      />
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white text-sm px-3 py-1 rounded-full">
                        {product.tag}
                      </div>
                    </div>
                  )}

                  {/* 产品信息 */}
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-black text-xl">
                        {product.title}
                      </h4>
                      <span className="text-black text-sm bg-gray-100 px-2 py-1 rounded">
                        已投保: {product.insured}
                      </span>
                    </div>

                    <p className="text-black text-sm mb-4">{product.description}</p>

                    <div className="flex justify-between items-center mb-2">
                      <p className="text-black font-bold">
                        {product.minInvestment} 起投
                      </p>
                      {Number.isFinite(Number(sortedEvents[globalIndex]?.id)) && (
                        <Link href={`/prediction/${sortedEvents[globalIndex]?.id}`}>
                          <button className="px-4 py-2 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-full text-sm font-medium hover:from-pink-500 hover:to-purple-600 transition-all duration-300 shadow-md">
                            参与事件
                          </button>
                        </Link>
                      )}
                    </div>
                    
                    {/* 关注数显示 */}
                    <div className="flex items-center text-gray-500 text-sm">
                      <Heart className="w-4 h-4 mr-1" />
                      <span>{sortedEvents[globalIndex]?.followers_count || 0} 人关注</span>
                    </div>
                  </div>
                </motion.div>
              );
                })}
            </div>
              </>
            )}
            
            {/* 加载更多提示 */}
            {viewMode === 'scroll' && displayCount < totalEventsCount && (
              <div className="text-center mt-10">
                <p className="text-black text-sm">继续下滑加载更多事件...</p>
              </div>
            )}
          </>
        )}
      </section>

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
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">登录后您可以：</h4>
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
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15)"
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ 
              type: "spring", 
              stiffness: 400, 
              damping: 17 
            }}
          >
            {/* 背景质感效果 */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-pink-100/40 group-hover:from-white/60 group-hover:to-pink-100/60 transition-all duration-300"></div>
            
            {/* 箭头图标 */}
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <div className="animate-bounce">
                <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15"/>
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
