"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  Users,
  Crown,
  ArrowUpRight,
  Sparkles,
  Flame,
  Star,
  Zap,
  Target,
  Search,
  BarChart2,
} from "lucide-react";
import GradientPage from "@/components/ui/GradientPage";

import { buildDiceBearUrl } from "@/lib/dicebear";

// Enhanced Mock Data with History for Sparklines
const leaderboardData = [
  {
    rank: 1,
    name: "YangZ",
    profit: "+8,240",
    winRate: "82%",
    trades: 142,
    avatar: buildDiceBearUrl("YangZ", "&backgroundColor=FFD700&clothing=blazerAndShirt"),
    badge: "🏆 预言家",
    trend: "+12%",
    tags: ["High Volume", "Sniper"],
    history: [40, 55, 45, 60, 75, 65, 85, 90, 82],
    bestTrade: "BTC +400%",
  },
  {
    rank: 2,
    name: "lkbhua24",
    profit: "+5,120",
    winRate: "75%",
    trades: 98,
    avatar: buildDiceBearUrl("lkbhua24", "&backgroundColor=C0C0C0&clothing=hoodie"),
    badge: "🥈 策略家",
    trend: "+8%",
    tags: ["Consistent", "Macro"],
    history: [30, 35, 40, 38, 45, 50, 48, 55, 51],
    bestTrade: "ETH +250%",
  },
  {
    rank: 3,
    name: "Dave_DeFi",
    profit: "+3,450",
    winRate: "68%",
    trades: 112,
    avatar: buildDiceBearUrl("Dave_DeFi", "&backgroundColor=CD7F32&clothing=graphicShirt"),
    badge: "🥉 新星",
    trend: "+15%",
    tags: ["Aggressive"],
    history: [20, 40, 15, 50, 30, 60, 25, 45, 34],
    bestTrade: "SOL +180%",
  },
  {
    rank: 4,
    name: "Eve_NFT",
    profit: "+2,890",
    winRate: "65%",
    trades: 87,
    avatar: buildDiceBearUrl("Eve_NFT", "&backgroundColor=b6e3f4"),
    trend: "+5%",
    tags: ["NFT Degen"],
    history: [45, 42, 48, 40, 38, 42, 45, 28],
  },
  {
    rank: 5,
    name: "Frank_Whale",
    profit: "+1,920",
    winRate: "59%",
    trades: 65,
    avatar: buildDiceBearUrl("Frank_Whale", "&backgroundColor=c0aede"),
    trend: "-2%",
    tags: ["Whale"],
    history: [60, 58, 55, 52, 50, 48, 45, 19],
  },
  {
    rank: 6,
    name: "Grace_Yield",
    profit: "+1,240",
    winRate: "62%",
    trades: 45,
    avatar: buildDiceBearUrl("Grace_Yield", "&backgroundColor=ffdfbf"),
    trend: "+3%",
    tags: ["Yield Farmer"],
    history: [20, 22, 25, 24, 26, 28, 30, 12],
  },
  {
    rank: 7,
    name: "Helen_Stake",
    profit: "+980",
    winRate: "55%",
    trades: 32,
    avatar: buildDiceBearUrl("Helen_Stake", "&backgroundColor=d1d4f9"),
    trend: "+1%",
    tags: ["Staker"],
    history: [15, 16, 15, 17, 16, 18, 17, 9],
  },
  {
    rank: 8,
    name: "Ivan_Invest",
    profit: "+850",
    winRate: "51%",
    trades: 28,
    avatar: buildDiceBearUrl("Ivan_Invest", "&backgroundColor=ffd5dc"),
    trend: "+4%",
    tags: ["Investor"],
    history: [10, 12, 11, 13, 12, 14, 13, 8],
  },
  {
    rank: 9,
    name: "Jack_Trade",
    profit: "+720",
    winRate: "48%",
    trades: 22,
    avatar: buildDiceBearUrl("Jack_Trade", "&backgroundColor=c0aede"),
    trend: "0%",
    tags: ["Trader"],
    history: [8, 8, 8, 9, 8, 9, 8, 7],
  },
  {
    rank: 10,
    name: "Kate_Hold",
    profit: "+540",
    winRate: "45%",
    trades: 18,
    avatar: buildDiceBearUrl("Kate_Hold", "&backgroundColor=b6e3f4"),
    trend: "-1%",
    tags: ["Hodler"],
    history: [10, 9, 8, 7, 6, 5, 6, 5],
  },
];

