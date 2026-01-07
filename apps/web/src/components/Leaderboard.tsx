"use client";

import React, { useState, memo, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Crown, Trophy, ChevronRight, Loader2 } from "lucide-react";
import LazyImage from "@/components/ui/LazyImage";
import { useTranslations } from "@/lib/i18n";

type LeaderboardEntry = {
  rank: number;
  wallet_address: string;
  username: string;
  avatar: string;
  trades_count: number;
  total_volume: number;
  profit: number;
  win_rate: number;
  trend: string;
};

// 格式化数字显示
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toFixed(0);
}

type PodiumProps = {
  top3: LeaderboardEntry[];
  tLeaderboard: (key: string) => string;
};

function Podium({ top3, tLeaderboard }: PodiumProps) {
  if (top3.length < 3) {
    return null;
  }

  return (
    <div className="flex justify-center items-end gap-3 mb-8 px-2 relative z-10">
      <div className="flex flex-col items-center w-1/3 group/rank2">
        <div className="relative mb-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="w-14 h-14 rounded-full p-[3px] bg-gradient-to-b from-slate-300 to-slate-100 shadow-lg ring-2 ring-white"
          >
            <LazyImage
              src={top3[1].avatar}
              alt={tLeaderboard("avatarAlt").replace("{name}", top3[1].username)}
              className="w-full h-full rounded-full bg-white object-cover"
              placeholderClassName="rounded-full bg-gradient-to-br from-slate-100 to-slate-200"
              rootMargin={50}
            />
          </motion.div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-white shadow-sm">
            #2
          </div>
        </div>
        <div className="text-center">
          <div className="font-bold text-gray-800 text-sm truncate w-20 group-hover/rank2:text-slate-700 transition-colors">
            {top3[1].username}
          </div>
          <div className="text-xs font-bold text-slate-500 group-hover/rank2:text-slate-600">
            {formatVolume(top3[1].total_volume)}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center w-1/3 -mt-4 z-10 group/rank1">
        <div className="relative mb-2">
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-500 animate-bounce drop-shadow-sm">
            <Crown className="w-7 h-7 fill-amber-400" />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 rounded-full p-[4px] bg-gradient-to-b from-amber-300 via-yellow-400 to-orange-500 shadow-xl shadow-orange-500/20 ring-4 ring-white"
          >
            <LazyImage
              src={top3[0].avatar}
              alt={tLeaderboard("avatarAlt").replace("{name}", top3[0].username)}
              className="w-full h-full rounded-full bg-white object-cover"
              placeholderClassName="rounded-full bg-gradient-to-br from-amber-100 to-yellow-100"
              rootMargin={50}
            />
          </motion.div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-0.5 rounded-full border-2 border-white shadow-md">
            #1
          </div>
        </div>
        <div className="text-center mt-1">
          <div className="font-bold text-gray-900 text-base truncate w-24 group-hover/rank1:text-amber-700 transition-colors">
            {top3[0].username}
          </div>
          <div className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">
            {formatVolume(top3[0].total_volume)}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center w-1/3 group/rank3">
        <div className="relative mb-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="w-14 h-14 rounded-full p-[3px] bg-gradient-to-b from-orange-300 to-orange-100 shadow-lg ring-2 ring-white"
          >
            <LazyImage
              src={top3[2].avatar}
              alt={tLeaderboard("avatarAlt").replace("{name}", top3[2].username)}
              className="w-full h-full rounded-full bg-white object-cover"
              placeholderClassName="rounded-full bg-gradient-to-br from-orange-100 to-orange-200"
              rootMargin={50}
            />
          </motion.div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-white shadow-sm">
            #3
          </div>
        </div>
        <div className="text-center">
          <div className="font-bold text-gray-800 text-sm truncate w-20 group-hover/rank3:text-orange-800 transition-colors">
            {top3[2].username}
          </div>
          <div className="text-xs font-bold text-orange-500 group-hover/rank3:text-orange-600">
            {formatVolume(top3[2].total_volume)}
          </div>
        </div>
      </div>
    </div>
  );
}

type LeaderboardListProps = {
  others: LeaderboardEntry[];
  tLeaderboard: (key: string) => string;
};

