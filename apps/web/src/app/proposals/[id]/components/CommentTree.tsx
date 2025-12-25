"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownRight, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import type { CommentView } from "../useProposalDetail";

export function CommentTree({
  comments,
  userVoteTypes,
  onVote,
  onReply,
  account,
  connectWallet,
  displayName,
}: {
  comments: CommentView[];
  userVoteTypes: Record<string, "up" | "down">;
  onVote: (id: number, dir: "up" | "down") => void;
  onReply: (parentId: number, text: string) => void;
  account: string | null | undefined;
  connectWallet: () => void;
  displayName: (addr: string) => string;
}) {
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: number) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="space-y-4">
      {rootComments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          getReplies={getReplies}
          userVoteTypes={userVoteTypes}
          onVote={onVote}
          onReply={onReply}
          account={account}
          connectWallet={connectWallet}
          displayName={displayName}
        />
      ))}
    </div>
  );
}

function CommentNode({
  comment,
  getReplies,
  userVoteTypes,
  onVote,
  onReply,
  account,
  connectWallet,
  displayName,
}: {
  comment: CommentView;
  getReplies: (id: number) => CommentView[];
  userVoteTypes: Record<string, "up" | "down">;
  onVote: (id: number, dir: "up" | "down") => void;
  onReply: (parentId: number, text: string) => void;
  account: string | null | undefined;
  connectWallet: () => void;
  displayName: (addr: string) => string;
}) {
  const replies = getReplies(comment.id);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const voteType = userVoteTypes[`comment:${comment.id}`];

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shadow-sm">
          {displayName(comment.user_id).slice(0, 2).toUpperCase()}
        </div>
        {replies.length > 0 && <div className="w-px h-full bg-slate-200/60 my-1" />}
      </div>

      <div className="flex-1 pb-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {displayName(comment.user_id)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {new Date(comment.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed mb-3 break-words">
            {comment.content}
          </p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
              <button
                onClick={() => onVote(comment.id, "up")}
                className={`p-1 rounded hover:bg-white transition-colors ${voteType === "up" ? "text-purple-600 bg-white shadow-sm" : "text-slate-400"}`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <span className="text-xs font-bold text-slate-600 min-w-[12px] text-center">
                {(comment.upvotes || 0) - (comment.downvotes || 0)}
              </span>
              <button
                onClick={() => onVote(comment.id, "down")}
                className={`p-1 rounded hover:bg-white transition-colors ${voteType === "down" ? "text-slate-600 bg-white shadow-sm" : "text-slate-400"}`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>

            <button
              onClick={() => {
                if (!account) {
                  connectWallet();
                  return;
                }
                setIsReplying(!isReplying);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Reply
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isReplying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex gap-2">
                <div className="w-8 flex justify-center">
                  <CornerDownRight className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (replyText.trim()) {
                          onReply(comment.id, replyText);
                          setReplyText("");
                          setIsReplying(false);
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (replyText.trim()) {
                        onReply(comment.id, replyText);
                        setReplyText("");
                        setIsReplying(false);
                      }
                    }}
                    disabled={!replyText.trim()}
                    className="p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {replies.length > 0 && (
          <div className="mt-4 pl-0">
            {replies.map((reply) => (
              <CommentNode
                key={reply.id}
                comment={reply}
                getReplies={getReplies}
                userVoteTypes={userVoteTypes}
                onVote={onVote}
                onReply={onReply}
                account={account}
                connectWallet={connectWallet}
                displayName={displayName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