// Simple Sparkline Component
const Sparkline = ({ data, color = "#10B981" }: { data: number[]; color?: string }) => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  const step = width / (data.length - 1);

  const points = data
    .map((val, i) => {
      const x = i * step;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path
        d={`M${points.replace(/ /g, " L")}`}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
        opacity="0.8"
      />
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="4"
        fill={color}
        className="animate-pulse"
      />
    </svg>
  );
};

const getRankStyles = (rank: number) => {
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
      return {
        card: "",
        badge: "",
        avatar: "",
        pill: "",
      };
  }
};

const TopThreeCard = ({ user }: { user: any }) => {
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
      {/* Crown for #1 */}
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

      {/* Rank Badge */}
      <div
        className={`absolute top-4 right-4 w-12 h-12 flex items-center justify-center rounded-2xl text-2xl font-black border border-white/50 shadow-sm z-30 backdrop-blur-md ${styles.badge}`}
      >
        {user.rank}
      </div>

      {/* Avatar */}
      <div className="relative mb-4 mt-6 group-hover:scale-105 transition-transform duration-500">
        <div className={`p-2.5 rounded-full border-[4px] relative z-10 bg-white ${styles.avatar}`}>
          <img
            src={user.avatar}
            alt={user.name}
            className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-50 object-cover"
          />
        </div>

        {/* Decorative Badge */}
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20">
          <div
            className={`px-4 py-2 rounded-2xl shadow-lg border text-xs font-black whitespace-nowrap flex items-center gap-1.5 transform transition-transform group-hover:scale-110 ${styles.pill}`}
          >
            <Trophy className="w-3.5 h-3.5 fill-current" />
            {user.badge.split(" ")[1]}
          </div>
        </div>
      </div>

      {/* Info */}
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
};

const RankItem = ({ user, index }: { user: any; index: number }) => {
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
          className={`text-lg font-black font-mono ${
            index < 3 ? "text-purple-600 scale-110" : "text-gray-400"
          }`}
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

        {/* Sparkline Area */}
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
};

