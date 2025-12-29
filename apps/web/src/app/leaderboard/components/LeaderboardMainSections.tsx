"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  ChevronDown,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";
import { useWallet } from "@/contexts/WalletContext";
import type { LeaderboardUser } from "../data";
import { formatVolume } from "../data";
import { RankItem } from "./LeaderboardCards";

export type LeaderboardMainSectionsProps = {
  restRank: LeaderboardUser[];
  allUsers: LeaderboardUser[]; // 完整排行榜数据，用于查找当前用户排名
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  displayCount?: number;
  totalCount?: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
};

export function LeaderboardMainSections({
  restRank,
  allUsers,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  displayCount = 0,
  totalCount = 0,
  searchQuery = "",
  onSearchChange,
}: LeaderboardMainSectionsProps) {
  const t = useTranslations("leaderboard");
  const { account, connectWallet } = useWallet();
  const isSearching = searchQuery.trim().length > 0;

  // 获取热门预测数据
  const { data: trendingPredictions, isLoading: loadingTrending } = useQuery({
    queryKey: ["trending-predictions-simple"],
    queryFn: async () => {
      const res = await fetch("/api/predictions?limit=3&status=active");
      const data = await res.json();
      return data.data || [];
    },
    staleTime: 60 * 1000, // 1分钟
  });

  // 查找当前用户在排行榜中的数据
  const myRankData = useMemo(() => {
    if (!account || !allUsers || allUsers.length === 0) return null;

    const normalizedAccount = account.toLowerCase();
    const userIndex = allUsers.findIndex(
      (u) => u.wallet_address?.toLowerCase() === normalizedAccount
    );

    if (userIndex === -1) return null;

    const user = allUsers[userIndex];
    const rank = userIndex + 1;

    // 计算距离上一名还差多少
    let gapToNext = 0;
    if (userIndex > 0) {
      const prevUser = allUsers[userIndex - 1];
      gapToNext = prevUser.total_volume - user.total_volume;
    }

    // 计算距离前100还差多少（如果排名在100之外）
    let gapToTop100 = 0;
    if (rank > 100 && allUsers.length >= 100) {
      const top100User = allUsers[99];
      gapToTop100 = top100User.total_volume - user.total_volume;
    }

    return {
      rank,
      user,
      gapToNext,
      gapToTop100,
      isInTop100: rank <= 100,
    };
  }, [account, allUsers]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between px-6 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          <span>{t("card.rankTrader")}</span>
          <span className="hidden md:block">{t("card.performanceTrend")}</span>
          <span>{t("card.winningsStatus")}</span>
        </div>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`leaderboard-list-${isSearching}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {restRank.map((user, idx) => (
              <RankItem
                key={user.wallet_address || user.name}
                user={user}
                index={isSearching ? user.rank - 1 : idx + 3}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* 加载更多按钮 */}
        {hasMore ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full py-4 mt-8 rounded-3xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("loading") || "加载中..."}
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                {t("loadMore")}
                <span className="text-white/70 text-xs ml-1">
                  ({displayCount}/{totalCount})
                </span>
              </>
            )}
          </motion.button>
        ) : totalCount > 0 ? (
          <div className="w-full py-4 mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/60 backdrop-blur-sm border border-white/80 text-gray-500 text-sm font-medium">
              <Sparkles className="w-4 h-4 text-purple-400" />
              {t("allLoaded") || `已展示全部 ${totalCount} 位交易者`}
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={t("sidebar.searchPlaceholder")}
            className="w-full pl-12 pr-10 py-4 rounded-2xl bg-white border-2 border-transparent focus:border-purple-200 focus:bg-white/80 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 shadow-sm"
          />
          {isSearching && (
            <button
              onClick={() => onSearchChange?.("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              ×
            </button>
          )}
        </div>

        {/* 搜索结果提示 */}
        {isSearching && (
          <div className="px-4 py-2 rounded-xl bg-purple-50 border border-purple-100 text-sm text-purple-600">
            {restRank.length > 0 ? (
              <span>{t("sidebar.searchResults") || `找到 ${restRank.length} 位匹配的交易者`}</span>
            ) : (
              <span>{t("sidebar.noResults") || "未找到匹配的交易者"}</span>
            )}
          </div>
        )}

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

            {account ? (
              myRankData ? (
                <>
                  <div className="flex items-center gap-5 mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-3xl font-black text-purple-600 shadow-inner border border-white/50">
                      #{myRankData.rank}
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">
                        {t("sidebar.currentProfit")}
                      </div>
                      <div className="text-3xl font-black tracking-tight text-gray-900">
                        {formatVolume(myRankData.user.total_volume)}{" "}
                        <span className="text-sm text-gray-400">USDC</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <span>
                          {t("card.winRate")} {myRankData.user.win_rate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm bg-white/50 p-4 rounded-xl border border-white/60">
                      <span className="text-gray-500 font-medium">{t("sidebar.nextRank")}</span>
                      {myRankData.rank === 1 ? (
                        <span className="font-bold text-yellow-500">
                          🏆 {t("sidebar.topRank") || "榜首"}
                        </span>
                      ) : (
                        <span className="font-bold text-purple-600">
                          +{formatVolume(myRankData.gapToNext)} USDC
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-sm bg-white/50 p-4 rounded-xl border border-white/60">
                      <span className="text-gray-500 font-medium">{t("sidebar.top100")}</span>
                      {myRankData.isInTop100 ? (
                        <span className="font-bold text-green-500">
                          ✓ {t("sidebar.inTop100") || "已进入"}
                        </span>
                      ) : (
                        <span className="font-bold text-orange-500">
                          +{formatVolume(myRankData.gapToTop100)} USDC
                        </span>
                      )}
                    </div>
                  </div>

                  <Link href="/profile">
                    <button className="w-full mt-8 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-gray-900/20 active:scale-[0.98] transition-all">
                      {t("sidebar.viewFullProfile")}
                    </button>
                  </Link>
                </>
              ) : (
                // 用户已连接钱包但不在排行榜中
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm mb-2">
                    {t("sidebar.notRanked") || "暂未上榜"}
                  </p>
                  <p className="text-gray-400 text-xs mb-6">
                    {t("sidebar.startTrading") || "开始交易以进入排行榜"}
                  </p>
                  <Link href="/trending">
                    <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] transition-all">
                      {t("sidebar.explorePredictions") || "探索预测市场"}
                    </button>
                  </Link>
                </div>
              )
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-purple-500" />
                </div>
                <p className="text-gray-500 text-sm mb-6">{t("sidebar.connectToView")}</p>
                <button
                  onClick={connectWallet}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98] transition-all"
                >
                  {t("sidebar.connectWallet")}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-gray-900 font-black text-lg">
              <BarChart2 className="w-5 h-5 text-purple-600" />
              {t("sidebar.trendingNow")}
            </div>
            <Link href="/trending" className="text-purple-600 hover:text-purple-700">
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {loadingTrending ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100/50 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : trendingPredictions && trendingPredictions.length > 0 ? (
              trendingPredictions.map((prediction: any) => (
                <Link
                  key={prediction.id}
                  href={`/prediction/${prediction.id}`}
                  className="block group"
                >
                  <div className="p-4 rounded-2xl bg-white/40 border border-white/60 hover:bg-white/80 hover:shadow-md hover:border-purple-100 transition-all duration-300">
                    <h4 className="text-sm font-bold text-gray-800 line-clamp-2 mb-2 group-hover:text-purple-700 transition-colors">
                      {prediction.title}
                    </h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[10px] font-black uppercase">
                          {prediction.category || "General"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                        <TrendingUp className="w-3 h-3" />
                        {formatVolume(prediction.stats?.totalAmount || 0)} USDC
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-purple-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{t("sidebar.noTrending") || "暂无热门预测"}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
