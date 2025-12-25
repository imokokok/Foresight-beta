"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Crown, Sparkles, Star, Target, Trophy, TrendingUp, Zap } from "lucide-react";
import type { LeaderboardUser } from "../data";
import { Sparkline } from "./Sparkline";

function getRankStyles(rank: number) {
  switch (rank) {
    case 1:
      return {
        card: "bg-gradient-to-br from-white/90 via-purple-50/80 to-pink-50/50 border-purple-200 order-2 -mt-16 z-20 w-full md:w-[38%] shadow-purple-500/10 ring-4 ring-white/60",
        badge: "bg-yellow-100/80 text-yellow-600 rotate-12",
        avatar: "border-yellow-200 shadow-2xl shadow-yellow-500/20",
        pill: "bg-gradient-to-r from-yellow-400 to-amber-500 border-yellow-200 text-white",
      };
    case 2:
      return {
        card: "bg-gradient-to-br from-white/90 via-indigo-50/80 to-blue-50/50 border-indigo-100 order-1 mt-4 z-10 w-full md:w-[30%] shadow-indigo-500/10",
        badge: "bg-slate-100/80 text-slate-600 -rotate-6",
        avatar: "border-slate-200 shadow-xl shadow-slate-500/10",
        pill: "bg-gradient-to-r from-slate-400 to-slate-500 border-slate-200 text-white",
      };
    case 3:
      return {
        card: "bg-gradient-to-br from-white/90 via-amber-50/80 to-orange-50/50 border-amber-100 order-3 mt-4 z-10 w-full md:w-[30%] shadow-amber-500/10",
        badge: "bg-orange-100/80 text-orange-600 rotate-6",
        avatar: "border-orange-200 shadow-xl shadow-orange-500/10",
        pill: "bg-gradient-to-r from-orange-400 to-orange-500 border-orange-200 text-white",
      };
    default:
      return { card: "", badge: "", avatar: "", pill: "" };
  }
}

export function TopThreeCard({ user }: { user: LeaderboardUser }) {
  const isFirst = user.rank === 1;
  const styles = getRankStyles(user.rank);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -10, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative flex flex-col items-center p-6 rounded-[2.5rem] backdrop-blur-2xl border-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 group ${styles.card} will-change-transform`}
    >
      {isFirst && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-full flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 scale-150 animate-pulse" />
            <Crown className="w-20 h-20 text-yellow-400 drop-shadow-xl fill-yellow-100/50 animate-[bounce_3s_infinite] relative z-10" />
            <Sparkles className="absolute -top-4 -right-8 w-8 h-8 text-yellow-400 animate-spin-slow" />
            <Sparkles className="absolute -bottom-2 -left-8 w-6 h-6 text-yellow-400 animate-spin-slow" />
          </div>
        </div>
      )}

      <div
        className={`absolute top-4 right-4 w-12 h-12 flex items-center justify-center rounded-2xl text-2xl font-black border border-white/50 shadow-sm z-30 backdrop-blur-md ${styles.badge}`}
      >
        {user.rank}
      </div>

      <div className="relative mb-4 mt-6 group-hover:scale-105 transition-transform duration-500">
        <div className={`p-2.5 rounded-full border-[4px] relative z-10 bg-white ${styles.avatar}`}>
          <img
            src={user.avatar}
            alt={user.name}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-50 object-cover"
          />
        </div>

        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20">
          <div
            className={`px-4 py-2 rounded-2xl shadow-lg border text-xs font-black whitespace-nowrap flex items-center gap-1.5 transform transition-transform group-hover:scale-110 ${styles.pill}`}
          >
            <Trophy className="w-3.5 h-3.5 fill-current" />
            {user.badge?.split(" ")[1] ?? ""}
          </div>
        </div>
      </div>

      <h3 className="text-2xl font-black text-gray-800 mb-2 mt-6 tracking-tight">{user.name}</h3>
      <div className="flex items-center gap-1.5 mb-6">
        {user.tags?.map((tag: string) => (
          <span
            key={tag}
            className="px-2.5 py-1 rounded-lg bg-white/80 border border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider shadow-sm"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="w-full space-y-3">
        <div className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white/60 border border-white/60 shadow-sm relative overflow-hidden group-hover:bg-white/80 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="text-xs font-bold text-gray-400 uppercase mb-1 tracking-widest">
            Total Profit
          </span>
          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 tracking-tight">
            {user.profit} <span className="text-sm text-gray-400 font-bold">USDC</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-white/60 border border-white/60 shadow-sm text-center hover:scale-105 transition-transform">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Win Rate</div>
            <div className="text-sm font-black text-gray-700 flex items-center justify-center gap-1">
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              {user.winRate}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-white/60 border border-white/60 shadow-sm text-center hover:scale-105 transition-transform">
            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Best Hit</div>
            <div className="text-sm font-black text-gray-700 flex items-center justify-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              {user.bestTrade || "N/A"}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function RankItem({ user, index }: { user: LeaderboardUser; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01, x: 5 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative flex items-center gap-4 bg-white/70 hover:bg-white/95 backdrop-blur-sm p-4 rounded-3xl border border-white/50 shadow-sm hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-200 transition-all duration-300 cursor-pointer will-change-transform"
    >
      <div className="flex-shrink-0 w-12 flex justify-center">
        <span
          className={`text-lg font-black font-mono ${index < 3 ? "text-purple-600 scale-110" : "text-gray-400"}`}
        >
          #{user.rank}
        </span>
      </div>

      <div className="relative">
        <img
          src={user.avatar}
          alt={user.name}
          className="w-12 h-12 rounded-full bg-gray-100 border-2 border-white shadow-sm group-hover:scale-110 transition-transform"
        />
        {index < 3 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
            <Star className="w-2 h-2 text-white fill-current" />
          </div>
        )}
      </div>

      <div className="flex-grow min-w-0 grid grid-cols-12 gap-4 items-center">
        <div className="col-span-4">
          <h4 className="font-bold text-gray-800 truncate group-hover:text-purple-700 transition-colors">
            {user.name}
          </h4>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Win {user.winRate}
            </span>
          </div>
        </div>

        <div className="col-span-4 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
          {user.history && (
            <Sparkline
              data={user.history}
              color={user.trend.startsWith("+") ? "#10B981" : "#EF4444"}
            />
          )}
        </div>

        <div className="col-span-4 text-right">
          <div className="font-black text-gray-900 text-lg group-hover:text-purple-600 transition-colors">
            {user.profit}
          </div>
          <div
            className={`text-xs font-bold flex items-center justify-end gap-1 ${
              user.trend.startsWith("+") ? "text-green-500" : "text-red-500"
            }`}
          >
            {user.trend.startsWith("+") ? <ArrowUpRight className="w-3 h-3" /> : null}
            {user.trend}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
