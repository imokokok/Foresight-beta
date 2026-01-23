"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp, Users, Wallet, Trophy, Activity } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import { getEventStatus, getStatusBadgeColor, getStatusText } from "@/lib/date-utils";
import { CenteredSpinner } from "./ProfileUI";
import type { PortfolioStats, ProfilePosition } from "../types";

type PredictionsTabProps = {
  address: string | null | undefined;
  positions: ProfilePosition[];
  portfolioStats: PortfolioStats | null;
  loading: boolean;
  error: boolean;
};

export function PredictionsTab({
  address,
  positions,
  portfolioStats,
  loading,
  error,
}: PredictionsTabProps) {
  const t = useTranslations();
  const tEvents = useTranslations();
  const tProfile = useTranslations("profile");

  const totalInvested = portfolioStats?.total_invested ?? 0;
  const realizedPnl = portfolioStats?.realized_pnl ?? 0;
  const winRate = portfolioStats?.win_rate ?? "0%";
  const activeCount = portfolioStats?.active_count ?? 0;
  const positionsCount = positions.length;

  if (loading) return <CenteredSpinner />;
  if (!address) {
    return (
      <EmptyState
        icon={TrendingUp}
        title={tProfile("predictions.empty.title")}
        description={tProfile("predictions.empty.description")}
      />
    );
  }
  if (error)
    return (
      <div className="text-center py-20 text-red-500">
        {tProfile("predictions.errors.loadFailed")}
      </div>
    );

  return (
    <div className="space-y-8">
      {/* Minimalist Financial Dashboard Row */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-8 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Total Invested */}
          <div className="flex-1 px-4 first:pl-0 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {tProfile("overview.cards.totalInvested")}
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                ${totalInvested.toFixed(2)}
              </div>
            </div>
          </div>

          {/* PnL */}
          <div className="flex-1 px-4 flex items-center gap-4 pt-6 md:pt-0">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                realizedPnl >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              }`}
            >
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {tProfile("overview.cards.totalPnl")}
              </div>
              <div
                className={`text-3xl font-black tracking-tight ${
                  realizedPnl >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {realizedPnl >= 0 ? "+" : ""}
                {realizedPnl.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Win Rate */}
          <div className="flex-1 px-4 flex items-center gap-4 pt-6 md:pt-0">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {tProfile("overview.cards.winRate")}
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{winRate}</div>
            </div>
          </div>

          {/* Events Count */}
          <div className="flex-1 px-4 last:pr-0 flex items-center gap-4 pt-6 md:pt-0">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {tProfile("overview.cards.eventsCount")}
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {positionsCount || activeCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-500" />
          {tProfile("predictions.header")}
        </h3>

        {positions.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title={tProfile("predictions.empty.title")}
            description={tProfile("predictions.empty.description")}
          />
        ) : (
          <div className="grid gap-4">
            {positions.map((pred) => {
              const yesProb =
                typeof pred.stats?.yesProbability === "number" ? pred.stats.yesProbability : 0.5;
              const noProb =
                typeof pred.stats?.noProbability === "number"
                  ? pred.stats.noProbability
                  : 1 - yesProb;

              const isYes = String(pred.outcome || "").toLowerCase() === "yes";
              const sideProb = isYes ? yesProb : noProb;
              const probPercent = Math.max(
                0,
                Math.min(100, Number((sideProb * 100).toFixed(1)) || 0)
              );
              const isResolved =
                pred.status === "completed" ||
                pred.status === "cancelled" ||
                pred.status === "resolved";
              const eventStatus = getEventStatus(pred.deadline ?? Date.now(), isResolved);
              const statusBadgeColor = getStatusBadgeColor(eventStatus);
              const statusBadgeText = getStatusText(eventStatus, t);

              return (
                <Link href={`/prediction/${pred.id}`} key={pred.id}>
                  <div className="bg-white rounded-[1.5rem] p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                    <img
                      src={
                        pred.image_url ||
                        `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(
                          String(pred.id)
                        )}`
                      }
                      alt={pred.title || tProfile("predictions.alt.cover")}
                      className="w-12 h-12 rounded-xl bg-gray-100 object-cover"
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">
                        {tEvents(pred.title || "")}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold ${isYes ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {pred.outcome}
                        </span>
                        <span>
                          {tProfile("predictions.labels.stake")} ${pred.stake}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-purple-500" />
                          <span>
                            {tProfile("predictions.labels.volumePrefix")}
                            {Number(pred.stats?.totalAmount || 0).toFixed(2)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          <span>
                            {formatTranslation(tProfile("predictions.labels.participants"), {
                              count: Number(pred.stats?.participantCount || 0),
                            })}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                        <span>{tProfile("predictions.labels.yourSideProbability")}</span>
                        <span className="font-bold text-gray-700">{probPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-bold ${String(pred.pnl || "").startsWith("+") ? "text-green-600" : "text-red-600"}`}
                      >
                        {pred.pnl}
                      </div>
                      <div
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeColor}`}
                      >
                        {statusBadgeText}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
