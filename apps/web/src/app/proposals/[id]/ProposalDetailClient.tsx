"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Clock,
  User,
  Hash,
  Share2,
  MoreHorizontal,
  CornerDownRight,
  Send,
  Loader2,
  Flag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/contexts/WalletContext";
import { useProposalDetail, CommentView, ThreadView } from "./useProposalDetail";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n";

function buildProposalJsonLd(thread: ThreadView) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const url = `${baseUrl}/proposals/${thread.id}`;
  const title = thread.title || "Foresight 提案";
  const rawBody =
    thread.content || "Foresight 提案广场中的治理或预测市场提案讨论，用于协作设计和评估新市场。";
  const body = rawBody.length > 480 ? rawBody.slice(0, 477) + "..." : rawBody;
  const commentsCount = Array.isArray(thread.comments) ? thread.comments.length : 0;
  const createdAt = thread.created_at;
  const updatedAt = (thread as any).updated_at || createdAt;
  const json: any = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: title,
    articleBody: body,
    datePublished: createdAt,
    ...(updatedAt ? { dateModified: updatedAt } : {}),
    url,
    mainEntityOfPage: url,
    inLanguage: "zh-CN",
    author: {
      "@type": "Person",
      name: thread.user_id ? String(thread.user_id) : "Foresight User",
    },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: commentsCount,
    },
  };
  if (thread.category) {
    json.about = thread.category;
  }
  if (thread.created_prediction_id) {
    json.isBasedOn = `${baseUrl}/prediction/${thread.created_prediction_id}`;
  }
  return json;
}

function buildProposalBreadcrumbJsonLd(thread: ThreadView) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "首页",
        item: baseUrl + "/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "提案广场",
        item: baseUrl + "/proposals",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: thread.title || "提案详情",
        item: `${baseUrl}/proposals/${thread.id}`,
      },
    ],
  };
}

type ProposalDetailState = ReturnType<typeof useProposalDetail>;

type ProposalDetailClientViewProps = {
  isValidId: boolean;
  thread: ThreadView | null;
  loading: boolean;
  error: string | null;
  stats: ProposalDetailState["stats"];
  userVoteTypes: ProposalDetailState["userVoteTypes"];
  displayName: ProposalDetailState["displayName"];
  account: string | null | undefined;
  connectWallet: () => void;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onSubmitReply: () => void;
  onBack: () => void;
  onCopyLink: () => void;
  vote: ProposalDetailState["vote"];
  postComment: ProposalDetailState["postComment"];
  jsonLdMain: any | null;
  jsonLdBreadcrumb: any | null;
};

type ProposalHeaderNavProps = {
  onBack: () => void;
  onCopyLink: () => void;
};

type ProposalIntroCardProps = {};

type ProposalMainArticleProps = {
  thread: ThreadView;
  stats: ProposalDetailState["stats"];
  userVoteTypes: ProposalDetailState["userVoteTypes"];
  displayName: ProposalDetailState["displayName"];
  vote: ProposalDetailState["vote"];
};

type ProposalDiscussionSectionProps = {
  thread: ThreadView;
  stats: ProposalDetailState["stats"];
  userVoteTypes: ProposalDetailState["userVoteTypes"];
  displayName: ProposalDetailState["displayName"];
  vote: ProposalDetailState["vote"];
  postComment: ProposalDetailState["postComment"];
  account: string | null | undefined;
  connectWallet: () => void;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onSubmitReply: () => void;
};

function ProposalDetailClientView({
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
  if (!isValidId) {
    return <InvalidProposalFallback onBack={onBack} />;
  }

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans pb-20 relative">
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[100px]" />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ProposalHeaderNav onBack={onBack} onCopyLink={onCopyLink} />
        <ProposalIntroCard />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} />
        ) : thread ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <ProposalMainArticle
              thread={thread}
              stats={stats}
              userVoteTypes={userVoteTypes}
              displayName={displayName}
              vote={vote}
            />
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
      </div>
    </div>
  );
}

export default function ProposalDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const tProposals = useTranslations("proposals");
  const detail = useProposalDetail(id);
  const { account, connectWallet } = useWallet();
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

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

