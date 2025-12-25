"use client";

import React from "react";
import { MessageSquare, Sparkles } from "lucide-react";

export type ChatHeaderProps = {
  roomLabel: string;
  roomCategory?: string;
  account: string | null | undefined;
  displayName: (addr: string) => string;
  tChat: (key: string) => string;
  accentClass: string;
};

export function ChatHeader({
  roomLabel,
  roomCategory,
  account,
  displayName,
  tChat,
  accentClass,
}: ChatHeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-slate-200 bg-white/90 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 border border-slate-200">
          <MessageSquare className="w-4 h-4 text-slate-700" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-slate-900 truncate">{roomLabel}</span>
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
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
}
