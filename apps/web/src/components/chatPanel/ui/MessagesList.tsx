"use client";

import React, { memo } from "react";
import EmptyState from "@/components/EmptyState";
import { MessageSquare } from "lucide-react";
import type { ChatMessageView } from "../types";

export type MessagesListProps = {
  mergedMessages: ChatMessageView[];
  account: string | null | undefined;
  displayName: (addr: string) => string;
  tChat: (key: string) => string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  listRef: React.RefObject<HTMLDivElement | null>;
};

export const MessagesList = memo(function MessagesList({
  mergedMessages,
  account,
  displayName,
  tChat,
  setInput,
  listRef,
}: MessagesListProps) {
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
            account
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
          !!account &&
          !!m.user_id &&
          String(account).toLowerCase() === String(m.user_id).toLowerCase();
        const prev = i > 0 ? mergedMessages[i - 1] : null;
        const dateChanged =
          prev &&
          new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
        return (
          <React.Fragment key={m.id}>
            {dateChanged && (
              <div className="flex justify-center">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full px-3 py-0.5 backdrop-blur-md">
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs font-semibold backdrop-blur-md">
                  {displayName(m.user_id).slice(0, 2)}
                </div>
              </div>
              <div
                className={`flex flex-col gap-1 max-w-[80%] ${mine ? "items-end text-right" : "items-start text-left"}`}
              >
                <div className="flex items-baseline gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium">{displayName(m.user_id)}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <div
                  className={`rounded-2xl px-3 py-2 leading-relaxed border ${
                    mine
                      ? "bg-brand/10 text-[var(--foreground)] border-brand/15"
                      : "bg-[var(--card-bg)] text-[var(--foreground)] border-[var(--card-border)]"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
});
