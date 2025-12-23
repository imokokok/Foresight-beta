"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  TrendingUp,
  Users,
  Search,
  Filter,
  Hash,
  MoreHorizontal,
  ArrowUpRight,
  Activity,
  BarChart3,
  MessageCircle,
  Globe,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import ChatPanel from "@/components/ChatPanel";
import { useWallet } from "@/contexts/WalletContext";
import { fetchUsernamesByAddresses, getDisplayName } from "@/lib/userProfiles";
import { useCategories } from "@/hooks/useQueries";

type PredictionItem = {
  id: number;
  title: string;
  description?: string;
  category?: string;
  created_at?: string;
  followers_count?: number;
};

const ALLOWED_CATEGORIES = [
  "体育",
  "娱乐",
  "时政",
  "天气",
  "科技",
  "商业",
  "加密货币",
  "更多",
] as const;
const CATEGORIES = [{ id: "all", name: "All Topics", icon: Globe }].concat(
  ALLOWED_CATEGORIES.map((c) => ({ id: c, name: c, icon: Activity }))
);

function normalizeCategory(raw?: string): string {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (!s) return "科技";
  if (["tech", "technology", "ai", "人工智能", "机器人", "科技"].includes(s)) return "科技";
  if (["entertainment", "media", "娱乐", "综艺", "影视"].includes(s)) return "娱乐";
  if (
    [
      "politics",
      "时政",
      "政治",
      "news",
      "国际",
      "finance",
      "经济",
      "宏观",
      "market",
      "stocks",
    ].includes(s)
  )
    return "时政";
  if (["weather", "气象", "天气", "climate", "气候"].includes(s)) return "天气";
  if (["sports", "体育", "football", "soccer", "basketball", "nba"].includes(s)) return "体育";
  if (["business", "商业", "finance", "biz"].includes(s)) return "商业";
  if (["crypto", "加密货币", "btc", "eth", "blockchain", "web3"].includes(s)) return "加密货币";
  if (["more", "更多", "other", "其他"].includes(s)) return "更多";
  return "科技";
}

