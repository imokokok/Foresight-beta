"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function LeaderboardHeader() {
  return (
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
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
          className="text-5xl md:text-6xl filter drop-shadow-lg -mt-2"
        >
          🏆
        </motion.span>
      </div>

      <p className="text-gray-500 text-lg max-w-2xl mx-auto font-medium leading-relaxed">
        Who&apos;s the smartest predictor? 🧠
        <br />
        Follow top strategies and climb the ranks!
      </p>
      <p className="mt-4 text-sm text-gray-600 max-w-3xl mx-auto leading-relaxed">
        Foresight
        排行榜基于预测收益和胜率等指标，展示在去中心化预测市场中表现突出的交易者，帮助你发现长期稳定盈利的钱包地址和交易风格。
      </p>
      <p className="mt-2 text-xs text-gray-500 max-w-3xl mx-auto leading-relaxed">
        想看看这些高手都在押注哪些事件？前往{" "}
        <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
          热门预测
        </Link>{" "}
        浏览实时市场，或在{" "}
        <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
          讨论区
        </Link>{" "}
        跟进他们的观点与策略。
      </p>
    </div>
  );
}
