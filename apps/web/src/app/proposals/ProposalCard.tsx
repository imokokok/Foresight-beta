import React from "react";
import { motion } from "framer-motion";
import { MessageCircle, Share2, MoreHorizontal, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n";

import type { ProposalItem } from "./proposalsListUtils";

interface ProposalCardProps {
  proposal: ProposalItem;
  onVote: (id: number, type: "up" | "down") => void;
  onClick: (id: number) => void;
}

export default function ProposalCard({
  proposal,
  onVote,
  onClick,
  isVoting,
}: ProposalCardProps & { isVoting?: boolean }) {
  const tProposals = useTranslations("proposals");
  const upvotes = proposal.upvotes || 0;
  const downvotes = proposal.downvotes || 0;
  const score = upvotes - downvotes;

  // Determine status color based on category or heat
  const isHot = score > 10 || (proposal.comments?.length || 0) > 5;

  const categoryConfig: Record<string, { color: string; bg: string; border: string }> = {
    General: { color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
    Tech: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    Crypto: { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
    Sports: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    Politics: { color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-100" },
  };

  const cat = categoryConfig[proposal.category || "General"];
  const author = String(proposal.user_id || "").trim();
  const authorLabel = author ? `${author.slice(0, 6)}...${author.slice(-4)}` : "Anonymous";
  const createdAt = new Date(proposal.created_at);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  let timeAgo: string;
  if (diffMinutes < 1) {
    timeAgo = "just now";
  } else if (diffMinutes < 60) {
    timeAgo = `${diffMinutes} min ago`;
  } else if (diffHours < 24) {
    timeAgo = `${diffHours} h ago`;
  } else if (diffDays < 7) {
    timeAgo = `${diffDays} d ago`;
  } else {
    timeAgo = createdAt.toLocaleDateString();
  }
  const onShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/proposals/${proposal.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success(
          tProposals("share.copyLinkSuccessTitle"),
          tProposals("share.copyLinkSuccessDesc")
        );
      } else {
        toast.info(tProposals("share.copyLinkUnsupportedTitle"), url);
      }
    } catch (error) {
      toast.error(tProposals("share.copyLinkFailedTitle"), tProposals("share.copyLinkFailedDesc"));
    }
  };

  return (
    <div className="relative group cursor-pointer" onClick={() => onClick(proposal.id)}>
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 shadow-[0_8px_24px_rgba(15,23,42,0.03)] hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)] transition-all duration-300 flex overflow-hidden hover:-translate-y-0.5">
        <div className="w-12 bg-slate-50/80 border-r border-slate-200/80 flex flex-col items-center py-4 gap-1 shrink-0">
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            aria-pressed={proposal.userVote === "up"}
            aria-label={proposal.userVote === "up" ? "取消赞成该提案" : "赞成该提案"}
            disabled={isVoting}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              proposal.userVote === "up"
                ? "bg-purple-100 text-purple-600"
                : "text-gray-400 hover:bg-purple-50 hover:text-purple-500"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onVote(proposal.id, "up");
            }}
          >
            {isVoting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowUp className="w-5 h-5" />
            )}
          </motion.button>

          <span
            className={`text-sm font-black ${
              proposal.userVote === "up"
                ? "text-purple-600"
                : proposal.userVote === "down"
                  ? "text-gray-500"
                  : "text-gray-700"
            }`}
          >
            {score}
          </span>

          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            aria-pressed={proposal.userVote === "down"}
            aria-label={proposal.userVote === "down" ? "取消反对该提案" : "反对该提案"}
            disabled={isVoting}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              proposal.userVote === "down"
                ? "bg-gray-200 text-gray-700"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onVote(proposal.id, "down");
            }}
          >
            {isVoting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowDown className="w-5 h-5" />
            )}
          </motion.button>
        </div>

        <div className="flex-1 px-5 py-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-500">
                {authorLabel.slice(0, 2)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-800 truncate">{authorLabel}</span>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="truncate max-w-[120px]">{timeAgo}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="truncate max-w-[120px]">{proposal.category || "General"}</span>
                </div>
              </div>
            </div>
            {isHot && (
              <div className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 shadow-sm">
                <FlameIcon className="w-3 h-3" />
                HOT
              </div>
            )}
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug group-hover:text-purple-700 transition-colors mb-1">
              {proposal.title}
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
              {proposal.content}
            </p>
          </div>

          <div className="mt-auto flex items-center gap-3 pt-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                cat.bg
              } ${cat.color} ${cat.border}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              <span className="truncate max-w-[100px]">{proposal.category || "General"}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
              <MessageCircle className="w-4 h-4" />
              <span>{proposal.comments?.length || 0} Comments</span>
            </div>

            <button
              type="button"
              onClick={onShare}
              className="flex items-center gap-1.5 text-gray-400 text-xs font-bold hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors group/share"
            >
              <Share2 className="w-4 h-4 group-hover/share:text-purple-500" />
              <span className="group-hover/share:text-purple-500">Share</span>
            </button>

            <div className="flex items-center gap-1.5 text-gray-400 text-xs font-bold hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
