"use client";

import React from "react";

export type AnnouncementBarProps = {
  roomCategory?: string;
  forumThreads: any[];
  tChat: (key: string) => string;
  badgeClass: string;
};

export function AnnouncementBar({ forumThreads, tChat, badgeClass }: AnnouncementBarProps) {
  return (
    <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2 text-[11px] text-slate-500">
      <span className={`px-2 py-0.5 rounded-full border ${badgeClass} text-xs`}>
        {tChat("announcement.badge")}
      </span>
      <div className="flex-1 overflow-hidden">
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
}
