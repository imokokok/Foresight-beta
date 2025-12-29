"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { buildLeaderboardJsonLd, transformLeaderboardData, type LeaderboardUser } from "./data";
import { LeaderboardPageView } from "./components/LeaderboardPageView";
import GradientPage from "@/components/ui/GradientPage";
import { useTranslations } from "@/lib/i18n";

// 分页配置
const INITIAL_LOAD = 20; // 首屏加载条数
const PAGE_SIZE = 30; // 每次加载更多的条数
const MAX_LOAD = 100; // 最大加载条数

export default function LeaderboardPage() {
  const t = useTranslations("leaderboard");
  const [timeRange, setTimeRange] = useState("weekly");
  const [category, setCategory] = useState("profit");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayCount, setDisplayCount] = useState(INITIAL_LOAD);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // 获取排行榜数据
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      setDisplayCount(INITIAL_LOAD); // 切换时重置显示条数
      try {
        // 首次加载获取足够的数据，传入 category 参数
        const res = await fetch(
          `/api/leaderboard?range=${timeRange}&category=${category}&limit=${MAX_LOAD}`
        );
        const data = await res.json();
        if (data.leaderboard && Array.isArray(data.leaderboard)) {
          const transformed = transformLeaderboardData(data.leaderboard);
          setLeaderboardData(transformed);
          setTotalLoaded(transformed.length);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [timeRange, category]); // 添加 category 依赖

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (loadingMore || displayCount >= totalLoaded) return;

    setLoadingMore(true);
    // 模拟加载延迟，提供更好的 UX 反馈
    setTimeout(() => {
      setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, totalLoaded));
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, displayCount, totalLoaded]);

  // 根据搜索词过滤数据
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return leaderboardData;
    }
    const query = searchQuery.toLowerCase().trim();
    return leaderboardData.filter((user) => {
      const username = (user.username || user.name || "").toLowerCase();
      const walletAddress = (user.wallet_address || "").toLowerCase();
      return username.includes(query) || walletAddress.includes(query);
    });
  }, [leaderboardData, searchQuery]);

  // 计算是否还有更多数据（搜索时基于过滤后的数据）
  const effectiveTotal = searchQuery.trim() ? filteredData.length : totalLoaded;
  const hasMore = displayCount < effectiveTotal;

  // 根据 displayCount 切片数据
  const displayedData = useMemo(
    () => filteredData.slice(0, displayCount),
    [filteredData, displayCount]
  );
  const topThree = useMemo(
    () => (searchQuery.trim() ? [] : displayedData.slice(0, 3)),
    [displayedData, searchQuery]
  );
  const restRank = useMemo(
    () => (searchQuery.trim() ? displayedData : displayedData.slice(3)),
    [displayedData, searchQuery]
  );
  const jsonLd = useMemo(() => buildLeaderboardJsonLd(leaderboardData), [leaderboardData]);

  // 加载状态
  if (loading && leaderboardData.length === 0) {
    return (
      <GradientPage className="w-full relative overflow-hidden font-sans min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
          <p className="text-gray-500 font-medium">{t("loadingData")}</p>
        </div>
      </GradientPage>
    );
  }

  return (
    <LeaderboardPageView
      timeRange={timeRange}
      category={category}
      onTimeRangeChange={setTimeRange}
      onCategoryChange={setCategory}
      topThree={topThree}
      restRank={restRank}
      allUsers={leaderboardData}
      jsonLd={jsonLd}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={handleLoadMore}
      displayCount={displayCount}
      totalCount={effectiveTotal}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );
}
