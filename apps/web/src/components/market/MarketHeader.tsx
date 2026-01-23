"use client";

import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Layers,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { FollowButton } from "@/components/ui/FollowButton";
import type { PredictionDetail } from "@/app/prediction/[id]/_lib/types";
import Link from "next/link";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/format";
import { getEventStatus, getStatusBadgeColor, getStatusText } from "@/lib/date-utils";

interface MarketHeaderProps {
  prediction: PredictionDetail;
  followersCount: number;
  following: boolean;
  onFollow: () => void;
  followLoading: boolean;
  followError?: string | null;
}

export function MarketHeader({
  prediction,
  followersCount,
  following,
  onFollow,
  followLoading,
  followError,
}: MarketHeaderProps) {
  const t = useTranslations();
  const tMarketHeader = useTranslations("market.header");
  const tMarketBreadcrumbs = useTranslations("market.breadcrumbs");
  const { locale } = useLocale();
  const displayTitle = t(prediction.title);
  const eventStatus = getEventStatus(
    prediction.deadline,
    prediction.status === "completed" || prediction.status === "cancelled"
  );
  const statusBadgeColor = getStatusBadgeColor(eventStatus);
  const statusBadgeText = getStatusText(eventStatus, t);
  const isLiveStatus = eventStatus === "active" || eventStatus === "upcoming";

  // 计算总交易量或金额 (示例)
  const volume = prediction.stats?.totalAmount || 0;
  const liquidity = prediction.stats?.totalAmount ? prediction.stats.totalAmount * 0.1 : 0; // 模拟流动性

  return (
    <div className="space-y-6">
      {/* Breadcrumbs / Category */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/trending" className="hover:text-purple-600 transition-colors">
          {tMarketBreadcrumbs("home")}
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/trending?category=${prediction.category}`}
          className="hover:text-purple-600 transition-colors"
        >
          {prediction.category}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium truncate max-w-[200px]">{displayTitle}</span>
      </div>

      <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
        <div className="flex-1 space-y-4">
          <div className="flex items-start gap-4">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-white border border-gray-100 shadow-sm">
              {prediction.stats?.yesProbability !== undefined ? (
                <div className="absolute inset-0 flex items-center justify-center bg-purple-50">
                  <BarChart3 className="w-8 h-8 text-purple-500" />
                </div>
              ) : (
                // 这里可以放图片
                <div className="absolute inset-0 bg-gray-100" />
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                {displayTitle}
              </h1>
              <div className="flex flex-wrap gap-3 mt-3">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-white/40 ${statusBadgeColor}`}
                >
                  {isLiveStatus ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {statusBadgeText}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-purple-600 bg-purple-50 border border-purple-100">
                  <Layers className="w-3.5 h-3.5" />
                  {prediction.category}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/80 border border-gray-100 shadow-sm">
              <FollowButton
                isFollowed={following}
                onClick={onFollow as any}
                dataEventId={prediction.id}
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-700">
                  {following ? tMarketHeader("following") : tMarketHeader("follow")}
                </span>
                <span className="text-[11px] text-gray-400">{followersCount}</span>
              </div>
            </div>
          </div>
          {followError && (
            <div className="text-[11px] text-red-500 mt-1 max-w-xs text-right">{followError}</div>
          )}
        </div>
      </div>

      {/* Stats Overview (non-card layout) */}
      <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-xl shadow-soft overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[var(--card-border)]">
          <div className="p-4 md:p-5 flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-300 flex items-center justify-center border border-purple-500/15 flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tMarketHeader("totalVolume")}
              </div>
              <div className="text-lg md:text-xl font-black text-[var(--foreground)] truncate">
                {formatCurrency(volume)}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300 flex items-center justify-center border border-sky-500/15 flex-shrink-0">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tMarketHeader("liquidity")}
              </div>
              <div className="text-lg md:text-xl font-black text-[var(--foreground)] truncate">
                {formatCurrency(liquidity)}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center border border-emerald-500/15 flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tMarketHeader("participants")}
              </div>
              <div className="text-lg md:text-xl font-black text-[var(--foreground)] truncate">
                {prediction.stats?.participantCount || 0}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-300 flex items-center justify-center border border-orange-500/15 flex-shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tMarketHeader("deadline")}
              </div>
              <div className="text-lg md:text-xl font-black text-[var(--foreground)] truncate">
                {formatDate(prediction.deadline, locale)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
