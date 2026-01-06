"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { PortfolioStats, ProfileHistoryItem, ProfilePosition } from "../types";

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

  const results = useQueries({
    queries: [
      {
        queryKey: ["profile", "info", account],
        queryFn: async () => {
          if (!account) return null;
          const res = await fetch(`/api/user-profiles?address=${encodeURIComponent(account)}`);
          if (!res.ok) throw new Error("Failed to fetch profile");
          const data = await res.json().catch(() => ({}));
          return data.profile || null;
        },
        enabled: !!account,
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["profile", "history", account],
        queryFn: async () => {
          if (!account) return [];
          const res = await fetch(`/api/history?address=${encodeURIComponent(account)}`);
          if (!res.ok) throw new Error("Failed to fetch history");
          const data = await res.json().catch(() => ({}));
          return data.history || [];
        },
        enabled: !!account,
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: ["profile", "portfolio", account],
        queryFn: async () => {
          if (!account) return null;
          const res = await fetch(`/api/user-portfolio?address=${encodeURIComponent(account)}`);
          if (!res.ok) throw new Error("Failed to fetch portfolio");
          const data = await res.json().catch(() => ({}));
          const positions = Array.isArray(data.positions) ? data.positions : [];
          return {
            positions,
            positionsCount: positions.length,
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
    ],
  });

  const [infoQuery, historyQuery, portfolioQuery] = results;

  const info = infoQuery.data;
  const history = (historyQuery.data || []) as ProfileHistoryItem[];
  const positions = (portfolioQuery.data?.positions || []) as ProfilePosition[];
  const portfolioStats: PortfolioStats | null = portfolioQuery.data?.stats || null;
  const positionsCount = portfolioQuery.data?.positionsCount || 0;

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

  const setHistory = (newHistory: any[] | ((prev: any[]) => any[])) => {
    console.warn("setHistory is deprecated, use mutation instead");
  };

  return {
    history,
    setHistory,
    username,
    positions,
    portfolioStats,
    positionsCount,
    isLoading: results.some((r) => r.isLoading),
    historyLoading: historyQuery.isLoading,
    portfolioLoading: portfolioQuery.isLoading,
    historyError: historyQuery.isError,
    portfolioError: portfolioQuery.isError,
    refetch: () => results.forEach((r) => r.refetch()),
  };
}
