"use client";

import React from "react";
import { MessageCircle, Send, User } from "lucide-react";
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
    <section className="space-y-4">
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center border border-purple-100 shrink-0">
              <MessageCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 truncate">全部讨论</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-medium whitespace-nowrap text-slate-600">
                  {stats.commentsCount} 条回复
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                围绕这个提案展开楼层讨论与观点交换。
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-[11px] px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-medium">
              {account ? `你：${displayName(account)}` : "未连接钱包"}
            </div>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-5 space-y-4">
          <div className="flex gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-xs font-bold text-purple-700">
              {account ? displayName(account).slice(0, 2).toUpperCase() : "你"}
            </div>
            <div className="flex-1">
              {!account ? (
                <div className="h-full flex items-center justify-between rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200/70">
                  <span className="text-sm text-slate-700">连接钱包后即可加入这条讨论线。</span>
                  <button
                    onClick={() => connectWallet()}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => onReplyTextChange(e.target.value)}
                    placeholder="写下你的想法，让这一楼更有分量……"
                    className="w-full bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-300 outline-none min-h-[90px] resize-none"
                  />
                  <div className="flex justify-between items-center">
                    <span className="hidden sm:inline text-[11px] text-slate-400">
                      支持多行输入，Enter 换行，Ctrl+Enter 快速发送。
                    </span>
                    <button
                      onClick={onSubmitReply}
                      disabled={!replyText.trim()}
                      className="px-4 py-1.5 rounded-full bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      发表楼层
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="px-2 py-1 rounded-full bg-slate-900 text-white font-semibold"
              >
                按时间
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              >
                按热度
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              >
                只看楼主
              </button>
            </div>
            <span className="text-slate-400">共 {stats.commentsCount} 条讨论</span>
          </div>

          <div className="space-y-4 pt-1">
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
        </div>
      </div>
    </section>
  );
}
