"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export function LeaderboardHeader() {
  const t = useTranslations("leaderboard");

  return (
    <div className="text-center mb-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/90 border-2 border-purple-200 shadow-lg shadow-purple-500/10 text-purple-600 font-black text-xs mb-8 uppercase tracking-wider hover:scale-105 transition-transform cursor-default"
      >
        <Sparkles className="w-4 h-4 animate-pulse text-yellow-500" />
        <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          {t("seasonBadge")}
        </span>
        <span className="text-lg">🚀</span>
      </motion.div>

      <div className="flex items-center justify-center gap-3 mb-6">
        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 tracking-tighter drop-shadow-sm">
          {t("pageTitle")}
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
        {t("heroSubtitle")}
        <br />
        {t("heroDescription")}
      </p>
      <p className="mt-4 text-sm text-gray-600 max-w-3xl mx-auto leading-relaxed">
        {t("introText")}
      </p>
      <p className="mt-2 text-xs text-gray-500 max-w-3xl mx-auto leading-relaxed">
        {t("linkHint")}{" "}
        <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
          {t("linkTrending")}
        </Link>{" "}
        {t("linkMiddle")}{" "}
        <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
          {t("linkForum")}
        </Link>{" "}
        {t("linkSuffix")}
      </p>
    </div>
  );
}
