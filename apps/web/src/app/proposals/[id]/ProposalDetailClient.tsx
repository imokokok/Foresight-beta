"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useProposalDetail, type ThreadView } from "./useProposalDetail";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n";
import { buildProposalBreadcrumbJsonLd, buildProposalJsonLd } from "./_lib/jsonLd";
import { ProposalDetailClientView } from "./components/ProposalDetailClientView";

export default function ProposalDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const tProposals = useTranslations("proposals");
  const detail = useProposalDetail(id);
  const { account, connectWallet } = useWallet();
  const [replyText, setReplyText] = useState("");

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success(tProposals("share.copyLinkSuccessTitle"));
    });
  };

  const jsonLdMain = detail.thread ? buildProposalJsonLd(detail.thread as ThreadView) : null;
  const jsonLdBreadcrumb = detail.thread
    ? buildProposalBreadcrumbJsonLd(detail.thread as ThreadView)
    : null;

  const handleBack = () => {
    router.push("/proposals");
  };

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    detail.postComment(replyText);
    setReplyText("");
  };

  return (
    <ProposalDetailClientView
      isValidId={detail.isValidId}
      thread={(detail.thread as ThreadView) || null}
      loading={detail.loading}
      error={detail.error}
      stats={detail.stats}
      userVoteTypes={detail.userVoteTypes}
      displayName={detail.displayName}
      account={account}
      connectWallet={connectWallet}
      replyText={replyText}
      onReplyTextChange={setReplyText}
      onSubmitReply={handleSubmitReply}
      onBack={handleBack}
      onCopyLink={handleCopyLink}
      vote={detail.vote}
      postComment={detail.postComment}
      jsonLdMain={jsonLdMain}
      jsonLdBreadcrumb={jsonLdBreadcrumb}
    />
  );
}
