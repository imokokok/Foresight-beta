import React from "react";
import { motion } from "framer-motion";
import { MessageCircle, Share2, MoreHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/lib/toast";

interface ProposalCardProps {
  proposal: any;
  onVote: (id: number, type: "up" | "down") => void;
  onClick: (id: number) => void;
}

export default function ProposalCard({ proposal, onVote, onClick }: ProposalCardProps) {
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

  const cat = categoryConfig[proposal.category] || categoryConfig.General;
  const author = String(proposal.user_id || "").trim();
  const authorLabel = author ? `${author.slice(0, 6)}...${author.slice(-4)}` : "Anonymous";
  const onShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/proposals/${proposal.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("链接已复制", "已复制提案链接到剪贴板");
      } else {
        toast.info("无法自动复制", url);
      }
    } catch {
      toast.error("复制失败", "请手动复制地址栏链接");
    }
  };

  return (
    <div className="relative group cursor-pointer" onClick={() => onClick(proposal.id)}>
      <div className="rounded-2xl bg-white border border-gray-100 hover:border-purple-300 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(124,58,237,0.06)] transition-all duration-300 flex overflow-hidden">
        {/* Left: Voting Column (Forum Style) */}
        <div className="w-12 bg-gray-50/50 border-r border-gray-100 flex flex-col items-center py-4 gap-1 shrink-0">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onVote(proposal.id, "up");
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              proposal.userVote === "up"
                ? "bg-purple-100 text-purple-600"
                : "text-gray-400 hover:bg-purple-50 hover:text-purple-500"
            }`}
          >
            <ArrowUp className="w-5 h-5" />
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
            onClick={(e) => {
              e.stopPropagation();
              onVote(proposal.id, "down");
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              proposal.userVote === "down"
                ? "bg-gray-200 text-gray-700"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`}
          >
            <ArrowDown className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Right: Main Content */}
        <div className="flex-1 p-5 flex flex-col">
          {/* Header Metadata */}
          <div className="flex items-center gap-2 mb-2 text-xs">
            {/* Category Pill */}
            <div
              className={`px-2 py-0.5 rounded-md font-bold ${cat.bg} ${cat.color} border ${cat.border} flex items-center gap-1`}
            >
              {proposal.category || "General"}
            </div>

            <span className="text-gray-300">•</span>

            <span className="text-gray-400 font-medium">
              Posted by <span className="text-gray-600 hover:underline">{authorLabel}</span>
            </span>

            <span className="text-gray-300">•</span>

            <span className="text-gray-400">
              {new Date(proposal.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>

            {isHot && (
              <div className="ml-auto flex items-center gap-1 text-orange-500 font-bold px-2 py-0.5 bg-orange-50 rounded-full text-[10px]">
                <FlameIcon className="w-3 h-3" />
                HOT
              </div>
            )}
          </div>

          {/* Title & Preview */}
          <div className="mb-3">
            <h3 className="text-lg font-bold text-gray-900 leading-snug group-hover:text-purple-700 transition-colors mb-1.5">
              {proposal.title}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{proposal.content}</p>
          </div>

          {/* Footer Actions */}
          <div className="mt-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs font-bold hover:bg-gray-50 px-2 py-1 -ml-2 rounded-lg transition-colors">
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
