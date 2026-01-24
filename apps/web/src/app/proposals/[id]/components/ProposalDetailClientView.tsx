"use client";

import { motion } from "framer-motion";
import type { ThreadView } from "../useProposalDetail";
import { ProposalHeaderNav } from "./ProposalHeaderNav";
import { ErrorState, InvalidProposalFallback, LoadingState } from "./States";
import { ProposalDiscussionSection } from "./ProposalDiscussionSection";
import { ProposalChatShell } from "./chat/ProposalChatShell";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import { safeJsonLdStringify } from "@/lib/seo";

// 提取动画配置为模块级常量，避免每次渲染重新创建
const FADE_IN_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
} as const;

export type ProposalDetailClientViewProps = {
  isValidId: boolean;
  thread: ThreadView | null;
  loading: boolean;
  error: string | null;
  stats: any;
  userVoteTypes: any;
  displayName: any;
  address: string | null | undefined;
  connect: () => void;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onSubmitReply: () => void;
  onBack: () => void;
  onCopyLink: () => void;
  vote: any;
  postComment: any;
  canResubmit: boolean;
  onResubmit: () => void;
  jsonLdMain: any | null;
  jsonLdBreadcrumb: any | null;
};

export function ProposalDetailClientView({
  isValidId,
  thread,
  loading,
  error,
  stats,
  userVoteTypes,
  displayName,
  address,
  connect,
  replyText,
  onReplyTextChange,
  onSubmitReply,
  onBack,
  onCopyLink,
  vote,
  postComment,
  canResubmit,
  onResubmit,
  jsonLdMain,
  jsonLdBreadcrumb,
}: ProposalDetailClientViewProps) {
  const tProposals = useTranslations("proposals");

  if (!isValidId) return <InvalidProposalFallback onBack={onBack} />;

  return (
    <ProposalChatShell>
      {thread && jsonLdMain && jsonLdBreadcrumb && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLdMain) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLdBreadcrumb) }}
          />
        </>
      )}

      <div className="w-full flex-1 min-h-0 flex flex-col px-4 sm:px-6 lg:px-10 py-4">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <ProposalHeaderNav onBack={onBack} onCopyLink={onCopyLink} />
            {thread && (
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
                <span className="px-2 py-1 rounded-full bg-white/70 border border-slate-200">
                  #{thread.id}
                </span>
                <span className="px-2 py-1 rounded-full bg-white/70 border border-slate-200">
                  {formatTranslation(tProposals("detail.discussionCount"), {
                    count: stats.commentsCount,
                  })}
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingState />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <ErrorState error={error} />
            </div>
          ) : thread ? (
            <motion.div
              initial={FADE_IN_ANIMATION.initial}
              animate={FADE_IN_ANIMATION.animate}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-200/40 flex flex-col h-full overflow-hidden">
                <div className="flex-1 flex flex-col">
                  <ProposalDiscussionSection
                    thread={thread}
                    stats={stats}
                    userVoteTypes={userVoteTypes}
                    displayName={displayName}
                    vote={vote}
                    postComment={postComment}
                    address={address}
                    connect={connect}
                    replyText={replyText}
                    onReplyTextChange={onReplyTextChange}
                    onSubmitReply={onSubmitReply}
                    canResubmit={canResubmit}
                    onResubmit={onResubmit}
                  />
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>
    </ProposalChatShell>
  );
}
