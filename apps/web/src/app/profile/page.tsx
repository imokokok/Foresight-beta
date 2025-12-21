"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Clock,
  TrendingUp,
  User,
  Settings,
  LogOut,
  Wallet,
  History,
  Bookmark,
  ChevronRight,
  ArrowRight,
  Users,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

// Mock data for browsing history (in a real app this would come from local storage or API)
const MOCK_HISTORY = [
  {
    id: "1",
    title: "Bitcoin 会在 2024 年底突破 10 万美元吗？",
    image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bitcoin",
    viewed_at: "10分钟前",
    category: "科技",
  },
  {
    id: "2",
    title: "SpaceX 星舰第五次试飞能否成功回收？",
    image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=SpaceX",
    viewed_at: "2小时前",
    category: "科技",
  },
  {
    id: "3",
    title: "2024 欧洲杯冠军预测",
    image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Euro2024",
    viewed_at: "昨天",
    category: "体育",
  },
];

// Mock data for user predictions
// const MOCK_PREDICTIONS = [
//   {
//     id: "101",
//     title: "GPT-5 将在 2024 年发布",
//     stake: 50,
//     outcome: "Yes",
//     status: "active",
//     pnl: "+12.5%",
//     image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=GPT5"
//   },
//   {
//     id: "102",
//     title: "美联储 6 月降息",
//     stake: 100,
//     outcome: "No",
//     status: "settled",
//     pnl: "-100%",
//     image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=FedRate"
//   }
// ];

type TabType = "overview" | "predictions" | "history" | "following";

