"use client";
import React from "react";
import GradientPage from "@/components/ui/GradientPage";
import type { LeaderboardUser } from "../data";
import { FloatingShapes } from "./FloatingShapes";
import { LeaderboardControls, type LeaderboardControlsProps } from "./LeaderboardControls";
import { LeaderboardHeader } from "./LeaderboardHeader";
import { LeaderboardMainSections } from "./LeaderboardMainSections";
import { LeaderboardPodium } from "./LeaderboardPodium";

export type LeaderboardPageViewProps = {
  timeRange: string;
  category: string;
  onTimeRangeChange: LeaderboardControlsProps["onTimeRangeChange"];
  onCategoryChange: LeaderboardControlsProps["onCategoryChange"];
  topThree: LeaderboardUser[];
  restRank: LeaderboardUser[];
  jsonLd: any;
};

export function LeaderboardPageView({
  timeRange,
  category,
  onTimeRangeChange,
  onCategoryChange,
  topThree,
  restRank,
  jsonLd,
}: LeaderboardPageViewProps) {
  return (
    <GradientPage className="w-full relative overflow-hidden font-sans selection:bg-purple-200">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FloatingShapes />

      <div className="fixed top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 -z-10 mix-blend-soft-light" />

      <div className="relative max-w-7xl mx-auto px-4 py-8 pb-24">
        <LeaderboardHeader />
        <LeaderboardControls
          timeRange={timeRange}
          category={category}
          onTimeRangeChange={onTimeRangeChange}
          onCategoryChange={onCategoryChange}
        />
        <LeaderboardPodium users={topThree} />
        <LeaderboardMainSections restRank={restRank} />
      </div>
    </GradientPage>
  );
}
