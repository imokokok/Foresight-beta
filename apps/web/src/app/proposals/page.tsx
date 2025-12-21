"use client";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  TrendingUp,
  Clock,
  Flame,
  Zap,
  Loader2,
  Shield,
  Sparkles,
  Trophy,
  LayoutGrid,
  MessageCircle,
  Dices,
  Vote,
  Wallet,
  ArrowRight,
  Target,
  Hash,
  Activity,
  User,
  CheckCircle2,
  ExternalLink,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ProposalCard from "./ProposalCard";
import CreateProposalModal from "./CreateProposalModal";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useQueries";

// Fetch proposals (threads with eventId=0)
const fetchProposals = async () => {
  const res = await fetch("/api/forum?eventId=0");
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data.threads || [];
};

const INSPIRATIONS = [
  "Will AI achieve AGI by 2026?",
  "Will humans land on Mars before 2030?",
  "Is Bitcoin hitting $100k this year?",
  "Who wins the next World Cup?",
  "Will Apple release a folding iPhone?",
];

const OFFICIAL_PROPOSALS = [
  {
    id: "v2_upgrade",
    title: "Protocol Upgrade v2.0",
    description: "Major architecture overhaul & gas optimization",
    icon: Zap,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  {
    id: "treasury_q3",
    title: "Q3 Treasury Report",
    description: "Budget allocation review for next quarter",
    icon: Wallet,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
  },
  {
    id: "community_grants",
    title: "Community Grants",
    description: "Funding program for ecosystem builders",
    icon: Sparkles,
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
];

export default function ProposalsPage() {
  const [filter, setFilter] = useState<"hot" | "new" | "top">("hot");
  const [category, setCategory] = useState("All");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { account, connectWallet } = useWallet();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: categoriesData } = useCategories();

  // Inspiration Widget State
  const [inspiration, setInspiration] = useState(INSPIRATIONS[0]);
  const [isRolling, setIsRolling] = useState(false);

  const rollInspiration = () => {
    setIsRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setInspiration(INSPIRATIONS[Math.floor(Math.random() * INSPIRATIONS.length)]);
      count++;
      if (count > 10) {
        clearInterval(interval);
        setIsRolling(false);
      }
    }, 100);
  };

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: fetchProposals,
  });

  const { data: userVotesData } = useQuery({
    queryKey: ["proposalUserVotes", account],
    queryFn: async () => {
      const res = await fetch("/api/forum/user-votes?eventId=0");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load votes");
      return Array.isArray(data.votes) ? data.votes : [];
    },
    enabled: !!account,
  });

  const userVotesMap: Record<number, "up" | "down"> = {};
  (userVotesData || []).forEach((v: any) => {
    if (v?.content_type === "thread" && v?.content_id != null) {
      const idNum = Number(v.content_id);
      if (Number.isFinite(idNum)) {
        userVotesMap[idNum] = String(v.vote_type) === "down" ? "down" : "up";
      }
    }
  });

  const voteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: "up" | "down" }) => {
      if (!account) {
        connectWallet();
        throw new Error("Please connect wallet");
      }
      const res = await fetch("/api/forum/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: 0,
          type: "thread",
          id,
          dir: type,
          walletAddress: account,
        }),
      });
      if (!res.ok) throw new Error("Vote failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });

  const proposalsWithUserVote = proposals.map((p: any) => ({
    ...p,
    userVote: userVotesMap[p.id] || p.userVote,
  }));

  const filteredProposals = proposalsWithUserVote.filter((p: any) => {
    const inCategory = category === "All" || p.category === category;
    if (!inCategory) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const title = String(p.title || "").toLowerCase();
    const content = String(p.content || "").toLowerCase();
    return title.includes(q) || content.includes(q);
  });

  const sortedProposals = [...filteredProposals].sort((a: any, b: any) => {
    if (filter === "hot") {
      const scoreA = (a.upvotes || 0) - (a.downvotes || 0) + (a.comments?.length || 0) * 2;
      const scoreB = (b.upvotes || 0) - (b.downvotes || 0) + (b.comments?.length || 0) * 2;
      return scoreB - scoreA;
    }
    if (filter === "new") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (filter === "top") {
      return (b.upvotes || 0) - (b.downvotes || 0) - ((a.upvotes || 0) - (a.downvotes || 0));
    }
    return 0;
  });

  const categories = React.useMemo(() => {
    const base = [{ id: "All", label: "Overview", icon: LayoutGrid }];
    if (!Array.isArray(categoriesData) || categoriesData.length === 0) {
      return base;
    }
    const seen = new Set<string>();
    const items =
      (categoriesData as any[]).map((item) => {
        const name = String((item as any).name || "").trim();
        if (!name || seen.has(name)) {
          return null;
        }
        seen.add(name);
        let icon = Hash;
        if (name === "General") icon = MessageCircle;
        else if (name === "Tech") icon = Zap;
        else if (name === "Business") icon = Target;
        else if (name === "Crypto") icon = Sparkles;
        else if (name === "Sports") icon = Trophy;
        else if (name === "Politics") icon = Shield;
        return { id: name, label: name, icon };
      }) || [];
    return base.concat(items.filter((x): x is { id: string; label: string; icon: any } => !!x));
  }, [categoriesData]);

  const activeProposalsCount = proposals.filter(
    (p: any) => (p.upvotes || 0) + (p.downvotes || 0) > 10
  ).length;

  return (
    <div className="h-[calc(100vh-64px)] w-full relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8 flex gap-6">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-200/40 rounded-full blur-[100px] mix-blend-multiply animate-pulse" />
        <div
          className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-200/40 rounded-full blur-[100px] mix-blend-multiply animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-purple-200/40 rounded-full blur-[100px] mix-blend-multiply animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* LEFT SIDEBAR: Dashboard Control (Fixed Width) */}
      <div className="hidden lg:flex flex-col w-64 shrink-0 gap-6 z-10 h-full overflow-y-auto scrollbar-hide pb-20">
        {/* User Stats - Minimalist with Tape */}
        <div className="bg-white border border-gray-200 rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col gap-4 relative">
          {/* Tape Effect */}
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-purple-100/80 backdrop-blur-sm rotate-[-2deg] shadow-sm mask-tape"
            style={{ clipPath: "polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)" }}
          />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden p-0.5">
              <img
                src={
                  account
                    ? `https://api.dicebear.com/7.x/identicon/svg?seed=${account}`
                    : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(
                        user?.email || "User"
                      )}&backgroundColor=e9d5ff`
                }
                alt="Avatar"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                Member
              </div>
              <div className="text-sm font-black text-gray-800 truncate">
                {(account || user?.email || "Guest").slice(0, 12)}
              </div>
            </div>
          </div>

          <div className="h-px bg-dashed-line my-1" />

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-2">
              <div className="text-lg font-black text-gray-800">
                {
                  proposals.filter((p: any) => {
                    const me = account || user?.id || "";
                    return me && String(p.user_id || "").toLowerCase() === String(me).toLowerCase();
                  }).length
                }
              </div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">My Posts</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-2">
              <div className="text-lg font-black text-gray-800">{proposals.length}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Total</div>
            </div>
          </div>

          <button
            onClick={() => {
              if (!account) connectWallet();
              else setCreateModalOpen(true);
            }}
            className="w-full py-3 rounded-xl bg-gray-900 text-white text-xs font-bold shadow-lg shadow-gray-900/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            New Proposal
          </button>
        </div>

        {/* Navigation / Filters - List Style */}
        <div className="flex flex-col gap-2">
          <div className="px-3 py-1 text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            Views
          </div>
          {[
            { id: "hot", label: "Hot & Trending", icon: Flame },
            { id: "new", label: "Newest First", icon: Clock },
            { id: "top", label: "Top Voted", icon: Trophy },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all relative overflow-hidden ${
                filter === item.id
                  ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                  : "text-gray-500 hover:bg-white/60 hover:text-gray-900"
              }`}
            >
              {filter === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-500 rounded-r-full" />
              )}
              <item.icon
                className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                  filter === item.id
                    ? "text-purple-500"
                    : "text-gray-400 group-hover:text-purple-500"
                }`}
              />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT AREA: List View */}
      <div className="flex-1 flex flex-col min-w-0 z-10 h-full">
        {/* Header (Mobile Only) */}
        <div className="lg:hidden flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-slate-900">Proposals</h1>
          <button
            onClick={() => {
              if (!account) connectWallet();
              else setCreateModalOpen(true);
            }}
            className="p-3 rounded-full bg-slate-900 text-white shadow-lg"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable List Container */}
        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
          <div className="flex-none mb-6 sticky top-0 z-20 backdrop-blur-sm py-2 -mx-2 px-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search proposals..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white/80 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400"
                  />
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400">
                  <Activity className="w-3 h-3" />
                  <span>{sortedProposals.length}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                      category === cat.id
                        ? "bg-slate-900 text-white shadow-slate-900/10 scale-105"
                        : "bg-transparent text-slate-500 border border-slate-300/60 hover:border-slate-200 hover:bg-slate-900/5"
                    }`}
                  >
                    <cat.icon
                      className={`w-3.5 h-3.5 ${
                        category === cat.id ? "text-white" : "text-slate-400"
                      }`}
                    />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <p className="text-sm font-bold text-slate-400">Loading governance data...</p>
            </div>
          ) : sortedProposals.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
                <MessageCircle className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">No proposals yet</h3>
              <p className="text-slate-500 font-medium mb-8">
                Be the first to share your idea with the community.
              </p>
              <button
                onClick={() => {
                  if (!account) connectWallet();
                  else setCreateModalOpen(true);
                }}
                className="px-8 py-2.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all"
              >
                Create Proposal
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pb-20">
              <AnimatePresence mode="popLayout">
                {sortedProposals.map((proposal: any) => (
                  <motion.div
                    key={proposal.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <div className="h-[200px]">
                      <ProposalCard
                        proposal={proposal}
                        onVote={(id, type) => voteMutation.mutate({ id, type })}
                        onClick={(id) => router.push(`/proposals/${id}`)}
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Widgets */}
      <div className="hidden 2xl:flex flex-col w-72 shrink-0 gap-6 z-10 h-full overflow-y-auto scrollbar-hide pb-20">
        {/* Official Featured Widget (New) */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-5 border border-white/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900">Featured</h3>
            <button className="text-[10px] font-bold text-blue-600 hover:underline">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {OFFICIAL_PROPOSALS.map((item) => (
              <div
                key={item.id}
                className="group p-3 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex gap-3 items-center"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shadow-sm shrink-0`}
                >
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium truncate">
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inspiration Widget */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -ml-10 -mb-10" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
                <Sparkles className="w-4 h-4 text-blue-300" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider opacity-60">Insight</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={inspiration}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                className="text-sm font-bold leading-relaxed opacity-90 mb-6 h-16 text-slate-100"
              >
                "{inspiration}"
              </motion.p>
            </AnimatePresence>

            <button
              onClick={rollInspiration}
              disabled={isRolling}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover:border-white/20 text-slate-300 group-hover:text-white"
            >
              <Dices className={`w-3.5 h-3.5 ${isRolling ? "animate-spin" : ""}`} />
              {isRolling ? "Analyzing..." : "Next Insight"}
            </button>
          </div>
        </div>

        {/* Governance Info */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-5 border border-white/50 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
              <Vote className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900">Governance</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Proposal Threshold</span>
              <span className="font-bold text-slate-900">100 VP</span>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Voting Period</span>
              <span className="font-bold text-slate-900">3 Days</span>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Quorum</span>
              <span className="font-bold text-slate-900">10%</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200/50">
            <button className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </div>

      <CreateProposalModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["proposals"] });
          setFilter("new");
        }}
      />
    </div>
  );
}
