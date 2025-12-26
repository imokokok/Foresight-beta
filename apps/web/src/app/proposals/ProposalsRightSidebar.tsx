import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Dices, Vote, Zap, Wallet } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

const OFFICIAL_PROPOSALS = [
  {
    id: "v2_upgrade",
    titleKey: "right.officialV2Title",
    descKey: "right.officialV2Desc",
    icon: Zap,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  {
    id: "treasury_q3",
    titleKey: "right.officialTreasuryTitle",
    descKey: "right.officialTreasuryDesc",
    icon: Wallet,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
  },
  {
    id: "community_grants",
    titleKey: "right.officialGrantsTitle",
    descKey: "right.officialGrantsDesc",
    icon: Sparkles,
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
];

type ProposalsRightSidebarProps = {
  inspirationIndex: number;
  isRolling: boolean;
  rollInspiration: () => void;
};

export default function ProposalsRightSidebar({
  inspirationIndex,
  isRolling,
  rollInspiration,
}: ProposalsRightSidebarProps) {
  const tProposals = useTranslations("proposals");
  const inspirationKey = `inspirations.${inspirationIndex}`;

  return (
    <div className="hidden 2xl:flex flex-col w-72 shrink-0 gap-6 z-10 pb-20">
      <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-5 border border-white/60 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-purple-700">
            {tProposals("right.featuredTitle")}
          </h3>
          <button className="text-[10px] font-bold text-blue-600 hover:underline">
            {tProposals("right.featuredViewAll")}
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
                  {tProposals(item.titleKey)}
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">
                  {tProposals(item.descKey)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-[2rem] p-6 text-white shadow-xl shadow-purple-700/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-300/25 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl -ml-10 -mb-10" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
              <Sparkles className="w-4 h-4 text-blue-300" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider opacity-60">
              {tProposals("right.insightLabel")}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={inspirationKey}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              className="text-sm font-bold leading-relaxed opacity-90 mb-6 h-16 text-slate-100"
            >
              "{tProposals(inspirationKey)}"
            </motion.p>
          </AnimatePresence>

          <button
            onClick={rollInspiration}
            disabled={isRolling}
            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover:border-white/20 text-slate-300 group-hover:text-white"
          >
            <Dices className={`w-3.5 h-3.5 ${isRolling ? "animate-spin" : ""}`} />
            {isRolling ? tProposals("right.randomAnalyzing") : tProposals("right.randomNext")}
          </button>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-5 border border-white/60 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
            <Vote className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-purple-700">
            {tProposals("right.governanceTitle")}
          </h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tProposals("right.governanceThresholdLabel")}</span>
            <span className="font-bold text-purple-700">
              {tProposals("right.governanceThresholdValue")}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tProposals("right.governanceVotingPeriodLabel")}</span>
            <span className="font-bold text-purple-700">
              {tProposals("right.governanceVotingPeriodValue")}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{tProposals("right.governanceQuorumLabel")}</span>
            <span className="font-bold text-purple-700">
              {tProposals("right.governanceQuorumValue")}
            </span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200/50">
          <button className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 transition-colors">
            {tProposals("right.governanceLearnMore")}
          </button>
        </div>
      </div>
    </div>
  );
}
