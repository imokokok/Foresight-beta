"use client";

import React from "react";
import { ArrowRight, Clock, TrendingUp } from "lucide-react";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import type { PortfolioStats } from "../types";
import { ProfileCard } from "./ProfileUI";

export function OverviewTab({
  portfolioStats,
  positionsCount,
}: {
  portfolioStats: PortfolioStats | null;
  positionsCount: number;
}) {
  const totalInvested = portfolioStats?.total_invested ?? 0;
  const realizedPnl = portfolioStats?.realized_pnl ?? 0;
  const winRate = portfolioStats?.win_rate ?? "0%";
  const winRateValue =
    Number(String(winRate).replace("%", "")) >= 0
      ? Number(String(winRate).replace("%", "")) || 0
      : 0;
  const clampedWinRate = Math.max(0, Math.min(100, winRateValue));
  const activeCount = portfolioStats?.active_count ?? 0;
  const tProfile = useTranslations("profile");

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-purple-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="relative z-10">
            <div className="text-purple-200 text-sm font-bold mb-1">
              {tProfile("overview.cards.totalInvested")}
            </div>
            <div className="text-3xl font-black mb-4">${totalInvested.toFixed(2)}</div>
            <div className="flex items-center gap-2 text-xs bg-white/20 w-fit px-2 py-1 rounded-lg backdrop-blur-md">
              <TrendingUp className="w-3 h-3" />
              <span>
                {formatTranslation(tProfile("overview.cards.eventsSummary"), {
                  count: positionsCount,
                })}
              </span>
            </div>
          </div>
        </div>

        <ProfileCard>
          <div className="text-gray-400 text-sm font-bold mb-1">
            {tProfile("overview.cards.totalPnl")}
          </div>
          <div className="text-3xl font-black text-gray-900 mb-4">
            {realizedPnl >= 0 ? "+" : ""}
            {realizedPnl.toFixed(2)}
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${realizedPnl >= 0 ? "bg-green-500" : "bg-red-500"}`}
              style={{
                width: `${Math.max(
                  5,
                  Math.min(
                    100,
                    Math.abs(totalInvested > 0 ? (realizedPnl / totalInvested) * 100 : 0)
                  )
                )}%`,
              }}
            />
          </div>
        </ProfileCard>

        <ProfileCard>
          <div className="text-gray-400 text-sm font-bold mb-1">
            {tProfile("overview.cards.winRate")}
          </div>
          <div className="text-3xl font-black text-gray-900 mb-4">{winRate}</div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${clampedWinRate}%` }}
            />
          </div>
        </ProfileCard>

        <ProfileCard>
          <div className="text-gray-400 text-sm font-bold mb-1">
            {tProfile("overview.cards.eventsCount")}
          </div>
          <div className="text-3xl font-black text-gray-900 mb-4">
            {positionsCount || activeCount}
          </div>
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white" />
            ))}
          </div>
        </ProfileCard>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-500" />
          {tProfile("overview.activity.title")}
        </h3>
        <ProfileCard className="overflow-hidden">
          {[1, 2, 3].map((_, i) => (
            <div
              key={i}
              className="p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-xs">
                {i === 0
                  ? tProfile("overview.activity.type.buy")
                  : i === 1
                    ? tProfile("overview.activity.type.settle")
                    : tProfile("overview.activity.type.view")}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-900">
                  {i === 0
                    ? tProfile("overview.activity.item.buy")
                    : i === 1
                      ? tProfile("overview.activity.item.settle")
                      : tProfile("overview.activity.item.view")}
                </div>
                <div className="text-xs text-gray-400">
                  {tProfile("overview.activity.timeExample")}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300" />
            </div>
          ))}
        </ProfileCard>
      </div>
    </div>
  );
}
