"use client";

import React from "react";
import Link from "next/link";
import { Flag, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
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
  return (
    <article className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-slate-100/50">
        <div className="flex itemscenter gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-white shadow-sm">
            {displayName(thread.user_id).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {displayName(thread.user_id)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                AUTHOR
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>{new Date(thread.created_at).toLocaleString()}</span>
              <span>•</span>
              <span>#{thread.id}</span>
            </div>
          </div>
          {thread.category && (
            <div className="ml-auto px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-bold border border-purple-100">
              {thread.category}
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-4">
          {thread.title}
        </h1>

        <div className="prose prose-slate prose-lg max-w-none text-slate-600 leading-relaxed">
          <p className="whitespace-pre-wrap">{thread.content}</p>
        </div>

        {thread.created_prediction_id && (
          <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justifybetween gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
            <p className="text-xs sm:text-sm text-emerald-800">
              该提案已生成对应的链上预测市场，你可以前往市场页面观察价格信号或直接参与交易。
            </p>
            <Link
              href={`/prediction/${thread.created_prediction_id}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              前往预测市场
            </Link>
          </div>
        )}
      </div>

      <div className="bg-slate-50/50 px-6 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <button
              onClick={() => vote("thread", thread.id, "up")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold text-sm ${
                userVoteTypes[`thread:${thread.id}`] === "up"
                  ? "bg-purple-100 text-purple-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              {stats.upvotes}
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button
              onClick={() => vote("thread", thread.id, "down")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold text-sm ${
                userVoteTypes[`thread:${thread.id}`] === "down"
                  ? "bg-slate-200 text-slate-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              {stats.downvotes}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <MessageCircle className="w-4 h-4" />
            {stats.commentsCount} Comments
          </div>
        </div>

        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <Flag className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}
