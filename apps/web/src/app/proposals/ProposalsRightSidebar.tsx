import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Dices, Vote, Zap, Wallet } from "lucide-react";

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

type ProposalsRightSidebarProps = {
  inspiration: string;
  isRolling: boolean;
  rollInspiration: () => void;
};

export default function ProposalsRightSidebar({
  inspiration,
  isRolling,
  rollInspiration,
}: ProposalsRightSidebarProps) {
  return (
    <div className="hidden 2xl:flex flex-col w-72 shrink-0 gap-6 z-10 pb-20">
      <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-5 border border-white/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-900">Featured</h3>
          <button className="text-[10px] font-bold text-blue-600 hover:underline">View All</button>
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
  );
}
