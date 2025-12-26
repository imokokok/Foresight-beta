import React from "react";
import Link from "next/link";
import { Plus, Flame, Clock, Trophy } from "lucide-react";
import type { ProposalFilter, ProposalItem } from "./proposalsListUtils";

type ProposalsLeftSidebarProps = {
  account: string | null | undefined;
  user: { id?: string | null; email?: string | null } | null;
  connectWallet: () => void;
  setCreateModalOpen: (open: boolean) => void;
  proposals: ProposalItem[];
  filter: ProposalFilter;
  setFilter: (value: ProposalFilter) => void;
};

export default function ProposalsLeftSidebar({
  account,
  user,
  connectWallet,
  setCreateModalOpen,
  proposals,
  filter,
  setFilter,
}: ProposalsLeftSidebarProps) {
  const myPostsCount = React.useMemo(() => {
    return proposals.filter((p: any) => {
      const me = account || user?.id || "";
      return me && String(p.user_id || "").toLowerCase() === String(me).toLowerCase();
    }).length;
  }, [account, user?.id, proposals]);
  return (
    <div className="hidden lg:flex flex-col w-64 shrink-0 gap-6 z-10 pb-20">
      <div className="bg-white border border-gray-200 rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col gap-4 relative">
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
              loading="lazy"
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
            <div className="text-lg font-black text-gray-800">{myPostsCount}</div>
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
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 text-xs font-bold border border-purple-200 shadow-md shadow-purple-200/80 hover:from-purple-400 hover:to-pink-400 hover:text-white hover:shadow-lg hover:shadow-purple-300/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
          New Proposal
        </button>
      </div>

      <div className="px-2 text-[11px] text-slate-600 leading-relaxed">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span className="font-semibold text-slate-800">
            提案广场是 Foresight 的“产品经理面板”
          </span>
        </div>
        <p className="mb-1">
          用于发起新预测市场想法或协议治理提案，由社区讨论与投票后决定是否上线为正式预测市场。
        </p>
        <p className="text-[10px] text-slate-500">
          想先看正在交易的市场？前往{" "}
          <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
            热门预测
          </Link>{" "}
          浏览已有事件；有想法但还不成熟，可以先在{" "}
          <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
            讨论区
          </Link>{" "}
          收集反馈。
        </p>
      </div>

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
            type="button"
            onClick={() => setFilter(item.id as any)}
            aria-pressed={filter === item.id}
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
                filter === item.id ? "text-purple-500" : "text-gray-400 group-hover:text-purple-500"
              }`}
            />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
