"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BarChart2, Search, Sparkles, Users } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import type { LeaderboardUser } from "../data";
import { RankItem } from "./LeaderboardCards";

export function LeaderboardMainSections({ restRank }: { restRank: LeaderboardUser[] }) {
  const t = useTranslations("leaderboard");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between px-6 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          <span>{t("card.rankTrader")}</span>
          <span className="hidden md:block">{t("card.performanceTrend")}</span>
          <span>{t("card.winningsStatus")}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key="leaderboard-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {restRank.map((user, idx) => (
              <RankItem key={user.wallet_address || user.name} user={user} index={idx + 3} />
            ))}
          </motion.div>
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 mt-8 rounded-3xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2 group"
        >
          <Sparkles className="w-4 h-4 group-hover:animate-spin" />
          {t("loadMore")}
        </motion.button>
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t("sidebar.searchPlaceholder")}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border-2 border-transparent focus:border-purple-200 focus:bg-white/80 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-sm"
          />
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 shadow-xl shadow-purple-500/5 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100/50 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-purple-200/50 transition-colors duration-700" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-100/50 rounded-full blur-3xl -ml-10 -mb-10 group-hover:bg-blue-200/50 transition-colors duration-700" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                {t("sidebar.mySpot")}
              </h3>
              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-bold border border-purple-100">
                {t("sidebar.weekly")}
              </span>
            </div>

            <div className="flex items-center gap-5 mb-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-3xl font-black text-purple-600 shadow-inner border border-white/50">
                99+
              </div>
              <div>
                <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">
                  {t("sidebar.currentProfit")}
                </div>
                <div className="text-3xl font-black tracking-tight text-gray-900">
                  +120 <span className="text-sm text-gray-400">USDC</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm bg-white/50 p-4 rounded-xl border border-white/60">
                <span className="text-gray-500 font-medium">{t("sidebar.nextRank")}</span>
                <span className="font-bold text-green-500 flex items-center gap-1">
                  +45 USDC <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
              <div className="flex justify-between items-center text-sm bg-white/50 p-4 rounded-xl border border-white/60">
                <span className="text-gray-500 font-medium">{t("sidebar.top100")}</span>
                <span className="font-bold text-gray-700">+420 USDC</span>
              </div>
            </div>

            <button className="w-full mt-8 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-gray-900/20 active:scale-[0.98] transition-all">
              {t("sidebar.viewFullProfile")}
            </button>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-gray-900 font-black text-lg">
            <BarChart2 className="w-5 h-5 text-purple-600" />
            {t("sidebar.trendingNow")}
          </div>
          <div className="space-y-4">
            {[
              { name: "AI Agents", roi: "+45%", users: "1.2k", trend: "up" },
              { name: "BTC Volatility", roi: "+32%", users: "850", trend: "up" },
              { name: "Meme Coins", roi: "+120%", users: "3.4k", trend: "down" },
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
                    {item.users} {t("sidebar.activeUsers")}
                  </div>
                </div>
                <div
                  className={`font-black px-3 py-1.5 rounded-lg text-sm ${
                    item.trend === "up" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
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
  );
}
