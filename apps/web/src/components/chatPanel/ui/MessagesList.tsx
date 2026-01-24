"use client";

import React, { memo, useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { MessageSquare, MoreHorizontal } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { ChatMessageView } from "../types";

export type MessagesListProps = {
  mergedMessages: ChatMessageView[];
  address: string | null | undefined;
  viewerIsAdmin?: boolean;
  displayName: (addr: string) => string;
  tChat: (key: string) => string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  listRef: React.RefObject<HTMLDivElement | null>;
  setReplyTo?: (msg: ChatMessageView | null) => void;
  isUserMuted?: (addr: string) => boolean;
  onMuteUser?: (addr: string) => void;
  onUnmuteUser?: (addr: string) => void;
  onDeleteMessage?: (msg: ChatMessageView) => void;
  onReportMessage?: (msg: ChatMessageView, reason: string) => void;
};

export const MessagesList = memo(function MessagesList({
  mergedMessages,
  address,
  viewerIsAdmin,
  displayName,
  tChat,
  setInput,
  listRef,
  setReplyTo: onReply, // 重命名以避免任何潜在的作用域冲突
  isUserMuted,
  onMuteUser,
  onUnmuteUser,
  onDeleteMessage,
  onReportMessage,
}: MessagesListProps) {
  const { locale } = useLocale();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const me = useMemo(() => String(address || "").toLowerCase(), [address]);
  const isAdmin = !!viewerIsAdmin;

  useEffect(() => {
    const onDocClick = () => setOpenMenuId(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    setOpenMenuId(null);
  }, [mergedMessages.length]);

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4 bg-transparent custom-scrollbar"
    >
      {mergedMessages.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title={tChat("empty.title")}
          description={tChat("empty.description")}
          action={
            address
              ? {
                  label: tChat("empty.actionLabel"),
                  onClick: () => {
                    const inputEl = document.querySelector("textarea") as HTMLTextAreaElement;
                    if (inputEl) {
                      inputEl.focus();
                      setInput(tChat("empty.defaultInput"));
                    }
                  },
                }
              : undefined
          }
        />
      )}

      {mergedMessages.map((m, i) => {
        const mine =
          !!address &&
          !!m.user_id &&
          String(address).toLowerCase() === String(m.user_id).toLowerCase();
        const isDiscussion = /^\d+$/.test(String(m.id || ""));
        const muted = !mine && !!isUserMuted?.(String(m.user_id || ""));
        const prev = i > 0 ? mergedMessages[i - 1] : null;
        const dateChanged =
          prev &&
          new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();

        // 连续性判断：如果上一条消息也是同一个用户，且日期没变，且时间间隔在5分钟内
        const isContinuation =
          !dateChanged &&
          prev &&
          prev.user_id === m.user_id &&
          new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

        const canMute = !mine && !!onMuteUser;
        const canUnmute = !mine && !!onUnmuteUser;
        const canReport = !mine && isDiscussion && !!onReportMessage;
        const canDelete = isDiscussion && !!onDeleteMessage && (mine || isAdmin);
        const menuOpen = openMenuId === String(m.id);
        const menuAlign = mine ? "right-0" : "left-0";

        return (
          <React.Fragment key={m.id}>
            {dateChanged && (
              <div className="flex justify-center my-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full px-3 py-0.5 backdrop-blur-md">
                  {formatDate(m.created_at, locale)}
                </span>
              </div>
            )}
            <div
              className={`flex gap-3 group/msg ${mine ? "flex-row-reverse" : ""} ${isContinuation ? "mt-1" : "mt-4"}`}
            >
              <div className="flex-shrink-0 w-8">
                {!isContinuation && (
                  <div className="w-8 h-8 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs font-semibold backdrop-blur-md">
                    {displayName(m.user_id).slice(0, 2)}
                  </div>
                )}
              </div>
              <div
                className={`flex flex-col gap-1 max-w-[80%] ${mine ? "items-end text-right" : "items-start text-left"}`}
              >
                {!isContinuation && (
                  <div className="flex items-baseline gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{displayName(m.user_id)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatTime(m.created_at, locale)}
                    </span>
                    {muted && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        · {tChat("message.muted")}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 group/bubble relative">
                  {mine && (
                    <button
                      onClick={() => onReply?.(m)}
                      className="opacity-0 group-hover/msg:opacity-100 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-opacity text-slate-400"
                      title={tChat("message.reply")}
                    >
                      <MessageSquare size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId((prev) => (prev === String(m.id) ? null : String(m.id)));
                    }}
                    className="opacity-0 group-hover/msg:opacity-100 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-opacity text-slate-400"
                    title={tChat("message.more")}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  <div
                    className={`rounded-2xl px-3 py-2 leading-relaxed border shadow-sm transition-all ${
                      mine
                        ? "bg-brand/10 text-[var(--foreground)] border-brand/15 rounded-tr-none"
                        : "bg-[var(--card-bg)] text-[var(--foreground)] border-[var(--card-border)] rounded-tl-none"
                    } ${isContinuation ? (mine ? "rounded-tr-2xl" : "rounded-tl-2xl") : ""}`}
                  >
                    {(m.debate_stance || m.debate_kind) && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {m.debate_stance && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              m.debate_stance === "pro"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                : m.debate_stance === "con"
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                                  : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20"
                            }`}
                          >
                            {tChat(`debate.stance.${m.debate_stance}`)}
                          </span>
                        )}
                        {m.debate_kind && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/15 text-slate-700 dark:text-slate-200">
                            {tChat(`debate.kind.${m.debate_kind}`)}
                          </span>
                        )}
                      </div>
                    )}
                    {m.reply_to_content && (
                      <div className="mb-1 pb-1 border-b border-black/5 dark:border-white/5 text-[10px] opacity-60 italic line-clamp-1">
                        {m.reply_to_user && (
                          <span className="font-bold mr-1">{displayName(m.reply_to_user)}:</span>
                        )}
                        {m.reply_to_content}
                      </div>
                    )}
                    {m.image_url && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-black/5 dark:border-white/5">
                        <img
                          src={m.image_url}
                          alt="shared image"
                          className="max-w-full max-h-[300px] object-contain hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(m.image_url, "_blank")}
                        />
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words text-sm">{m.content}</div>
                  </div>
                  {!mine && (
                    <button
                      onClick={() => onReply?.(m)}
                      className="opacity-0 group-hover/msg:opacity-100 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-opacity text-slate-400"
                      title={tChat("message.reply")}
                    >
                      <MessageSquare size={14} />
                    </button>
                  )}
                </div>
                {menuOpen && (
                  <div
                    className={`absolute ${menuAlign} top-8 z-20 w-52 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/95 backdrop-blur-xl shadow-xl overflow-hidden`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      onClick={() => {
                        setOpenMenuId(null);
                        onReply?.(m);
                      }}
                    >
                      {tChat("message.reply")}
                    </button>
                    {canMute && !muted && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        onClick={() => {
                          setOpenMenuId(null);
                          onMuteUser?.(String(m.user_id || ""));
                        }}
                      >
                        {tChat("message.mute")}
                      </button>
                    )}
                    {canUnmute && muted && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        onClick={() => {
                          setOpenMenuId(null);
                          onUnmuteUser?.(String(m.user_id || ""));
                        }}
                      >
                        {tChat("message.unmute")}
                      </button>
                    )}
                    {canReport && (
                      <>
                        <div className="h-px bg-[var(--card-border)]" />
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          onClick={() => {
                            setOpenMenuId(null);
                            onReportMessage?.(m, "spam");
                          }}
                        >
                          {tChat("message.reportSpam")}
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          onClick={() => {
                            setOpenMenuId(null);
                            onReportMessage?.(m, "abuse");
                          }}
                        >
                          {tChat("message.reportAbuse")}
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          onClick={() => {
                            setOpenMenuId(null);
                            onReportMessage?.(m, "misinfo");
                          }}
                        >
                          {tChat("message.reportMisinfo")}
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <>
                        <div className="h-px bg-[var(--card-border)]" />
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-500/10 transition-colors"
                          onClick={() => {
                            const ok = window.confirm(tChat("message.deleteConfirm"));
                            if (!ok) return;
                            setOpenMenuId(null);
                            onDeleteMessage?.(m);
                          }}
                        >
                          {tChat("message.delete")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
});
