"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  buildLeaderboardJsonLd,
  transformLeaderboardData,
  type LeaderboardUser,
} from "./data";
import { LeaderboardPageView } from "./components/LeaderboardPageView";
import GradientPage from "@/components/ui/GradientPage";

export default function LeaderboardPage() {
  const [timeRange, setTimeRange] = useState("weekly");
  const [category, setCategory] = useState("profit");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取排行榜数据
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard?range=${timeRange}&limit=50`);
        const data = await res.json();
        if (data.leaderboard && Array.isArray(data.leaderboard)) {
          const transformed = transformLeaderboardData(data.leaderboard);
          setLeaderboardData(transformed);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [timeRange]);

  const topThree = useMemo(() => leaderboardData.slice(0, 3), [leaderboardData]);
  const restRank = useMemo(() => leaderboardData.slice(3), [leaderboardData]);
  const jsonLd = useMemo(
    () => buildLeaderboardJsonLd(leaderboardData),
    [leaderboardData]
  );

  // 加载状态
  if (loading && leaderboardData.length === 0) {
    return (
      <GradientPage className="w-full relative overflow-hidden font-sans min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
          <p className="text-gray-500 font-medium">加载排行榜数据...</p>
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
      jsonLd={jsonLd}
    />
  );
}
