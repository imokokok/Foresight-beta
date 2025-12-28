"use client";

import { memo } from "react";

export type AnnouncementBarProps = {
  roomCategory?: string;
  forumThreads: any[];
  tChat: (key: string) => string;
  badgeClass: string;
};

export const AnnouncementBar = memo(function AnnouncementBar({
  forumThreads,
  tChat,
  badgeClass,
}: AnnouncementBarProps) {
  return (
    <div className="relative overflow-hidden px-4 py-2 border-b border-[var(--card-border)] bg-[var(--card-bg)]/70 backdrop-blur-xl flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand/8 via-brand-accent/8 to-transparent dark:from-brand/10 dark:via-brand-accent/10 dark:to-transparent opacity-60" />
      <span className={`relative z-10 px-2 py-0.5 rounded-full border ${badgeClass} text-xs`}>
        {tChat("announcement.badge")}
      </span>
      <div className="relative z-10 flex-1 overflow-hidden">
        <div className="flex items-center gap-3 whitespace-nowrap overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {forumThreads.slice(0, 3).map((t) => (
            <span key={t.id} className="opacity-80 text-xs truncate">
              {String(t.title || "").slice(0, 40)}
            </span>
          ))}
          {forumThreads.length === 0 && (
            <span className="opacity-75">{tChat("announcement.empty")}</span>
          )}
        </div>
      </div>
    </div>
  );
});