type CategoryStyle = {
  chip: string;
  chipActive: string;
  badge: string;
  border: string;
  softBg: string;
  accentText: string;
  activeCard: string;
  accentBar: string;
  chatGradient: string;
  headerGradient: string;
  frameSurfaceGradient: string;
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  体育: {
    chip: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200",
    chipActive:
      "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-200 shadow-md border-transparent",
    badge: "bg-orange-200 text-orange-800",
    border: "border-orange-200 hover:border-orange-300",
    softBg: "bg-gradient-to-br from-orange-100/60 to-white/0",
    accentText: "text-orange-600",
    activeCard: "bg-white/80 border-orange-200 shadow-md shadow-orange-100/50 scale-[1.02]",
    accentBar: "bg-orange-500",
    chatGradient: "from-orange-200/70 via-amber-100/60 to-white/0",
    headerGradient: "from-orange-500/90 to-amber-600/90",
    frameSurfaceGradient: "from-orange-100/70 via-amber-100/60 to-white/0",
  },
  娱乐: {
    chip: "bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200",
    chipActive:
      "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-200 shadow-md border-transparent",
    badge: "bg-pink-200 text-pink-800",
    border: "border-pink-200 hover:border-pink-300",
    softBg: "bg-gradient-to-br from-pink-100/60 to-white/0",
    accentText: "text-pink-600",
    activeCard: "bg-white/80 border-pink-200 shadow-md shadow-pink-100/50 scale-[1.02]",
    accentBar: "bg-pink-500",
    chatGradient: "from-pink-200/70 via-rose-100/60 to-white/0",
    headerGradient: "from-pink-500/90 to-rose-600/90",
    frameSurfaceGradient: "from-pink-100/70 via-rose-100/60 to-white/0",
  },
  时政: {
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200",
    chipActive:
      "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-200 shadow-md border-transparent",
    badge: "bg-emerald-200 text-emerald-800",
    border: "border-emerald-200 hover:border-emerald-300",
    softBg: "bg-gradient-to-br from-emerald-100/60 to-white/0",
    accentText: "text-emerald-600",
    activeCard: "bg-white/80 border-emerald-200 shadow-md shadow-emerald-100/50 scale-[1.02]",
    accentBar: "bg-emerald-500",
    chatGradient: "from-emerald-200/70 via-teal-100/60 to-white/0",
    headerGradient: "from-emerald-500/90 to-teal-600/90",
    frameSurfaceGradient: "from-emerald-100/70 via-teal-100/60 to-white/0",
  },
  天气: {
    chip: "bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-200",
    chipActive:
      "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-cyan-200 shadow-md border-transparent",
    badge: "bg-cyan-200 text-cyan-800",
    border: "border-cyan-200 hover:border-cyan-300",
    softBg: "bg-gradient-to-br from-cyan-100/60 to-white/0",
    accentText: "text-cyan-600",
    activeCard: "bg-white/80 border-cyan-200 shadow-md shadow-cyan-100/50 scale-[1.02]",
    accentBar: "bg-cyan-500",
    chatGradient: "from-cyan-200/70 via-blue-100/60 to-white/0",
    headerGradient: "from-cyan-500/90 to-blue-600/90",
    frameSurfaceGradient: "from-cyan-100/70 via-blue-100/60 to-white/0",
  },
  科技: {
    chip: "bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200",
    chipActive:
      "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-violet-200 shadow-md border-transparent",
    badge: "bg-violet-200 text-violet-800",
    border: "border-violet-200 hover:border-violet-300",
    softBg: "bg-gradient-to-br from-violet-100/60 to-white/0",
    accentText: "text-violet-600",
    activeCard: "bg-white/80 border-violet-200 shadow-md shadow-violet-100/50 scale-[1.02]",
    accentBar: "bg-violet-500",
    chatGradient: "from-violet-200/70 via-purple-100/60 to-white/0",
    headerGradient: "from-violet-500/90 to-purple-600/90",
    frameSurfaceGradient: "from-violet-100/70 via-purple-100/60 to-white/0",
  },
  更多: {
    chip: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200",
    chipActive:
      "bg-gradient-to-r from-gray-500 to-slate-500 text-white shadow-gray-200 shadow-md border-transparent",
    badge: "bg-gray-200 text-gray-800",
    border: "border-gray-200 hover:border-gray-300",
    softBg: "bg-gradient-to-br from-gray-100/60 to-white/0",
    accentText: "text-gray-600",
    activeCard: "bg-white/80 border-gray-200 shadow-md shadow-gray-100/50 scale-[1.02]",
    accentBar: "bg-gray-500",
    chatGradient: "from-gray-200/70 via-slate-100/60 to-white/0",
    headerGradient: "from-gray-500/90 to-slate-600/90",
    frameSurfaceGradient: "from-gray-100/70 via-slate-100/60 to-white/0",
  },
  default: {
    chip: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
    chipActive:
      "bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-slate-200 shadow-md border-transparent",
    badge: "bg-gray-200 text-gray-800",
    border: "border-slate-200 hover:border-slate-300",
    softBg: "bg-gradient-to-br from-slate-100/60 to-white/0",
    accentText: "text-slate-600",
    activeCard: "bg-white/80 border-indigo-200 shadow-md shadow-indigo-100/50 scale-[1.02]",
    accentBar: "bg-indigo-500",
    chatGradient: "from-indigo-200/70 via-purple-100/60 to-white/0",
    headerGradient: "from-indigo-500/90 to-purple-600/90",
    frameSurfaceGradient: "from-indigo-100/70 via-purple-100/60 to-white/0",
  },
};

function getCategoryStyle(cat: string): CategoryStyle {
  return CATEGORY_STYLES[cat] || CATEGORY_STYLES.default;
}

type ForumCategory = {
  id: string;
  name: string;
  icon: typeof Activity;
};

