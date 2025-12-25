"use client";

import React, { useMemo, useState } from "react";
import { buildLeaderboardJsonLd, leaderboardData } from "./data";
import { LeaderboardPageView } from "./components/LeaderboardPageView";

export default function LeaderboardPage() {
  const [timeRange, setTimeRange] = useState("weekly");
  const [category, setCategory] = useState("profit");

  const topThree = useMemo(() => leaderboardData.slice(0, 3), []);
  const restRank = useMemo(() => leaderboardData.slice(3), []);
  const jsonLd = useMemo(() => buildLeaderboardJsonLd(), []);

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