const FloatingShapes = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <motion.div
        animate={{
          y: [0, -20, 0],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-20 left-10 text-purple-200 opacity-40"
      >
        <Star className="w-16 h-16 fill-current" />
      </motion.div>
      <motion.div
        animate={{
          y: [0, 30, 0],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-40 right-20 text-indigo-200 opacity-40"
      >
        <div className="w-12 h-12 rounded-full bg-current blur-sm" />
      </motion.div>
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-40 left-1/4 text-pink-200 opacity-40"
      >
        <Sparkles className="w-20 h-20" />
      </motion.div>
      <motion.div
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute bottom-20 right-1/3 text-blue-200 opacity-30"
      >
        <div className="w-32 h-32 border-[6px] border-dashed border-current rounded-full" />
      </motion.div>
    </div>
  );
};

export default function LeaderboardPage() {
  const [timeRange, setTimeRange] = useState("weekly");
  const [category, setCategory] = useState("profit"); // profit, winrate, streak

  const topThree = leaderboardData.slice(0, 3);
  const restRank = leaderboardData.slice(3);

  return (
    <GradientPage className="w-full relative overflow-hidden font-sans selection:bg-purple-200">
      <FloatingShapes />

      {/* Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 -z-10 mix-blend-soft-light" />

      <div className="relative max-w-7xl mx-auto px-4 py-8 pb-24">
        {/* Header Section */}
        <div className="text-center mb-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/90 border-2 border-purple-200 shadow-lg shadow-purple-500/10 text-purple-600 font-black text-xs mb-8 uppercase tracking-wider hover:scale-105 transition-transform cursor-default"
          >
            <Sparkles className="w-4 h-4 animate-pulse text-yellow-500" />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Season 4 • Week 12
            </span>
            <span className="text-lg">🚀</span>
          </motion.div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 tracking-tighter drop-shadow-sm">
              Leaderboard
            </h1>
            <motion.span
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "easeInOut",
              }}
              className="text-5xl md:text-6xl filter drop-shadow-lg -mt-2"
            >
              🏆
            </motion.span>
          </div>

          <p className="text-gray-500 text-lg max-w-2xl mx-auto font-medium leading-relaxed">
            Who's the smartest predictor? 🧠
            <br />
            Follow top strategies and climb the ranks!
          </p>
        </div>

        {/* Master Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-16 bg-white/70 backdrop-blur-2xl p-2 rounded-[2rem] border border-white/60 shadow-lg shadow-purple-500/5 max-w-4xl mx-auto">
          {/* Time Range Tabs */}
          <div className="flex bg-gray-100/50 p-1 rounded-[1.5rem]">
            {[
              { id: "weekly", label: "Weekly" },
              { id: "monthly", label: "Monthly" },
              { id: "all", label: "All Time" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id)}
                className={`
                  relative px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300
                  ${
                    timeRange === tab.id
                      ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20"
                      : "text-gray-500 hover:text-gray-800 hover:bg-white/50"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-2">
            {[
              { id: "profit", label: "Winnings", icon: Trophy },
              { id: "winrate", label: "Accuracy", icon: Target },
              { id: "streak", label: "Streak", icon: Flame },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`
                  px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border
                  ${
                    category === cat.id
                      ? "bg-white text-purple-700 border-purple-100 shadow-md shadow-purple-500/5 ring-1 ring-purple-100"
                      : "bg-transparent text-gray-500 border-transparent hover:bg-white/40"
                  }
                `}
              >
                <cat.icon
                  className={`w-4 h-4 ${
                    category === cat.id ? "text-fuchsia-500" : "text-gray-400"
                  }`}
                />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 Podium */}
        <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-20 px-4">
          <TopThreeCard user={topThree[1]} />
          <TopThreeCard user={topThree[0]} />
          <TopThreeCard user={topThree[2]} />
        </div>

        {/* Rest of the List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: The List */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between px-6 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <span>Rank & Trader</span>
              <span className="hidden md:block">Performance Trend</span>
              <span>Winnings & Status</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={timeRange + category}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {restRank.map((user, idx) => (
                  <RankItem key={user.name} user={user} index={idx + 3} />
                ))}
              </motion.div>
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 mt-8 rounded-3xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2 group"
            >
              <Sparkles className="w-4 h-4 group-hover:animate-spin" />
              Load More Traders
            </motion.button>
          </div>

          {/* Right: Stats & Info */}
          <div className="lg:col-span-4 space-y-6">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search traders..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border-2 border-transparent focus:border-purple-200 focus:bg-white/80 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-sm"
              />
            </div>

            {/* Personal Stats Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 shadow-xl shadow-purple-500/5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100/50 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-purple-200/50 transition-colors duration-700" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-100/50 rounded-full blur-3xl -ml-10 -mb-10 group-hover:bg-blue-200/50 transition-colors duration-700" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    My Spot ✨
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-bold border border-purple-100">
                    Weekly
                  </span>
                </div>

                <div className="flex items-center gap-5 mb-8">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-3xl font-black text-purple-600 shadow-inner border border-white/50">
                    99+
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">
                      Current Profit
                    </div>
                    <div className="text-3xl font-black tracking-tight text-gray-900">
                      +120 <span className="text-sm text-gray-400">USDC</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm bg-white/50 p-4 rounded-xl border border-white/60">
                    <span className="text-gray-500 font-medium">Next Rank</span>
                    <span className="font-bold text-green-500 flex items-center gap-1">
                      +45 USDC <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm bg-white/50 p-4 rounded-xl border border-white/60">
                    <span className="text-gray-500 font-medium">Top 100</span>
                    <span className="font-bold text-gray-700">+420 USDC</span>
                  </div>
                </div>

                <button className="w-full mt-8 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-gray-900/20 active:scale-[0.98] transition-all">
                  View Full Profile
                </button>
              </div>
            </div>

            {/* Trending Strategy */}
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 shadow-sm">
              <div className="flex items-center gap-2 mb-6 text-gray-900 font-black text-lg">
                <BarChart2 className="w-5 h-5 text-purple-600" />
                Trending Now 🔥
              </div>
              <div className="space-y-4">
                {[
                  {
                    name: "AI Agents",
                    roi: "+45%",
                    users: "1.2k",
                    trend: "up",
                  },
                  {
                    name: "BTC Volatility",
                    roi: "+32%",
                    users: "850",
                    trend: "up",
                  },
                  {
                    name: "Meme Coins",
                    roi: "+120%",
                    users: "3.4k",
                    trend: "down",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div>
                      <div className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                        {item.name}
                      </div>
                      <div className="text-xs font-bold text-gray-400 mt-1">
                        {item.users} active users
                      </div>
                    </div>
                    <div
                      className={`font-black px-3 py-1.5 rounded-lg text-sm ${
                        item.trend === "up"
                          ? "bg-green-50 text-green-600"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {item.roi}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GradientPage>
  );
}
