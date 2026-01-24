"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, MoreHorizontal } from "lucide-react";
import { useTranslations, formatTranslation, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { CommentView, ThreadView } from "../useProposalDetail";
import { CommentTree } from "./CommentTree";
import { ChatInput } from "./chat/ChatInput";
import { toast } from "@/lib/toast";
import { useWallet } from "@/contexts/WalletContext";

export type ProposalDiscussionSectionProps = {
  thread: ThreadView;
  stats: { commentsCount: number };
  userVoteTypes: Record<string, "up" | "down">;
  displayName: (addr: string) => string;
  vote: (target: "thread" | "comment", id: number, dir: "up" | "down") => void;
  postComment: (text: string, parentId?: number) => void;
  address: string | null | undefined;
  connect: () => void | Promise<void>;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onSubmitReply: () => void;
  canResubmit: boolean;
  onResubmit: () => void;
};

export function ProposalDiscussionSection({
  thread,
  stats,
  userVoteTypes,
  displayName,
  vote,
  postComment,
  address,
  connect,
  replyText,
  onReplyTextChange,
  onSubmitReply,
  canResubmit,
  onResubmit,
}: ProposalDiscussionSectionProps) {
  const tProposals = useTranslations("proposals");
  const tChat = useTranslations("chat");
  const tCommon = useTranslations("common");
  const { locale } = useLocale();

  const [filterMode, setFilterMode] = useState<"time" | "hot" | "author">("time");
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

  const reportThread = async (reason: "spam" | "abuse" | "misinfo") => {
    try {
      if (!address) {
        await Promise.resolve(connect());
      }

      const res = await fetch("/api/forum/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "thread", id: Number(thread.id), reason }),
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {(() => {
                const raw = String(thread.review_status || "").trim();
                if (!raw) return null;
                let label = tProposals("card.statusPending");
                let cls =
                  "text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200";
                if (raw === "approved") {
                  label = tProposals("card.statusApproved");
                  cls =
                    "text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200";
                } else if (raw === "rejected") {
                  label = tProposals("card.statusRejected");
                  cls =
                    "text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200";
                } else if (raw === "needs_changes") {
                  label = tProposals("review.actionNeedsChanges");
                  cls =
                    "text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200";
                }
                return <span className={cls}>{label}</span>;
              })()}
              {thread.review_reason && String(thread.review_status || "") !== "pending_review" && (
                <span className="text-[11px] text-slate-500 line-clamp-2">
                  {thread.review_reason}
                </span>
              )}
              {canResubmit && (
                <button
                  type="button"
                  onClick={onResubmit}
                  className="ml-auto text-[11px] px-2.5 py-1 rounded-full bg-purple-600 text-white font-semibold hover:bg-purple-700"
                >
                  {tProposals("detail.resubmitButton")}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-[11px] px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 text-slate-500 font-medium">
            {address
              ? formatTranslation(tProposals("discussion.currentUser"), {
                  name: displayName(address),
                })
              : tProposals("discussion.walletNotConnected")}
          </div>
          {String(thread.user_id || "").toLowerCase() !== String(address || "").toLowerCase() && (
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={reportMenuOpen}
                onClick={() => setReportMenuOpen((v) => !v)}
                ref={reportButtonRef}
                className="p-2 rounded-xl border border-slate-200 bg-white/80 text-slate-500 hover:text-slate-800 hover:bg-white transition-colors"
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
                      reportThread("spam");
                    }}
                  >
                    {tChat("message.reportSpam")}
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      setReportMenuOpen(false);
                      reportThread("abuse");
                    }}
                  >
                    {tChat("message.reportAbuse")}
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      setReportMenuOpen(false);
                      reportThread("misinfo");
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
            address={address}
            connect={connect}
            displayName={displayName}
            threadAuthorId={thread.user_id}
          />
        </div>

        <ChatInput
          value={replyText}
          onChange={onReplyTextChange}
          onSubmit={onSubmitReply}
          isConnected={!!address}
          onConnect={connect}
          placeholder={tProposals("discussion.inputPlaceholder")}
        />
      </div>
    </section>
  );
}
