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

      <div className="bg-white/60 backdrop-blur-xl rounded-[1.5rem] p-4 border border-white/60 shadow-sm text-xs text-slate-700 leading-relaxed">
        <p className="mb-2 font-semibold text-slate-900">
          提案广场是 Foresight 的“产品经理面板”，用于发起新预测市场或协议治理提案。
        </p>
        <p className="mb-2">
          你可以在这里描述真实世界事件、设置结算条件和时间线，并交由社区讨论与投票，决定是否上线为正式预测市场。
        </p>
        <p className="text-[11px] text-slate-500">
          想看看有哪些正在交易的市场？前往{" "}
          <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
            热门预测
          </Link>{" "}
          浏览已有事件；有想法但还不成熟，可以先在{" "}
          <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
            讨论区
          </Link>{" "}
          收集反馈，再在此发起正式提案。
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
