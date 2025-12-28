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
import { t } from "@/lib/i18n";

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
    <div className="flex-1 flex flex-col bg-gradient-to-br from-white/80 via-purple-50/30 to-fuchsia-50/20 dark:from-slate-900/80 dark:via-purple-950/20 dark:to-slate-900/70">
      <header className="h-16 px-6 border-b border-purple-200/50 dark:border-slate-700/40 flex items-center justify-between sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-none relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-purple-100/60 via-fuchsia-100/40 to-violet-50/30 dark:from-purple-900/25 dark:via-fuchsia-900/15 dark:to-transparent opacity-80" />
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-brand/15 shadow-inner">
            <MessageSquare className="w-5 h-5 text-brand drop-shadow" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-[var(--foreground)] truncate text-lg tracking-tight">
                {currentTopic?.title || t("forum.chatRoom")}
              </h2>
              <Sparkles className="w-4 h-4 text-brand/80" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 bg-brand/10 text-brand px-2 py-0.5 rounded-full border border-brand/20 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Discussion
              </span>
              <span>•</span>
              <span className="font-mono text-slate-400 dark:text-slate-500">
                #{currentTopic?.id ?? "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-xs font-medium bg-[var(--card-bg)] text-[var(--foreground)] px-3 py-1.5 rounded-xl border border-[var(--card-border)]">
            {account
              ? t("chat.header.youLabel").replace("{name}", displayName(account))
              : t("chat.header.walletDisconnected")}
          </div>

          <div className="w-px h-8 bg-[var(--card-border)]" />

          {currentTopic?.id && (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">
                  {t("forum.relatedPrediction")}
                </span>
                <Link
                  href={`/prediction/${currentTopic.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline whitespace-nowrap"
                >
                  {t("forum.viewMarket")}
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="w-px h-8 bg-[var(--card-border)]" />
            </>
          )}

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">
              Followers
            </span>
            <span className="text-sm font-bold text-[var(--foreground)] flex items-center gap-1">
              <Users size={14} className={style.accentText} />
              {currentTopic?.followers_count ?? 0}
            </span>
          </div>

          <div className="w-px h-8 bg-[var(--card-border)]" />

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">
              Category
            </span>
            <span className="text-sm font-bold text-[var(--foreground)] flex items-center gap-1 min-w-0 max-w-[9rem]">
              <TrendingUp size={14} className={style.accentText} />
              <span
                className="min-w-0 truncate whitespace-nowrap"
                title={currentTopic?.category || ""}
              >
                {currentTopic?.category}
              </span>
            </span>
          </div>

          <div className="w-px h-8 bg-[var(--card-border)]" />

          <button className="p-2 text-slate-500 hover:text-[var(--foreground)] hover:bg-white/10 dark:hover:bg-white/5 rounded-xl transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden flex flex-col px-4 pb-4 pt-3">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 via-fuchsia-100/30 to-violet-50/40 dark:from-purple-900/25 dark:via-fuchsia-900/15 dark:to-slate-900/50 opacity-80" />
        {/* 右上角光晕 */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-fuchsia-200/50 blur-3xl dark:bg-fuchsia-600/15" />
        <div className="flex-1 flex flex-col z-10 relative">
          {currentTopic?.id ? (
            <ChatPanel
              eventId={currentTopic.id}
              roomTitle={currentTopic.title}
              roomCategory={currentTopic.category}
              hideHeader={true}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-slate-300 backdrop-blur-md">
              {loading
                ? t("forum.loadingTopic")
                : error
                  ? t("forum.loadFailed")
                  : t("forum.selectTopic")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
