import React from "react";
import { Search, Activity, Plus } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import ProposalsList from "./ProposalsList";
import type { ProposalItem, CategoryOption } from "./proposalsListUtils";

type ProposalsMainContentProps = {
  account: string | null | undefined;
  connectWallet: () => void;
  setCreateModalOpen: (open: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
  categories: CategoryOption[];
  category: string;
  setCategory: (value: string) => void;
  sortedProposals: ProposalItem[];
  isLoading: boolean;
  router: { push: (href: string) => void };
};

export default function ProposalsMainContent({
  account,
  connectWallet,
  setCreateModalOpen,
  search,
  setSearch,
  categories,
  category,
  setCategory,
  sortedProposals,
  isLoading,
  router,
}: ProposalsMainContentProps) {
  const tProposals = useTranslations("proposals");

  return (
    <div className="flex-1 flex flex-col min-w-0 z-10">
      <div className="lg:hidden flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-purple-700">{tProposals("page.mobileTitle")}</h1>
        <button
          onClick={() => {
            if (!account) connectWallet();
            else setCreateModalOpen(true);
          }}
          className="p-3 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-500/30 hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col">
        <div className="flex-none mb-6 sticky top-0 z-20 backdrop-blur-sm py-2 -mx-2 px-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tProposals("page.searchPlaceholder")}
                  aria-label={tProposals("page.searchAria")}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white/80 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-400/80"
                />
              </div>
              <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400">
                <Activity className="w-3 h-3" />
                <span>{sortedProposals.length}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  aria-pressed={category === cat.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                    category === cat.id
                      ? "bg-purple-600 text-white shadow-purple-500/30 scale-105"
                      : "bg-transparent text-slate-500 border border-slate-300/60 hover:border-slate-200 hover:bg-purple-50/80"
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

        <ProposalsList
          account={account}
          connectWallet={connectWallet}
          setCreateModalOpen={setCreateModalOpen}
          sortedProposals={sortedProposals}
          isLoading={isLoading}
          router={router}
        />
      </div>
    </div>
  );
}
