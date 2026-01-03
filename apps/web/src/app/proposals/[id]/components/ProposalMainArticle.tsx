"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Flag, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { ThreadView } from "../useProposalDetail";

export type ProposalMainArticleProps = {
  thread: ThreadView;
  stats: { upvotes: number; downvotes: number; commentsCount: number };
  userVoteTypes: Record<string, "up" | "down">;
  displayName: (addr: string) => string;
  vote: (target: "thread" | "comment", id: number, dir: "up" | "down") => void;
};

export function ProposalMainArticle({
  thread,
  stats,
  userVoteTypes,
  displayName,
  vote,
}: ProposalMainArticleProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const tProposals = useTranslations("proposals");

  return (
    <article className="space-y-4">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-white shadow-sm">
          {displayName(thread.user_id).slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{displayName(thread.user_id)}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
              {tProposals("detail.authorBadge")}
            </span>
            {thread.category && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[11px] font-bold border border-purple-100">
                {thread.category}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-medium flex-wrap">
            <span>{formatDateTime(thread.created_at)}</span>
            <span>•</span>
            <span>#{thread.id}</span>
          </div>
        </div>
      </header>

      <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
        {thread.title}
      </h1>

      <section className="text-sm text-slate-700 leading-relaxed">
        <p className={showFullContent ? "whitespace-pre-wrap" : "whitespace-pre-wrap line-clamp-4"}>
          {thread.content}
        </p>
        {thread.content && thread.content.trim().length > 0 && (
          <button
            type="button"
            onClick={() => setShowFullContent(!showFullContent)}
            className="mt-2 text-xs font-semibold text-purple-600 hover:text-purple-700"
          >
            {showFullContent
              ? tProposals("detail.collapseContent")
              : tProposals("detail.expandContent")}
          </button>
        )}
      </section>

      {thread.created_prediction_id && (
        <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
          <p className="text-xs sm:text-sm text-emerald-800">{tProposals("detail.marketHint")}</p>
          <Link
            href={`/prediction/${thread.created_prediction_id}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            {tProposals("detail.marketButton")}
          </Link>
        </div>
      )}

      <footer className="flex items-center justify-between pt-2 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center bg-white/70 rounded-full border border-slate-200 px-1 py-0.5 shadow-sm">
            <button
              onClick={() => vote("thread", thread.id, "up")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all font-semibold text-[11px] ${
                userVoteTypes[`thread:${thread.id}`] === "up"
                  ? "bg-purple-100 text-purple-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {stats.upvotes}
            </button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <button
              onClick={() => vote("thread", thread.id, "down")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all font-semibold text-[11px] ${
                userVoteTypes[`thread:${thread.id}`] === "down"
                  ? "bg-slate-200 text-slate-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              {stats.downvotes}
            </button>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-400">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>
              {stats.commentsCount} {tProposals("detail.comments")}
            </span>
          </div>
        </div>
        <button className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <Flag className="w-3.5 h-3.5" />
        </button>
      </footer>
    </article>
  );
}
