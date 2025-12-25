import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageCircle } from "lucide-react";
import ProposalCard from "./ProposalCard";
import type { UseProposalsListReturn } from "./useProposalsList";
import type { ProposalItem } from "./proposalsListUtils";

type ProposalsListProps = {
  account: string | null | undefined;
  connectWallet: () => void;
  setCreateModalOpen: (open: boolean) => void;
  sortedProposals: ProposalItem[];
  isLoading: boolean;
  pendingVoteId: number | null;
  voteMutation: UseProposalsListReturn["voteMutation"];
  router: { push: (href: string) => void };
};

export default function ProposalsList({
  account,
  connectWallet,
  setCreateModalOpen,
  sortedProposals,
  isLoading,
  pendingVoteId,
  voteMutation,
  router,
}: ProposalsListProps) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <p className="text-sm font-bold text-slate-400">Loading governance data...</p>
      </div>
    );
  }

  if (sortedProposals.length === 0) {
    return (
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
    );
  }

  return (
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
                isVoting={pendingVoteId === proposal.id}
                onVote={(id, type) => voteMutation.mutate({ id, type })}
                onClick={(id) => router.push(`/proposals/${id}`)}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
