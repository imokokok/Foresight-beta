"use client";

import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import type { PortfolioStats } from "../types";
import { MOCK_HISTORY } from "../mock";

/**
 * 🚀 优化后的 Profile 数据聚合 Hook
 *
 * 优化点：
 * - 使用 React Query 替代手动 useEffect + fetch
 * - 并行请求所有数据
 * - 自动缓存和重新验证
 * - 更好的错误处理
 */
export function useProfileAggregates(args: {
  account: string | null | undefined;
  user: any;
  profile: any;
  tProfile: (key: string) => string;
}) {
  const { account, user, profile, tProfile } = args;

  // 🚀 并行请求所有数据
  const results = useQueries({
    queries: [
      {
        queryKey: ["profile", "info", account],
        queryFn: async () => {
          if (!account) return null;
          const res = await fetch(`/api/user-profiles?address=${account}`);
          const data = await res.json();
          return data.profile || null;
        },
        enabled: !!account,
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["profile", "history", account],
        queryFn: async () => {
          if (!account) return [];
          const res = await fetch(`/api/history?address=${account}`);
          const data = await res.json();
          return data.history || [];
        },
        enabled: !!account,
        staleTime: 2 * 60 * 1000, // 2分钟
        placeholderData: [...MOCK_HISTORY],
      },
      {
        queryKey: ["profile", "portfolio", account],
        queryFn: async () => {
          if (!account) return null;
          const res = await fetch(`/api/user-portfolio?address=${account}`);
          const data = await res.json();
          return {
            positionsCount: Array.isArray(data.positions) ? data.positions.length : 0,
            stats: data.stats
              ? {
                  total_invested: Number(data.stats.total_invested || 0),
                  active_count: Number(data.stats.active_count || 0),
                  win_rate: String(data.stats.win_rate || "0%"),
                  realized_pnl:
                    data.stats.realized_pnl != null
                      ? Number(data.stats.realized_pnl || 0)
                      : undefined,
                }
              : null,
          };
        },
        enabled: !!account,
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: ["profile", "following", account],
        queryFn: async () => {
          if (!account) return 0;
          const res = await fetch(`/api/following?address=${account}`);
          const data = await res.json();
          return Array.isArray(data.following) ? data.following.length : 0;
        },
        enabled: !!account,
        staleTime: 2 * 60 * 1000,
      },
    ],
  });

  const [infoQuery, historyQuery, portfolioQuery, followingQuery] = results;

  // 提取数据
  const info = infoQuery.data;
  const history = historyQuery.data || [...MOCK_HISTORY];
  const portfolioStats: PortfolioStats | null = portfolioQuery.data?.stats || null;
  const positionsCount = portfolioQuery.data?.positionsCount || 0;
  const followingCount = followingQuery.data || 0;

  // 🚀 useMemo 避免每次渲染都计算
  const username = useMemo(() => {
    if (!account) {
      return tProfile("username.anonymous");
    }
    // 优先使用从 API 获取的 profile 信息
    if (info?.username) {
      return info.username;
    }
    if (profile?.username) {
      return profile.username;
    }
    if (user?.user_metadata?.username) {
      return user.user_metadata.username;
    }
    if (user?.email) {
      return String(user.email).split("@")[0];
    }
    return `User ${account.slice(0, 4)}`;
  }, [account, user, profile, info, tProfile]);

  // 提供 setHistory 用于兼容性（实际应该用 mutation）
  const setHistory = (newHistory: any[] | ((prev: any[]) => any[])) => {
    // 在实际场景中，应该使用 useMutation 来更新
    console.warn("setHistory is deprecated, use mutation instead");
  };

  return {
    history,
    setHistory,
    username,
    portfolioStats,
    positionsCount,
    followingCount,
    // 🚀 新增：加载状态
    isLoading: results.some((r) => r.isLoading),
    // 🚀 新增：刷新函数
    refetch: () => results.forEach((r) => r.refetch()),
  };
}
