"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import type { CommentView } from "../useProposalDetail";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

export function CommentTree({
  comments,
  userVoteTypes,
  onVote,
  onReply,
  address,
  connect,
  displayName,
  threadAuthorId,
}: {
  comments: CommentView[];
  userVoteTypes: Record<string, "up" | "down">;
  onVote: (id: number, dir: "up" | "down") => void;
  onReply: (parentId: number, text: string) => void;
  address: string | null | undefined;
  connect: () => void | Promise<void>;
  displayName: (addr: string) => string;
  threadAuthorId?: string;
}) {
  const tProposals = useTranslations("proposals");
  const { locale } = useLocale();
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: number) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="space-y-4">
      {rootComments.map((comment, index) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          getReplies={getReplies}
          userVoteTypes={userVoteTypes}
          onVote={onVote}
          onReply={onReply}
          address={address}
          connect={connect}
          displayName={displayName}
          floor={index + 1}
          depth={0}
          threadAuthorId={threadAuthorId}
          tProposals={tProposals}
          locale={locale}
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
  address,
  connect,
  displayName,
  floor,
  depth = 0,
  threadAuthorId,
  tProposals,
  locale,
}: {
  comment: CommentView;
  getReplies: (id: number) => CommentView[];
  userVoteTypes: Record<string, "up" | "down">;
  onVote: (id: number, dir: "up" | "down") => void;
  onReply: (parentId: number, text: string) => void;
  address: string | null | undefined;
  connect: () => void | Promise<void>;
  displayName: (addr: string) => string;
  floor?: number;
  depth?: number;
  threadAuthorId?: string;
  tProposals: (key: string) => string;
  locale: string;
}) {
  const tChat = useTranslations("chat");
  const tCommon = useTranslations("common");
  const replies = getReplies(comment.id);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const voteType = userVoteTypes[`comment:${comment.id}`];
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const reportButtonRef = useRef<HTMLButtonElement | null>(null);
  const reportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!reportMenuOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (reportButtonRef.current?.contains(target)) return;
      if (reportMenuRef.current?.contains(target)) return;
      setReportMenuOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setReportMenuOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [reportMenuOpen]);

  const reportComment = async (reason: "spam" | "abuse" | "misinfo") => {
    try {
      if (!address) {
        await Promise.resolve(connect());
      }

      const res = await fetch("/api/forum/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "comment", id: Number(comment.id), reason }),
      });
      if (!res.ok) {
        const contentType = String(res.headers.get("content-type") || "");
        const json = contentType.includes("application/json")
          ? await res.json().catch(() => null)
          : null;
        const serverMsg = String((json as any)?.error?.message || (json as any)?.message || "")
          .trim()
          .slice(0, 160);
        throw new Error(serverMsg || "report_failed");
      }
      toast.success(tCommon("success"), tChat("message.reported"));
    } catch (e: any) {
      const msg = String(e?.message || "").trim();
      toast.error(
        tCommon("error"),
        msg && msg !== "report_failed" ? msg : tChat("message.reportFailed")
      );
    }
  };

  return (
    <div className="flex gap-3 sm:gap-4">
      <div className="flex flex-col items-start">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
          {displayName(comment.user_id).slice(0, 2).toUpperCase()}
        </div>
      </div>

      <div className="flex-1 pb-4">
        <div className="border-l border-slate-100 pl-3 sm:pl-4" style={{ marginLeft: depth * 12 }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-900">
                {displayName(comment.user_id)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {formatDateTime(comment.created_at, locale)}
              </span>
              {threadAuthorId && threadAuthorId === comment.user_id && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  {tProposals("comment.authorBadge")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {typeof floor === "number" && depth === 0 && (
                <span className="text-[11px] text-slate-400">#{floor}</span>
              )}
              {String(comment.user_id || "").toLowerCase() !==
                String(address || "").toLowerCase() && (
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={reportMenuOpen}
                    onClick={() => setReportMenuOpen((v) => !v)}
                    ref={reportButtonRef}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {reportMenuOpen && (
                    <div
                      ref={reportMenuRef}
                      className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-20"
                    >
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          setReportMenuOpen(false);
                          reportComment("spam");
                        }}
                      >
                        {tChat("message.reportSpam")}
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          setReportMenuOpen(false);
                          reportComment("abuse");
                        }}
                      >
                        {tChat("message.reportAbuse")}
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          setReportMenuOpen(false);
                          reportComment("misinfo");
                        }}
                      >
                        {tChat("message.reportMisinfo")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed mb-3 break-words">
            {comment.content}
          </p>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="inline-flex items-center gap-1 bg-slate-50 rounded-full px-1.5 py-0.5 border border-slate-100">
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
                if (!address) {
                  connect();
                  return;
                }
                setIsReplying(!isReplying);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              {tProposals("comment.replyButton")}
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
                <div className="w-8" />
                <div className="flex-1 flex gap-2">
                  <input
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={tProposals("comment.replyPlaceholder")}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-purple-200"
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
                    className="p-2 rounded-xl bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 hover:from-purple-400 hover:to-pink-400 hover:text-white transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {replies.length > 0 && (
          <div className="mt-3 pl-3 sm:pl-4 space-y-3">
            {replies.map((reply) => (
              <CommentNode
                key={reply.id}
                comment={reply}
                getReplies={getReplies}
                userVoteTypes={userVoteTypes}
                onVote={onVote}
                onReply={onReply}
                address={address}
                connect={connect}
                displayName={displayName}
                floor={floor}
                depth={(depth || 0) + 1}
                threadAuthorId={threadAuthorId}
                tProposals={tProposals}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