function InvalidProposalFallback({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">Invalid Proposal ID</h2>
        <button onClick={onBack} className="mt-4 text-purple-600 hover:underline">
          Back to Proposals
        </button>
      </div>
    </div>
  );
}

function ProposalHeaderNav({ onBack, onCopyLink }: ProposalHeaderNavProps) {
  return (
    <nav className="flex items-center justify-between mb-8">
      <button
        onClick={onBack}
        className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 hover:bg-white border border-slate-200/60 shadow-sm transition-all text-sm font-bold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={onCopyLink}
          className="p-2 rounded-full bg-white/60 hover:bg-white border border-slate-200/60 shadow-sm text-slate-500 hover:text-slate-900 transition-all"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}

function ProposalIntroCard(_: ProposalIntroCardProps) {
  return (
    <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-3xl p-5 border border-white/60 shadow-sm">
      <p className="text-sm text-slate-700 leading-relaxed mb-2">
        提案详情页用于集中展示某个预测市场或治理议题的完整说明、上下文和社区讨论，方便参与者在链上投票或发起后续预测市场前充分了解背景。
      </p>
      <p className="text-xs text-slate-500 leading-relaxed">
        想浏览其他提案？返回{" "}
        <Link href="/proposals" className="text-purple-600 hover:text-purple-700 hover:underline">
          提案广场
        </Link>{" "}
        查看全部议题；如果你更关注最终会变成实际交易市场的事件，可以前往{" "}
        <Link href="/trending" className="text-purple-600 hover:text-purple-700 hover:underline">
          热门预测
        </Link>{" "}
        页面，或在{" "}
        <Link href="/forum" className="text-purple-600 hover:text-purple-700 hover:underline">
          讨论区
        </Link>{" "}
        继续延伸讨论。
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      <p className="text-slate-400 font-medium">Loading proposal...</p>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center">
      <h3 className="text-lg font-bold text-red-800 mb-2">Error Loading Proposal</h3>
      <p className="text-red-600 mb-4">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

function ProposalMainArticle({
  thread,
  stats,
  userVoteTypes,
  displayName,
  vote,
}: ProposalMainArticleProps) {
  return (
    <article className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-slate-100/50">
        <div className="flex itemscenter gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-white shadow-sm">
            {displayName(thread.user_id).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {displayName(thread.user_id)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                AUTHOR
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>{new Date(thread.created_at).toLocaleString()}</span>
              <span>•</span>
              <span>#{thread.id}</span>
            </div>
          </div>
          {thread.category && (
            <div className="ml-auto px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-bold border border-purple-100">
              {thread.category}
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight mb-4">
          {thread.title}
        </h1>

        <div className="prose prose-slate prose-lg max-w-none text-slate-600 leading-relaxed">
          <p className="whitespace-pre-wrap">{thread.content}</p>
        </div>
        {thread.created_prediction_id && (
          <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justifybetween gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
            <p className="text-xs sm:text-sm text-emerald-800">
              该提案已生成对应的链上预测市场，你可以前往市场页面观察价格信号或直接参与交易。
            </p>
            <Link
              href={`/prediction/${thread.created_prediction_id}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              前往预测市场
            </Link>
          </div>
        )}
      </div>

      <div className="bg-slate-50/50 px-6 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <button
              onClick={() => vote("thread", thread.id, "up")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold text-sm ${
                userVoteTypes[`thread:${thread.id}`] === "up"
                  ? "bg-purple-100 text-purple-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              {stats.upvotes}
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button
              onClick={() => vote("thread", thread.id, "down")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold text-sm ${
                userVoteTypes[`thread:${thread.id}`] === "down"
                  ? "bg-slate-200 text-slate-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              {stats.downvotes}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <MessageCircle className="w-4 h-4" />
            {stats.commentsCount} Comments
          </div>
        </div>

        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <Flag className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}

function ProposalDiscussionSection({
  thread,
  stats,
  userVoteTypes,
  displayName,
  vote,
  postComment,
  account,
  connectWallet,
  replyText,
  onReplyTextChange,
  onSubmitReply,
}: ProposalDiscussionSectionProps) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2 px-2">
        <h3 className="text-lg font-black text-slate-900">Discussion</h3>
        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
          {stats.commentsCount}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex-1">
          {!account ? (
            <div className="h-full flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 border-dashed">
              <span className="text-sm text-slate-500 font-medium">
                Log in to join the discussion
              </span>
              <button
                onClick={() => connectWallet()}
                className="text-sm font-bold text-purple-600 hover:text-purple-700"
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={replyText}
                onChange={(e) => onReplyTextChange(e.target.value)}
                placeholder="What are your thoughts?"
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-100 min-h-[80px] resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={onSubmitReply}
                  disabled={!replyText.trim()}
                  className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Post Comment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <CommentTree
          comments={thread.comments || []}
          userVoteTypes={userVoteTypes}
          onVote={(id, dir) => vote("comment", id, dir)}
          onReply={(id, text) => postComment(text, id)}
          account={account}
          connectWallet={connectWallet}
          displayName={displayName}
        />
      </div>
    </section>
  );
}

function CommentTree({
  comments,
  userVoteTypes,
  onVote,
  onReply,
  account,
  connectWallet,
  displayName,
}: {
  comments: CommentView[];
  userVoteTypes: Record<string, "up" | "down">;
  onVote: (id: number, dir: "up" | "down") => void;
  onReply: (parentId: number, text: string) => void;
  account: string | null | undefined;
  connectWallet: () => void;
  displayName: (addr: string) => string;
}) {
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: number) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="space-y-4">
      {rootComments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          getReplies={getReplies}
          userVoteTypes={userVoteTypes}
          onVote={onVote}
          onReply={onReply}
          account={account}
          connectWallet={connectWallet}
          displayName={displayName}
        />
      ))}
    </div>
  );
}

function CommentNode({
  comment,
  getReplies,
  userVoteTypes,
  onVote,
  onReply,
  account,
  connectWallet,
  displayName,
}: {
  comment: CommentView;
  getReplies: (id: number) => CommentView[];
  userVoteTypes: Record<string, "up" | "down">;
  onVote: (id: number, dir: "up" | "down") => void;
  onReply: (parentId: number, text: string) => void;
  account: string | null | undefined;
  connectWallet: () => void;
  displayName: (addr: string) => string;
}) {
  const replies = getReplies(comment.id);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  const voteType = userVoteTypes[`comment:${comment.id}`];

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shadow-sm">
          {displayName(comment.user_id).slice(0, 2).toUpperCase()}
        </div>
        {replies.length > 0 && <div className="w-px h-full bg-slate-200/60 my-1" />}
      </div>

      <div className="flex-1 pb-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {displayName(comment.user_id)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {new Date(comment.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed mb-3 break-words">
            {comment.content}
          </p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
              <button
                onClick={() => onVote(comment.id, "up")}
                className={`p-1 rounded hover:bg-white transition-colors ${
                  voteType === "up" ? "text-purple-600 bg-white shadow-sm" : "text-slate-400"
                }`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <span className="text-xs font-bold text-slate-600 min-w-[12px] text-center">
                {(comment.upvotes || 0) - (comment.downvotes || 0)}
              </span>
              <button
                onClick={() => onVote(comment.id, "down")}
                className={`p-1 rounded hover:bg-white transition-colors ${
                  voteType === "down" ? "text-slate-600 bg-white shadow-sm" : "text-slate-400"
                }`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>

            <button
              onClick={() => {
                if (!account) {
                  connectWallet();
                  return;
                }
                setIsReplying(!isReplying);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Reply
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isReplying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex gap-2">
                <div className="w-8 flex justify-center">
                  <CornerDownRight className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (replyText.trim()) {
                          onReply(comment.id, replyText);
                          setReplyText("");
                          setIsReplying(false);
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (replyText.trim()) {
                        onReply(comment.id, replyText);
                        setReplyText("");
                        setIsReplying(false);
                      }
                    }}
                    disabled={!replyText.trim()}
                    className="p-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {replies.length > 0 && (
          <div className="mt-4 pl-0">
            {replies.map((reply) => (
              <CommentNode
                key={reply.id}
                comment={reply}
                getReplies={getReplies}
                userVoteTypes={userVoteTypes}
                onVote={onVote}
                onReply={onReply}
                account={account}
                connectWallet={connectWallet}
                displayName={displayName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