type ForumSidebarProps = {
  categories: ForumCategory[];
  activeCategory: string;
  setActiveCategory: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filtered: PredictionItem[];
  loading: boolean;
  error: string | null;
  selectedTopicId: number | null;
  setSelectedTopicId: React.Dispatch<React.SetStateAction<number | null>>;
};

type ForumChatFrameProps = {
  account: string | null | undefined;
  currentTopic: PredictionItem | null;
  activeCat: string;
  displayName: (addr: string) => string;
  loading: boolean;
  error: string | null;
};

function useForumData() {
  const { account, formatAddress } = useWallet();
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const { data: categoriesData } = useCategories();

  useEffect(() => {
    if (!account) return;
    const run = async () => {
      const res = await fetchUsernamesByAddresses([account]);
      if (res && Object.keys(res).length > 0) {
        setNameMap((prev) => ({ ...prev, ...res }));
      }
    };
    run();
  }, [account]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/predictions?includeOutcomes=0");
        if (!res.ok) {
          throw new Error("Failed to fetch predictions");
        }
        const data = await res.json();
        const list: PredictionItem[] = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) {
          setPredictions(list);
          setSelectedTopicId((prev) => prev ?? list[0]?.id ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setError("加载预测话题失败，请稍后重试");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
      const dynamic = (categoriesData as any[])
        .map((item) => {
          const name = String((item as any).name || "").trim();
          if (!name) {
            return null;
          }
          return {
            id: name,
            name,
            icon: Activity,
          };
        })
        .filter(Boolean) as {
        id: string;
        name: string;
        icon: typeof Activity;
      }[];
      return [{ id: "all", name: "All Topics", icon: Globe }].concat(dynamic);
    }
    return CATEGORIES;
  }, [categoriesData]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return predictions.filter((p) => {
      const cat = normalizeCategory(p.category);
      const catOk = activeCategory === "all" || cat === activeCategory;
      const qOk =
        !q ||
        String(p.title || "")
          .toLowerCase()
          .includes(q);
      return catOk && qOk;
    });
  }, [predictions, activeCategory, searchQuery]);

  const currentTopic = useMemo(() => {
    const id = selectedTopicId;
    if (!id && filtered.length) return filtered[0];
    return predictions.find((p) => p.id === id) || filtered[0] || null;
  }, [predictions, filtered, selectedTopicId]);
  const activeCat = normalizeCategory(currentTopic?.category);
  const displayName = (addr: string) => getDisplayName(addr, nameMap, formatAddress);

  return {
    account,
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    filtered,
    loading,
    error,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
    displayName,
  };
}

