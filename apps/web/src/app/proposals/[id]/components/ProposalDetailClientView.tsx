"use client";

import React from "react";
import { motion } from "framer-motion";
import type { ThreadView } from "../useProposalDetail";
import { ProposalShell } from "./ProposalShell";
import { ProposalHeaderNav } from "./ProposalHeaderNav";
import { ProposalIntroCard } from "./ProposalIntroCard";
import { ErrorState, InvalidProposalFallback, LoadingState } from "./States";
import { ProposalMainArticle } from "./ProposalMainArticle";
import { ProposalDiscussionSection } from "./ProposalDiscussionSection";

export type ProposalDetailClientViewProps = {
  isValidId: boolean;
  thread: ThreadView | null;
  loading: boolean;
  error: string | null;
  stats: any;
  userVoteTypes: any;
  displayName: any;
  account: string | null | undefined;
  connectWallet: () => void;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onSubmitReply: () => void;
  onBack: () => void;
  onCopyLink: () => void;
  vote: any;
  postComment: any;
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
  account,
  connectWallet,
  replyText,
  onReplyTextChange,
  onSubmitReply,
  onBack,
  onCopyLink,
  vote,
  postComment,
  jsonLdMain,
  jsonLdBreadcrumb,
}: ProposalDetailClientViewProps) {
  if (!isValidId) return <InvalidProposalFallback onBack={onBack} />;

  return (
    <ProposalShell>
      {thread && jsonLdMain && jsonLdBreadcrumb && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdMain) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
          />
        </>
      )}

      <ProposalHeaderNav onBack={onBack} onCopyLink={onCopyLink} />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : thread ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-6"
        >
          <ProposalIntroCard />
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4 sm:px-6 sm:py-5">
            <ProposalMainArticle
              thread={thread}
              stats={stats}
              userVoteTypes={userVoteTypes}
              displayName={displayName}
              vote={vote}
            />
          </div>
          <ProposalDiscussionSection
            thread={thread}
            stats={stats}
            userVoteTypes={userVoteTypes}
            displayName={displayName}
            vote={vote}
            postComment={postComment}
            account={account}
            connectWallet={connectWallet}
            replyText={replyText}
            onReplyTextChange={onReplyTextChange}
            onSubmitReply={onSubmitReply}
          />
        </motion.div>
      ) : null}
    </ProposalShell>
  );
}
