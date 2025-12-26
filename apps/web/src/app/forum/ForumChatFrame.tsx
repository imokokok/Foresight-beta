import React from "react";
import Link from "next/link";
import {
  MessageSquare,
  Sparkles,
  Users,
  TrendingUp,
  MoreHorizontal,
  ArrowUpRight,
} from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import { getCategoryStyle } from "./forumConfig";
import type { PredictionItem } from "./useForumList";

type ForumChatFrameProps = {
  account: string | null | undefined;
  currentTopic: PredictionItem | null;
  activeCat: string;
  displayName: (addr: string) => string;
  loading: boolean;
  error: string | null;
};

export function ForumChatFrame({
  account,
  currentTopic,
  activeCat,
  displayName,
  loading,
  error,
}: ForumChatFrameProps) {
  const style = getCategoryStyle(activeCat);

  return (
    <div className="flex-1 flex flex-col">
      <header
        className={`h-16 px-6 border-b border-white/20 flex items-center justify-between bg-gradient-to-r ${
          style.headerGradient
        } sticky top-0 z-20 text-white shadow-none`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30 shadow-inner">
            <MessageSquare className="w-5 h-5 text-white drop-shadow" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white truncate text-lg tracking-tight">
                {currentTopic?.title || "聊天室"}
              </h2>
              <Sparkles className="w-4 h-4 text-white/80" />
            </div>
            <div className="flex items-center gap-2 text-xs text-white/80">
              <span className="flex items-center gap-1 bg-white/15 text-white px-2 py-0.5 rounded-full border border-white/30 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Discussion
              </span>
              <span>•</span>
              <span className="font-mono text-white/70">#{currentTopic?.id ?? "-"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-xs font-medium bg-white/15 text-white px-3 py-1.5 rounded-xl border border-white/20">
            {account ? `你：${displayName(account)}` : "未连接钱包"}
          </div>

          <div className="w-px h-8 bg-white/30" />

          {currentTopic?.id && (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
                  关联预测
                </span>
                <Link
                  href={`/prediction/${currentTopic.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white hover:underline"
                >
                  查看市场
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="w-px h-8 bg-white/30" />
            </>
          )}

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
              Followers
            </span>
            <span className="text-sm font-bold text-white flex items-center gap-1">
              <Users size={14} className={style.accentText} />
              {currentTopic?.followers_count ?? 0}
            </span>
          </div>

          <div className="w-px h-8 bg-white/30" />

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
              Category
            </span>
            <span className="text-sm font-bold text-white flex items-center gap-1">
              <TrendingUp size={14} className={style.accentText} />
              {currentTopic?.category}
            </span>
          </div>

          <div className="w-px h-8 bg-white/30" />

          <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden bg-transparent flex flex-col">
        <div className={`absolute inset-0 bg-gradient-to-br ${style.chatGradient} opacity-30`} />
        <div className="flex-1 flex flex-col z-10 relative">
          {currentTopic?.id ? (
            <ChatPanel
              eventId={currentTopic.id}
              roomTitle={currentTopic.title}
              roomCategory={currentTopic.category}
              hideHeader={true}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-white/80 backdrop-blur-md">
              {loading
                ? "加载话题中..."
                : error
                  ? "加载失败，请稍后重试"
                  : "请选择一个话题开始讨论"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