function ForumSidebar({
  categories,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  filtered,
  loading,
  error,
  selectedTopicId,
  setSelectedTopicId,
}: ForumSidebarProps) {
  return (
    <div className="w-80 flex-shrink-0 border-r border-white/30 flex flex-col overflow-x-hidden">
      <div className="p-5 border-b border-white/20 bg-white/10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand shadow-lg shadow-indigo-200/50 border border-white/50">
            <MessageSquare size={20} fill="currentColor" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 leading-tight tracking-tight">
              Forum
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1 h-1 rounded-full bg-brand animate-pulse"></div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">
                Community
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat) => {
            const style = getCategoryStyle(cat.name);
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 border ${
                  isActive ? style.chipActive : style.chip
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-black/5 rounded-xl blur-md group-focus-within:bg-brand/5 transition-all"></div>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors z-10"
            size={16}
          />
          <input
            type="text"
            placeholder="搜索话题或讨论..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all outline-none relative z-0 shadow-sm group-hover:shadow-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-white/80">
            {loading ? "加载话题中..." : error ? "暂无可用话题" : "暂无话题"}
          </div>
        ) : (
          filtered.map((topic) => {
            const catName = normalizeCategory(topic.category);
            const style = getCategoryStyle(catName);
            const isActive = selectedTopicId === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 border group relative overflow-hidden ${style.softBg} ${
                  isActive
                    ? style.activeCard
                    : `border-transparent hover:ring-1 hover:ring-white/40 hover:shadow-sm ${style.border}`
                }`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${style.accentBar} ${
                    isActive ? "" : "opacity-40"
                  }`}
                />
                <div className="flex justify-between items-start mb-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${style.badge}`}
                  >
                    {catName}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {topic.created_at ? new Date(topic.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <h3 className="text-sm font-bold leading-snug mb-2 text-slate-700 group-hover:text-slate-900 line-clamp-2">
                  {topic.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {topic.followers_count ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp size={12} className={style.accentText} /> {catName}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ForumChatFrame({
  account,
  currentTopic,
  activeCat,
  displayName,
  loading,
  error,
}: ForumChatFrameProps) {
  return (
    <div className="flex-1 flex flex-col">
      <header
        className={`h-16 px-6 border-b border-white/20 flex items-center justify-between bg-gradient-to-r ${
          getCategoryStyle(activeCat).headerGradient
        } sticky top-0 z-20 text-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.15)]`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-inner">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white truncate text-lg">
                {currentTopic?.title || "聊天室"}
              </h2>
              <Sparkles className="w-4 h-4 text-white/80" />
            </div>
            <div className="flex items-center gap-2 text-xs text-white/80">
              <span className="flex items-center gap-1 bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/30 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Discussion
              </span>
              <span>•</span>
              <span className="font-mono text-white/70">#{currentTopic?.id ?? "-"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-xs font-medium bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/20">
            {account ? `你：${displayName(account)}` : "未连接钱包"}
          </div>

          <div className="w-px h-8 bg-white/30" />

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
              Followers
            </span>
            <span className="text-sm font-bold text-white flex items-center gap-1">
              <Users size={14} className={getCategoryStyle(activeCat).accentText} />
              {currentTopic?.followers_count ?? 0}
            </span>
          </div>

          <div className="w-px h-8 bg-white/30" />

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
              Category
            </span>
            <span className="text-sm font-bold text-white flex items-center gap-1">
              <TrendingUp size={14} className={getCategoryStyle(activeCat).accentText} />
              {normalizeCategory(currentTopic?.category)}
            </span>
          </div>

          <div className="w-px h-8 bg-white/30" />

          <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden bg-transparent flex flex-col">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${
            getCategoryStyle(activeCat).chatGradient
          } opacity-30`}
        />
        <div className="flex-1 flex flex-col z-10 relative">
          {currentTopic?.id ? (
            <ChatPanel
              eventId={currentTopic.id}
              roomTitle={currentTopic.title}
              roomCategory={currentTopic.category}
              hideHeader={true}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-white/80 backdrop-blur-md">
              {loading
                ? "加载话题中..."
                : error
                  ? "加载失败，请稍后重试"
                  : "请选择一个话题开始讨论"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForumPage() {
  const {
    account,
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    filtered,
    loading,
    error,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
    displayName,
  } = useForumData();

  return (
    <div className="h-screen w-full bg-[#f8faff] p-4 lg:p-6 flex overflow-hidden overflow-x-hidden font-sans text-slate-800 relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/30 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/30 blur-[100px]" />
      </div>
      {/* TV Frame: unify left cards and chat into one frame */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex-1 flex rounded-[32px] bg-gradient-to-br ${
          getCategoryStyle(activeCat).frameSurfaceGradient
        } backdrop-blur-xl border border-white/30 shadow-2xl shadow-indigo-100/50 overflow-hidden z-10`}
      >
        <ForumSidebar
          categories={categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filtered={filtered}
          loading={loading}
          error={error}
          selectedTopicId={selectedTopicId}
          setSelectedTopicId={setSelectedTopicId}
        />
        <ForumChatFrame
          account={account}
          currentTopic={currentTopic}
          activeCat={activeCat}
          displayName={displayName}
          loading={loading}
          error={error}
        />
      </motion.div>
    </div>
  );
}
