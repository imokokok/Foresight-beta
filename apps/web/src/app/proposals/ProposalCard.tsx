import React from "react";
import { MessageCircle, Share2, MoreHorizontal } from "lucide-react";
import { toast } from "@/lib/toast";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import { formatAddress } from "@/lib/cn";

import type { ProposalItem } from "./proposalsListUtils";

interface ProposalCardProps {
  proposal: ProposalItem;
  onClick: (id: number) => void;
}

function ProposalCard({ proposal, onClick }: ProposalCardProps) {
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
  const authorLabel = author ? formatAddress(author) : "Anonymous";
  const createdAt = new Date(proposal.created_at);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  let timeAgo: string;
  if (diffMinutes < 1) {
    timeAgo = tProposals("card.timeJustNow");
  } else if (diffMinutes < 60) {
    timeAgo = formatTranslation(tProposals("card.timeMinutesAgo"), { count: diffMinutes });
  } else if (diffHours < 24) {
    timeAgo = formatTranslation(tProposals("card.timeHoursAgo"), { count: diffHours });
  } else if (diffDays < 7) {
    timeAgo = formatTranslation(tProposals("card.timeDaysAgo"), { count: diffDays });
  } else {
    timeAgo = createdAt.toLocaleDateString();
  }
  const statusRaw = String(proposal.review_status || "").trim();
  let statusLabel = tProposals("card.statusPending");
  let statusClass = "bg-amber-50 text-amber-600 border border-amber-200";
  if (statusRaw === "approved") {
    statusLabel = tProposals("card.statusApproved");
    statusClass = "bg-emerald-50 text-emerald-600 border border-emerald-200";
  } else if (statusRaw === "rejected") {
    statusLabel = tProposals("card.statusRejected");
    statusClass = "bg-rose-50 text-rose-600 border border-rose-200";
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
    <div className="group cursor-pointer" onClick={() => onClick(proposal.id)}>
      <div className="relative h-full rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 shadow-[0_8px_24px_rgba(15,23,42,0.03)] hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-600 text-[10px] font-bold text-white tracking-wider">
              <span className="w-1 h-1 rounded-full bg-white/70" />
              {tProposals("card.badge")}
            </span>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cat.bg} ${cat.color} ${cat.border}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              <span className="truncate max-w-[96px]">
                {proposal.category || tProposals("detailSidebar.categoryFallback")}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClass}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              {statusLabel}
            </span>
            {isHot && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-bold">
                <FlameIcon className="w-3 h-3" />
                {tProposals("card.hot")}
              </div>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug group-hover:text-purple-700 transition-colors mb-1 line-clamp-2">
            {proposal.title}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{proposal.content}</p>
        </div>

        <div className="px-5 pb-4 pt-2 mt-auto flex items-center justify-between gap-4 border-t border-slate-100/80 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
              {authorLabel.slice(0, 2)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                {tProposals("card.authorLabel")}
              </span>
              <span className="text-[11px] font-semibold text-slate-800 truncate">
                {authorLabel}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="truncate max-w-[110px]">{timeAgo}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>
                {formatTranslation(tProposals("card.commentCount"), {
                  count: proposal.comments?.length || 0,
                })}
              </span>
            </div>

            <button
              type="button"
              onClick={onShare}
              className="flex items-center gap-1.5 text-gray-400 text-[11px] font-bold hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors group/share"
            >
              <Share2 className="w-3.5 h-3.5 group-hover/share:text-purple-500" />
              <span className="group-hover/share:text-purple-500">
                {tProposals("share.copyLinkSuccessTitle")}
              </span>
            </button>

            <div className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 text-[11px] font-bold hover:bg-gray-50 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProposalCard);

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
