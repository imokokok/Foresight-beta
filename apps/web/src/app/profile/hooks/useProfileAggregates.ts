import { useMemo } from "react";
import { useUserPortfolio, useUserProfileInfo, useUserHistory } from "@/hooks/useQueries";
import type { AuthUser } from "@/contexts/AuthContext";
import type { UserProfile } from "@/lib/supabase";
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
  account: string | null;
  user: AuthUser | null;
  profile: UserProfile | null | undefined;
  tProfile: (key: string) => string;
}) {
  const { account, user, profile, tProfile } = args;

  const infoQuery = useUserProfileInfo(account);
  const historyQuery = useUserHistory(account);
  const portfolioQuery = useUserPortfolio(account);

  const info = infoQuery.data?.profile || null;
  const history = historyQuery.data || [];
  const rawPortfolio = portfolioQuery.data;
  const positions = Array.isArray(rawPortfolio?.positions)
    ? (rawPortfolio?.positions as ProfilePosition[])
    : [];
  const portfolioStats: PortfolioStats | null = rawPortfolio?.stats
    ? {
        total_invested: Number(rawPortfolio.stats.total_invested || 0),
        active_count: Number(rawPortfolio.stats.active_count || 0),
        win_rate: String(rawPortfolio.stats.win_rate || "0%"),
        realized_pnl:
          rawPortfolio.stats.realized_pnl != null
            ? Number(rawPortfolio.stats.realized_pnl || 0)
            : undefined,
      }
    : null;
  const positionsCount = positions.length;

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

  const setHistory = (_newHistory: any[] | ((prev: any[]) => any[])) => {
    console.warn("setHistory is deprecated, use mutation instead");
  };

  return {
    history,
    setHistory,
    username,
    positions,
    portfolioStats,
    positionsCount,
    isLoading: infoQuery.isLoading || historyQuery.isLoading || portfolioQuery.isLoading,
    historyLoading: historyQuery.isLoading,
    portfolioLoading: portfolioQuery.isLoading,
    historyError: historyQuery.isError,
    portfolioError: portfolioQuery.isError,
    refetch: () => {
      infoQuery.refetch();
      historyQuery.refetch();
      portfolioQuery.refetch();
    },
  };
}
