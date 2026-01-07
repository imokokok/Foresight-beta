import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageCircle } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import ProposalCard from "./ProposalCard";
import type { ProposalItem } from "./proposalsListUtils";

type ProposalsListProps = {
  account: string | null | undefined;
  connectWallet: () => void | Promise<void>;
  setCreateModalOpen: (open: boolean) => void;
  sortedProposals: ProposalItem[];
  isLoading: boolean;
};

const PAGE_SIZE = 20;

export default function ProposalsList({
  account,
  connectWallet,
  setCreateModalOpen,
  sortedProposals,
  isLoading,
}: ProposalsListProps) {
  const tProposals = useTranslations("proposals");
  const router = useRouter();
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const { ref: loadMoreRef, inView } = useInView({
    rootMargin: "200px",
  });

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setIsLoadingMore(false);
  }, [sortedProposals]);

  const handleCardClick = React.useCallback(
    (id: number) => {
      router.push(`/proposals/${id}`);
    },
    [router]
  );

  const hasMore = visibleCount < sortedProposals.length;
  const visibleProposals = React.useMemo(
    () => sortedProposals.slice(0, visibleCount),
    [sortedProposals, visibleCount]
  );

  React.useEffect(() => {
    if (inView && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      const timer = setTimeout(() => {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedProposals.length));
        setIsLoadingMore(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [inView, hasMore, isLoadingMore, sortedProposals.length]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <p className="text-sm font-bold text-slate-400">{tProposals("list.loading")}</p>
      </div>
    );
  }

  if (sortedProposals.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
          <MessageCircle className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-xl font-black text-purple-700 mb-2">{tProposals("list.emptyTitle")}</h3>
        <p className="text-slate-500 font-medium mb-8">{tProposals("list.emptyDescription")}</p>
        <button
          onClick={() => {
            if (!account) connectWallet();
            else setCreateModalOpen(true);
          }}
          className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 font-bold border border-purple-200 shadow-md shadow-purple-200/50 hover:from-purple-400 hover:to-pink-400 hover:text-white transition-all"
        >
          {tProposals("list.createButton")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <AnimatePresence mode="popLayout">
        {visibleProposals.map((proposal) => (
          <motion.div
            key={proposal.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <ProposalCard proposal={proposal} onClick={handleCardClick} />
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={loadMoreRef} className="flex items-center justify-center py-4">
        {hasMore && isLoadingMore && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
            <span>{tProposals("review.loading")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
