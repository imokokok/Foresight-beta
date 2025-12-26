"use client";

import React from "react";
import { MessageCircle } from "lucide-react";
import { useTranslations, formatTranslation } from "@/lib/i18n";
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
              <span>{new Date(thread.created_at).toLocaleString()}</span>
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
              className="px-2 py-1 rounded-full bg-slate-900 text-white font-semibold"
            >
              {tProposals("discussion.filterByTime")}
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            >
              {tProposals("discussion.filterByHot")}
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
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
            comments={(thread.comments || []) as CommentView[]}
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
