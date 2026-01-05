"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  LogOut,
  Settings,
  Wallet,
  UserPlus,
  UserMinus,
  Loader2,
  Target,
  Users,
  Zap,
} from "lucide-react";
import GradientPage from "@/components/ui/GradientPage";
import { buildDiceBearUrl } from "@/lib/dicebear";
import { toast } from "@/lib/toast";
import { formatAddress } from "@/lib/cn";
import { useWallet } from "@/contexts/WalletContext";
import { useState, useEffect, useCallback } from "react";
import type { PortfolioStats, TabConfig, TabType } from "../types";
import { SidebarStatCard } from "./ProfileUI";
import { PredictionsTab } from "./PredictionsTab";
import { HistoryTab } from "./HistoryTab";
import { FollowingTab } from "./FollowingTab";
import { FollowersTab } from "./FollowersTab";

export type ProfilePageViewProps = {
  account: string | null | undefined;
  username: string;
  tProfile: (key: string) => string;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  tabs: TabConfig[];
  historyCount: number;
  positionsCount: number;
  followingCount: number;
  portfolioStats: PortfolioStats | null;
  disconnect: () => void;
  history: any[];
  isOwnProfile?: boolean;
};

export function ProfilePageView({
  account,
  username,
  tProfile,
  activeTab,
  setActiveTab,
  tabs,
  historyCount,
  positionsCount,
  followingCount: initialFollowingCount,
  portfolioStats,
  disconnect,
  history,
  isOwnProfile = true,
}: ProfilePageViewProps) {
  const { account: myAccount } = useWallet();
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  // 获取关注状态和粉丝数
  const fetchFollowData = useCallback(async () => {
    if (!account) return;

    try {
      const countRes = await fetch(`/api/user-follows/counts?address=${account}`);
      const countData = await countRes.json();
      setFollowersCount(countData.followersCount || 0);

      if (myAccount && !isOwnProfile) {
        const statusRes = await fetch(
          `/api/user-follows/user?targetAddress=${account}&followerAddress=${myAccount}`
        );
        const statusData = await statusRes.json();
        setIsFollowed(!!statusData.followed);
      }
    } catch (error) {
      console.error("Failed to fetch follow data:", error);
    }
  }, [account, myAccount, isOwnProfile]);

  useEffect(() => {
    fetchFollowData();
  }, [fetchFollowData]);

  // 处理关注/取消关注
  const handleFollowToggle = async () => {
    if (!myAccount) {
      toast.error(tProfile("wallet.connectFirst"));
      return;
    }

    setIsFollowLoading(true);
    try {
      const res = await fetch("/api/user-follows/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAddress: account }),
      });

      const data = await res.json();
      if (data.success) {
        setIsFollowed(data.followed);
        setFollowersCount((prev) => (data.followed ? prev + 1 : prev - 1));
        toast.success(
          data.followed ? tProfile("follow.followSuccess") : tProfile("follow.unfollowSuccess")
        );
      }
    } catch (error) {
      toast.error(tProfile("follow.failed"));
    } finally {
      setIsFollowLoading(false);
    }
  };
  return (
    <GradientPage className="pb-24 pt-24">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl shadow-purple-500/10 p-6 sticky top-24 overflow-hidden group">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-300/20 rounded-full blur-3xl group-hover:bg-purple-300/30 transition-colors duration-700" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-pink-300/20 rounded-full blur-3xl group-hover:bg-pink-300/30 transition-colors duration-700" />

              <div className="flex flex-col items-center text-center mb-8 relative z-10">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 p-[3px] mb-4 shadow-lg shadow-fuchsia-500/30 hover:scale-105 transition-transform duration-300">
                  <div className="w-full h-full rounded-full bg-white p-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={buildDiceBearUrl(account || "User")}
                      alt="Avatar"
                      className="w-full h-full object-cover rounded-full bg-gray-50"
                    />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-1 bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600">
                  {username}
                </h2>
                <button
                  type="button"
                  disabled={!account}
                  onClick={async () => {
                    if (!account) return;
                    try {
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(account);
                      } else {
                        const textarea = document.createElement("textarea");
                        textarea.value = account;
                        textarea.style.position = "fixed";
                        textarea.style.opacity = "0";
                        document.body.appendChild(textarea);
                        textarea.focus();
                        textarea.select();
                        try {
                          document.execCommand("copy");
                        } finally {
                          document.body.removeChild(textarea);
                        }
                      }
                      toast.success(tProfile("wallet.addressCopied"));
                    } catch {
                      toast.error(tProfile("wallet.copyAddress"));
                    }
                  }}
                  className="flex items-center gap-2 bg-white/80 border border-purple-100 px-4 py-1.5 rounded-full text-xs font-bold font-mono mb-6 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:border-purple-200 hover:shadow-md"
                >
                  <Wallet className="w-3.5 h-3.5 text-purple-600" />
                  <span className={account ? "text-purple-600" : "text-gray-400"}>
                    {account ? formatAddress(account) : tProfile("username.walletDisconnected")}
                  </span>
                </button>

                <div className="grid grid-cols-3 gap-2.5 w-full mb-8">
                  <div className="cursor-pointer" onClick={() => setActiveTab("predictions")}>
                    <SidebarStatCard
                      value={positionsCount}
                      label={tProfile("sidebar.stats.predictions")}
                      icon={Target}
                      color="violet"
                    />
                  </div>
                  <div className="cursor-pointer" onClick={() => setActiveTab("followers")}>
                    <SidebarStatCard
                      value={followersCount}
                      label={tProfile("sidebar.stats.followers")}
                      icon={Users}
                      color="emerald"
                    />
                  </div>
                  <div className="cursor-pointer" onClick={() => setActiveTab("history")}>
                    <SidebarStatCard
                      value={historyCount}
                      label={tProfile("sidebar.stats.history")}
                      icon={Zap}
                      color="cyan"
                    />
                  </div>
                </div>

                {!isOwnProfile && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 mb-2 ${
                      isFollowed
                        ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                        : "bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white"
                    }`}
                  >
                    {isFollowLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowed ? (
                      <UserMinus className="w-4 h-4" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    {isFollowLoading
                      ? tProfile("follow.loading")
                      : isFollowed
                        ? tProfile("follow.unfollowButton")
                        : tProfile("follow.followTraderButton")}
                  </button>
                )}
              </div>

              <nav className="space-y-2 relative z-10">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm group/btn ${
                      activeTab === tab.id
                        ? "bg-gray-900 text-white shadow-xl shadow-gray-900/20 scale-[1.02]"
                        : "text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-md hover:scale-[1.02]"
                    }`}
                  >
                    <tab.icon
                      className={`w-5 h-5 transition-colors ${
                        activeTab === tab.id
                          ? "text-fuchsia-400"
                          : "text-gray-400 group-hover/btn:text-fuchsia-500"
                      }`}
                    />
                    {tab.label}
                    {activeTab === tab.id && (
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    )}
                  </button>
                ))}
              </nav>

              {isOwnProfile && (
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all font-bold text-sm">
                    <Settings className="w-5 h-5" />
                    {tProfile("sidebar.settings")}
                  </button>
                  {account && (
                    <button
                      onClick={disconnect}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all font-bold text-sm"
                    >
                      <LogOut className="w-5 h-5" />
                      {tProfile("sidebar.disconnect")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === "predictions" && <PredictionsTab address={account} />}
                {activeTab === "history" && <HistoryTab initialHistory={history} />}
                {activeTab === "following" && <FollowingTab />}
                {activeTab === "followers" && account && <FollowersTab address={account} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </GradientPage>
  );
}
