"use client";

import { memo } from "react";
import { MessageSquare, Sparkles } from "lucide-react";

export type ChatHeaderProps = {
  roomLabel: string;
  roomCategory?: string;
  account: string | null | undefined;
  displayName: (addr: string) => string;
  tChat: (key: string) => string;
  accentClass: string;
};

export const ChatHeader = memo(function ChatHeader({
  roomLabel,
  roomCategory,
  account,
  displayName,
  tChat,
  accentClass,
}: ChatHeaderProps) {
  return (
    <div className="relative overflow-hidden px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-xl flex items-center justify-between">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand/10 via-brand-accent/10 to-transparent dark:from-brand/12 dark:via-brand-accent/10 dark:to-transparent opacity-70" />
      <div className="relative z-10 flex items-center gap-3 min-w-0">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand/10 border border-brand/15">
          <MessageSquare className="w-4 h-4 text-brand" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-[var(--foreground)] truncate">
              {roomLabel}
            </span>
            <Sparkles className="w-3 h-3 text-brand/80" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${accentClass}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {roomCategory || tChat("header.title")}
            </span>
            <span className="text-slate-400">·</span>
            <span className="truncate">
              {account
                ? tChat("header.youLabel").replace("{name}", displayName(account))
                : tChat("header.walletDisconnected")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
