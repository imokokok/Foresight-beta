"use client";

import React from "react";
import { Send, User } from "lucide-react";
import type { CommentView, ThreadView } from "../useProposalDetail";
import { CommentTree } from "./CommentTree";

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
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2 px-2">
        <h3 className="text-lg font-black text-purple-700">Discussion</h3>
        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
          {stats.commentsCount}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex-1">
          {!account ? (
            <div className="h-full flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 border-dashed">
              <span className="text-sm text-slate-500 font-medium">
                Log in to join the discussion
              </span>
              <button
                onClick={() => connectWallet()}
                className="text-sm font-bold text-purple-600 hover:text-purple-700"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder="What are your thoughts?"
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-100 min-h-[80px] resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={onSubmitReply}
                  disabled={!replyText.trim()}
                  className="px-5 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Post Comment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <CommentTree
          comments={(thread.comments || []) as CommentView[]}
          userVoteTypes={userVoteTypes}
          onVote={(id, dir) => vote("comment", id, dir)}
          onReply={(id, text) => postComment(text, id)}
          account={account}
          connectWallet={connectWallet}
          displayName={displayName}
        />
      </div>
    </section>
  );
}