function LeaderboardList({ others, tLeaderboard }: LeaderboardListProps) {
  if (!others.length) {
    return null;
  }

  return (
    <div className="space-y-2 mb-2 relative z-10">
      {others.map((item, index) => (
        <motion.div
          key={item.wallet_address}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + index * 0.1 }}
          className="flex items-center justify-between p-3 bg-white/40 hover:bg-white/80 rounded-2xl transition-all border border-transparent hover:border-purple-100/50 hover:shadow-lg hover:shadow-purple-500/5 cursor-pointer group/item"
        >
          <div className="flex items-center gap-3">
            <span className="w-6 text-center text-xs font-bold text-gray-400 group-hover/item:text-purple-500 transition-colors">
              {item.rank}
            </span>
            <LazyImage
              src={item.avatar}
              alt={tLeaderboard("avatarAlt").replace("{name}", item.username)}
              className="w-8 h-8 rounded-full bg-gray-100 object-cover group-hover/item:ring-2 ring-purple-100 transition-all"
              placeholderClassName="rounded-full bg-gradient-to-br from-gray-100 to-gray-200"
              rootMargin={100}
            />
            <span className="text-sm font-medium text-gray-700 group-hover/item:text-gray-900 transition-colors">
              {item.username}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-gray-500 group-hover/item:text-purple-600 transition-colors">
              {formatVolume(item.total_volume)}
            </div>
            <div className="text-xs text-gray-400">
              {item.trades_count} {tLeaderboard("card.trades")}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Leaderboard() {
  const tLeaderboard = useTranslations("leaderboard");
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取排行榜数据
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const range = period === "week" ? "weekly" : "monthly";
        const res = await fetch(`/api/leaderboard?range=${range}&limit=7`);
        const data = await res.json();
        if (data.leaderboard && Array.isArray(data.leaderboard)) {
          setLeaderboardData(data.leaderboard);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [period]);

  // Use useMemo to optimize data slicing
  const top3 = useMemo(() => leaderboardData.slice(0, 3), [leaderboardData]);
  const others = useMemo(() => leaderboardData.slice(3), [leaderboardData]);

  // 加载状态
  if (loading && leaderboardData.length === 0) {
    return (
      <div className="bg-gradient-to-br from-blue-50/80 via-purple-50/80 to-pink-50/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 relative overflow-hidden min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // 没有数据
  if (!loading && leaderboardData.length === 0) {
    return (
      <div className="bg-gradient-to-br from-blue-50/80 via-purple-50/80 to-pink-50/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 relative overflow-hidden min-h-[400px] flex items-center justify-center">
        <p className="text-gray-500">{tLeaderboard("noData")}</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50/80 via-purple-50/80 to-pink-50/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 relative overflow-hidden group hover:shadow-purple-500/10 transition-all duration-500">
      {/* Decorative background - Vivid Gradients */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-gradient-to-br from-purple-500/10 via-fuchsia-400/10 to-transparent rounded-full blur-3xl -z-10 pointer-events-none group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-tr from-blue-500/10 via-cyan-400/10 to-transparent rounded-full blur-3xl -z-10 pointer-events-none group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-amber-200/10 to-orange-200/10 rounded-full blur-3xl -z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl shadow-sm border border-white/60 group-hover:rotate-3 transition-transform duration-300">
            <Trophy className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 leading-none mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 transition-all duration-300">
              {tLeaderboard("title")}
            </h3>
            <p className="text-xs text-gray-500 font-medium group-hover:text-purple-400 transition-colors">
              {tLeaderboard("subtitle")}
            </p>
          </div>
        </div>

        <div className="bg-white/50 p-1 rounded-xl flex text-xs font-medium border border-white/60 shadow-sm backdrop-blur-sm">
          {(["week", "month"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPeriod(t)}
              className={`px-3 py-1.5 rounded-lg transition-all duration-300 ${
                period === t
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/20"
                  : "text-gray-500 hover:text-purple-600 hover:bg-purple-50/50"
              }`}
            >
              {t === "week" ? tLeaderboard("week") : tLeaderboard("month")}
            </button>
          ))}
        </div>
      </div>

      <Podium top3={top3} tLeaderboard={tLeaderboard} />
      <LeaderboardList others={others} tLeaderboard={tLeaderboard} />

      <Link
        href="/leaderboard"
        className="w-full mt-4 py-3 text-xs text-gray-400 font-medium hover:text-purple-600 flex items-center justify-center gap-1 transition-all border-t border-gray-100/50 hover:border-purple-100 group/link relative z-10"
      >
        {tLeaderboard("viewAll")}
        <ChevronRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

// Use memo to optimize component, avoid unnecessary re-renders
export default memo(Leaderboard);
