"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Layers,
  Star,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { PredictionDetail } from "@/app/prediction/[id]/PredictionDetailClient";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

interface MarketHeaderProps {
  prediction: PredictionDetail;
  followersCount: number;
  following: boolean;
  onFollow: () => void;
  followLoading: boolean;
}

export function MarketHeader({
  prediction,
  followersCount,
  following,
  onFollow,
  followLoading,
}: MarketHeaderProps) {
  const tEvents = useTranslations();
  const displayTitle = tEvents(prediction.title);
  const isExpired = prediction.timeInfo?.isExpired;
  const statusColor =
    prediction.status === "active" && !isExpired
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : "text-gray-500 bg-gray-100 border-gray-200";
  const statusText = prediction.status === "active" && !isExpired ? "进行中" : "已结束";

  // 计算总交易量或金额 (示例)
  const volume = prediction.stats?.totalAmount || 0;
  const liquidity = prediction.stats?.totalAmount ? prediction.stats.totalAmount * 0.1 : 0; // 模拟流动性

  return (
    <div className="space-y-6">
      {/* Breadcrumbs / Category */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-purple-600 transition-colors">
          首页
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/?category=${prediction.category}`}
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
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                >
                  {prediction.status === "active" && !isExpired ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {statusText}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-purple-600 bg-purple-50 border border-purple-100">
                  <Layers className="w-3.5 h-3.5" />
                  {prediction.category}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onFollow}
            disabled={followLoading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              following
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                : "bg-purple-600 text-white hover:bg-purple-700 shadow-purple-200"
            }`}
          >
            <Star className={`w-4 h-4 ${following ? "fill-current" : ""}`} />
            {following ? "已关注" : "关注"}
            <span className="ml-1 opacity-80 text-xs">{followersCount}</span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-2 p-5 rounded-3xl bg-purple-50/50 border border-purple-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all hover:bg-purple-50">
          <span className="text-xs font-bold text-purple-600 uppercase tracking-wider z-10 flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-purple-200/50 text-purple-700">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            总交易量
          </span>
          <span className="text-xl font-black text-gray-900 z-10">${volume.toLocaleString()}</span>
        </div>

        <div className="flex flex-col gap-2 p-5 rounded-3xl bg-blue-50/50 border border-blue-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all hover:bg-blue-50">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider z-10 flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-blue-200/50 text-blue-700">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </div>
            流动性 (Est.)
          </span>
          <span className="text-xl font-black text-gray-900 z-10">
            ${liquidity.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-2 p-5 rounded-3xl bg-emerald-50/50 border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all hover:bg-emerald-50">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider z-10 flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-emerald-200/50 text-emerald-700">
              <Users className="w-3.5 h-3.5" />
            </div>
            参与人数
          </span>
          <span className="text-xl font-black text-gray-900 z-10">
            {prediction.stats?.participantCount || 0}
          </span>
        </div>

        <div className="flex flex-col gap-2 p-5 rounded-3xl bg-orange-50/50 border border-orange-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all hover:bg-orange-50">
          <span className="text-xs font-bold text-orange-600 uppercase tracking-wider z-10 flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-orange-200/50 text-orange-700">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            截止时间
          </span>
          <span className="text-xl font-black text-gray-900 z-10 truncate">
            {new Date(prediction.deadline).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