export default function ProfilePage() {
  const { account, disconnectWallet: disconnect } = useWallet();
  const { user } = useAuth();
  const profileCtx = useUserProfileOptional();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [history, setHistory] = useState(MOCK_HISTORY);
  const [username, setUsername] = useState("匿名用户");
  const [portfolioStats, setPortfolioStats] = useState<{
    total_invested: number;
    active_count: number;
    win_rate: string;
  } | null>(null);
  const [positionsCount, setPositionsCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Load history and aggregates
  useEffect(() => {
    const loadHistory = async () => {
      if (!account) return;
      try {
        const res = await fetch(`/api/history?address=${account}`);
        const data = await res.json();
        if (data.history) {
          setHistory(data.history);
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    loadHistory();
    const loadPortfolio = async () => {
      if (!account) return;
      try {
        const res = await fetch(`/api/user-portfolio?address=${account}`);
        const data = await res.json();
        if (Array.isArray(data.positions)) {
          setPositionsCount(data.positions.length);
        }
        if (data.stats) {
          setPortfolioStats({
            total_invested: Number(data.stats.total_invested || 0),
            active_count: Number(data.stats.active_count || 0),
            win_rate: String(data.stats.win_rate || "0%"),
          });
        }
      } catch (e) {
        console.error("Failed to load portfolio", e);
      }
    };

    const loadFollowing = async () => {
      if (!account) return;
      try {
        const res = await fetch(`/api/following?address=${account}`);
        const data = await res.json();
        if (Array.isArray(data.following)) {
          setFollowingCount(data.following.length);
        }
      } catch (e) {
        console.error("Failed to load following", e);
      }
    };

    loadPortfolio();
    loadFollowing();
  }, [account]);

  useEffect(() => {
    if (!account) {
      setUsername("匿名用户");
      return;
    }
    const p = profileCtx?.profile;
    if (p?.username) {
      setUsername(p.username);
      return;
    }
    if (user?.user_metadata?.username) {
      setUsername(user.user_metadata.username);
      return;
    }
    if (user?.email) {
      setUsername(user.email.split("@")[0]);
      return;
    }
    setUsername(`User ${account.slice(0, 4)}`);
  }, [account, user, profileCtx?.profile]);

  const tabs = [
    { id: "overview", label: "总览", icon: User },
    { id: "predictions", label: "我的预测", icon: TrendingUp },
    { id: "history", label: "浏览历史", icon: History },
    { id: "following", label: "我的关注", icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-fuchsia-50 to-rose-100 pb-24 pt-24">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar / User Card */}
          <div className="lg:col-span-1">
            <div className="bg-white/70 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-2xl shadow-purple-500/10 p-6 sticky top-24 overflow-hidden group">
              {/* 装饰光晕 */}
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-300/20 rounded-full blur-3xl group-hover:bg-purple-300/30 transition-colors duration-700" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-pink-300/20 rounded-full blur-3xl group-hover:bg-pink-300/30 transition-colors duration-700" />

              <div className="flex flex-col items-center text-center mb-8 relative z-10">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 p-[3px] mb-4 shadow-lg shadow-fuchsia-500/30 hover:scale-105 transition-transform duration-300">
                  <div className="w-full h-full rounded-full bg-white p-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${account || "User"}`}
                      alt="Avatar"
                      className="w-full h-full object-cover rounded-full bg-gray-50"
                    />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-1 bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600">
                  {username}
                </h2>
                <div className="flex items-center gap-2 bg-white/80 border border-purple-100 px-4 py-1.5 rounded-full text-xs font-bold font-mono text-purple-600 mb-6 shadow-sm">
                  <Wallet className="w-3.5 h-3.5" />
                  {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "未连接钱包"}
                </div>

                <div className="grid grid-cols-3 gap-3 w-full mb-2">
                  <div className="text-center p-3 bg-violet-50/80 rounded-2xl border border-violet-100 hover:bg-violet-100/80 transition-colors">
                    <div className="text-xl font-black text-violet-600">{positionsCount}</div>
                    <div className="text-[10px] text-violet-400 font-bold uppercase tracking-wide">
                      预测
                    </div>
                  </div>
                  <div className="text-center p-3 bg-fuchsia-50/80 rounded-2xl border border-fuchsia-100 hover:bg-fuchsia-100/80 transition-colors">
                    <div className="text-xl font-black text-fuchsia-600">{followingCount}</div>
                    <div className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wide">
                      关注
                    </div>
                  </div>
                  <div className="text-center p-3 bg-cyan-50/80 rounded-2xl border border-cyan-100 hover:bg-cyan-100/80 transition-colors">
                    <div className="text-xl font-black text-cyan-600">{history.length}</div>
                    <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wide">
                      浏览
                    </div>
                  </div>
                </div>
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

              <div className="mt-8 pt-8 border-t border-gray-100">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all font-bold text-sm">
                  <Settings className="w-5 h-5" />
                  设置
                </button>
                {account && (
                  <button
                    onClick={disconnect}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all font-bold text-sm"
                  >
                    <LogOut className="w-5 h-5" />
                    断开连接
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === "overview" && (
                  <OverviewTab portfolioStats={portfolioStats} positionsCount={positionsCount} />
                )}
                {activeTab === "predictions" && <PredictionsTab />}
                {activeTab === "history" && <HistoryTab />}
                {activeTab === "following" && <FollowingTab />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  portfolioStats,
  positionsCount,
}: {
  portfolioStats: {
    total_invested: number;
    active_count: number;
    win_rate: string;
    realized_pnl?: number;
  } | null;
  positionsCount: number;
}) {
  const totalInvested = portfolioStats?.total_invested ?? 0;
  const realizedPnl = portfolioStats?.realized_pnl ?? 0;
  const winRate = portfolioStats?.win_rate ?? "0%";
  const winRateValue =
    Number(String(winRate).replace("%", "")) >= 0
      ? Number(String(winRate).replace("%", "")) || 0
      : 0;
  const clampedWinRate = Math.max(0, Math.min(100, winRateValue));
  const activeCount = portfolioStats?.active_count ?? 0;

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[2rem] p-6 text-white shadow-xl shadow-purple-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="relative z-10">
            <div className="text-purple-200 text-sm font-bold mb-1">总押注</div>
            <div className="text-3xl font-black mb-4">${totalInvested.toFixed(2)}</div>
            <div className="flex items-center gap-2 text-xs bg-white/20 w-fit px-2 py-1 rounded-lg backdrop-blur-md">
              <TrendingUp className="w-3 h-3" />
              <span>共参与 {positionsCount} 场预测</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
          <div className="text-gray-400 text-sm font-bold mb-1">累计收益</div>
          <div className="text-3xl font-black text-gray-900 mb-4">
            {realizedPnl >= 0 ? "+" : ""}
            {realizedPnl.toFixed(2)}
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${realizedPnl >= 0 ? "bg-green-500" : "bg-red-500"}`}
              style={{
                width: `${Math.max(
                  5,
                  Math.min(
                    100,
                    Math.abs(totalInvested > 0 ? (realizedPnl / totalInvested) * 100 : 0)
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
          <div className="text-gray-400 text-sm font-bold mb-1">胜率</div>
          <div className="text-3xl font-black text-gray-900 mb-4">{winRate}</div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${clampedWinRate}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
          <div className="text-gray-400 text-sm font-bold mb-1">参与场次</div>
          <div className="text-3xl font-black text-gray-900 mb-4">
            {positionsCount || activeCount}
          </div>
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white" />
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-500" />
          最近动态
        </h3>
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          {[1, 2, 3].map((_, i) => (
            <div
              key={i}
              className="p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-xs">
                {i === 0 ? "买入" : i === 1 ? "结算" : "浏览"}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-900">
                  {i === 0
                    ? "买入 Yes - Bitcoin 100k"
                    : i === 1
                      ? "结算收益 +$50"
                      : "浏览了 SpaceX 话题"}
                </div>
                <div className="text-xs text-gray-400">2小时前</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PredictionsTab() {
  const { account } = useWallet();
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tEvents = useTranslations();

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }

    const fetchPortfolio = async () => {
      try {
        const res = await fetch(`/api/user-portfolio?address=${account}`);
        if (!res.ok) throw new Error("Failed to fetch portfolio");
        const data = await res.json();
        setPredictions(data.positions || []);
      } catch (err) {
        setError("无法加载预测数据");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [account]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-20 text-red-500">{error}</div>;
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-gray-900 font-bold text-lg">暂无预测记录</h3>
        <p className="text-gray-500 text-sm">快去参与你的第一个预测吧！</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-purple-500" />
        我的预测
      </h3>
      <div className="grid gap-4">
        {predictions.map((pred) => {
          const yesProb =
            typeof pred.stats?.yesProbability === "number" ? pred.stats.yesProbability : 0.5;
          const noProb =
            typeof pred.stats?.noProbability === "number" ? pred.stats.noProbability : 1 - yesProb;

          const isYes = String(pred.outcome || "").toLowerCase() === "yes";
          const sideProb = isYes ? yesProb : noProb;
          const probPercent = Math.max(0, Math.min(100, Number((sideProb * 100).toFixed(1)) || 0));

          return (
            <Link href={`/prediction/${pred.id}`} key={pred.id}>
              <div className="bg-white rounded-[1.5rem] p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                <img
                  src={pred.image_url}
                  alt={pred.title || "预测封面"}
                  className="w-12 h-12 rounded-xl bg-gray-100 object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">
                    {tEvents(pred.title)}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold ${
                        isYes ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {pred.outcome}
                    </span>
                    <span>投入 ${pred.stake}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-purple-500" />
                      <span>成交 ${Number(pred.stats?.totalAmount || 0).toFixed(2)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-400" />
                      <span>{Number(pred.stats?.participantCount || 0)} 人参与</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                    <span>你选择方向的当前市场概率</span>
                    <span className="font-bold text-gray-700">{probPercent.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-bold ${
                      pred.pnl.startsWith("+") ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {pred.pnl}
                  </div>
                  <div className="text-xs text-gray-400 uppercase">{pred.status}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function HistoryTab() {
  const { account } = useWallet();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/history?address=${account}`);
        if (!res.ok) throw new Error("Failed to fetch history");
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [account]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-gray-900 font-bold text-lg">暂无浏览记录</h3>
        <p className="text-gray-500 text-sm">去探索更多有趣的预测吧！</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-purple-500" />
          浏览足迹
        </h3>
        {/* <button className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">
          清空记录
        </button> */}
      </div>
      <div className="grid gap-4">
        {history.map((item) => (
          <Link href={`/prediction/${item.id}`} key={item.id}>
            <div className="bg-white rounded-[1.5rem] p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                <img
                  src={item.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${item.id}`}
                  alt={item.title || "浏览记录封面"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {item.category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      {item.category}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(item.viewed_at).toLocaleString()}
                  </span>
                </div>
                <h4 className="font-bold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">
                  {item.title}
                </h4>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FollowingTab() {
  const { account } = useWallet();
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tEvents = useTranslations();

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }

    const fetchFollowing = async () => {
      try {
        const res = await fetch(`/api/following?address=${account}`);
        if (!res.ok) throw new Error("Failed to fetch following");
        const data = await res.json();
        setFollowing(data.following || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [account]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (following.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-gray-900 font-bold text-lg">暂无关注</h3>
        <p className="text-gray-500 text-sm">去发现一些感兴趣的预测事件吧！</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Heart className="w-5 h-5 text-purple-500" />
        我的关注
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {following.map((item) => (
          <Link href={`/prediction/${item.id}`} key={item.id}>
            <div className="bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group h-full flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <img
                  src={item.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${item.id}`}
                  alt={item.title || "关注事件封面"}
                  className="w-10 h-10 rounded-full bg-gray-100 object-cover"
                />
                <button className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                  <Heart className="w-4 h-4 fill-current" />
                </button>
              </div>
              <h4 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
                {tEvents(item.title)}
              </h4>
              <div className="mt-auto text-xs text-gray-500 flex items-center gap-2">
                <span className="bg-gray-100 px-2 py-1 rounded-md">
                  {item.followers_count} 人关注
                </span>
                {item.deadline && (
                  <span>• {new Date(item.deadline).toLocaleDateString()} 截止</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
