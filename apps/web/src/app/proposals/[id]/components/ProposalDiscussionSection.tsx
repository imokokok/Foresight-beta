"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslations, formatTranslation, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { CommentView, ThreadView } from "../useProposalDetail";
import { CommentTree } from "./CommentTree";
import { ChatInput } from "./chat/ChatInput";

export type ProposalDiscussionSectionProps = {
  thread: ThreadView;
  stats: { commentsCount: number };
  userVoteTypes: Record<string, "up" | "down">;
  displayName: (addr: string) => string;
  vote: (target: "thread" | "comment", id: number, dir: "up" | "down") => void;
  postComment: (text: string, parentId?: number) => void;
  account: string | null | undefined;
  connectWallet: () => void;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onSubmitReply: () => void;
};

export function ProposalDiscussionSection({
  thread,
  stats,
  userVoteTypes,
  displayName,
  vote,
  postComment,
  account,
  connectWallet,
  replyText,
  onReplyTextChange,
  onSubmitReply,
}: ProposalDiscussionSectionProps) {
  const tProposals = useTranslations("proposals");
  const { locale } = useLocale();

  const [filterMode, setFilterMode] = useState<"time" | "hot" | "author">("time");

  const comments = useMemo(() => {
    const list = (thread.comments || []) as CommentView[];
    if (list.length === 0) return list;
    if (filterMode === "author") {
      return list.filter((c) => c.user_id === thread.user_id);
    }
    if (filterMode === "hot") {
      return [...list].sort((a, b) => {
        const scoreA = (a.upvotes || 0) - (a.downvotes || 0);
        const scoreB = (b.upvotes || 0) - (b.downvotes || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [thread.comments, thread.user_id, filterMode]);

  return (
    <section className="flex flex-col h-full">
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center border border-purple-100 shrink-0">
            <MessageCircle className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 text-white font-semibold">
                {tProposals("discussion.badge")}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-medium whitespace-nowrap text-slate-600">
                {formatTranslation(tProposals("discussion.badgeComments"), {
                  count: stats.commentsCount,
                })}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug line-clamp-2">
              {thread.title}
            </h2>
            <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
              <span>{displayName(thread.user_id)}</span>
              <span>·</span>
              <span>{formatDateTime(thread.created_at, locale)}</span>
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-[11px] px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 text-slate-500 font-medium">
            {account
              ? formatTranslation(tProposals("discussion.currentUser"), {
                  name: displayName(account),
                })
              : tProposals("discussion.walletNotConnected")}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5 flex-1 flex flex-col min-h-[360px] space-y-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterMode("time")}
              className={`px-2 py-1 rounded-full font-semibold ${
                filterMode === "time"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {tProposals("discussion.filterByTime")}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("hot")}
              className={`px-2 py-1 rounded-full font-semibold ${
                filterMode === "hot"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {tProposals("discussion.filterByHot")}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("author")}
              className={`px-2 py-1 rounded-full font-semibold ${
                filterMode === "author"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {tProposals("discussion.filterOnlyAuthor")}
            </button>
          </div>
          <span className="text-slate-400">
            {formatTranslation(tProposals("discussion.summary"), {
              count: stats.commentsCount,
            })}
          </span>
        </div>

        <div className="space-y-4 pt-1 flex-1 overflow-y-auto">
          <CommentTree
            comments={comments}
            userVoteTypes={userVoteTypes}
            onVote={(id, dir) => vote("comment", id, dir)}
            onReply={(id, text) => postComment(text, id)}
            account={account}
            connectWallet={connectWallet}
            displayName={displayName}
            threadAuthorId={thread.user_id}
          />
        </div>

        <ChatInput
          value={replyText}
          onChange={onReplyTextChange}
          onSubmit={onSubmitReply}
          isConnected={!!account}
          onConnect={connectWallet}
          placeholder={tProposals("discussion.inputPlaceholder")}
        />
      </div>
    </section>
  );
}
