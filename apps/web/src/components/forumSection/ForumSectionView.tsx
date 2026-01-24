"use client";

import React from "react";
import Button from "@/components/ui/Button";
import DatePicker from "@/components/ui/DatePicker";
import { useTranslations, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { CommentView, ForumSectionViewProps } from "./types";
import { ReplyBox } from "./ReplyBox";

export function ForumSectionView({
  hideCreate,
  address,
  threads,
  loading,
  error,
  subjectName,
  actionVerb,
  targetValue,
  deadline,
  category,
  titlePreview,
  criteriaPreview,
  formError,
  canSubmit,
  posting,
  userVotes,
  userVoteTypes,
  displayName,
  onConnectAndSign,
  onSubjectNameChange,
  onActionVerbChange,
  onTargetValueChange,
  onDeadlineChange,
  onCategoryChange,
  onPostThread,
  onVote,
  onPostComment,
}: ForumSectionViewProps) {
  const tForum = useTranslations("forum");
  const { locale } = useLocale();

  const buildTree = (comments: CommentView[] = []) => {
    const byParent: Record<string, CommentView[]> = {};
    comments.forEach((c) => {
      const key = String(c.parent_id ?? "root");
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(c);
    });
    const renderBranch = (parentId: number | null, depth = 0): React.ReactNode[] => {
      const key = String(parentId ?? "root");
      const nodes = byParent[key] || [];
      return nodes.flatMap((node) => [
        <div key={node.id} className="mt-3 pl-0" style={{ marginLeft: depth * 16 }}>
          <div className="text-sm text-gray-800">
            <span className="text-purple-700 font-medium mr-2">{displayName(node.user_id)}</span>
            <span className="text-gray-400">{formatDateTime(node.created_at, locale)}</span>
          </div>
          <div className="mt-1 text-gray-700 break-words">{node.content}</div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <button
              onClick={() => onVote("comment", node.id, "up")}
              disabled={userVotes.has(`comment:${node.id}`)}
              className="inline-flex items-center px-2 py-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white disabled:opacity-50"
            >
              ▲ {node.upvotes}
            </button>
            {address && (
              <ReplyBox onSubmit={(text) => onPostComment(node.thread_id, text, node.id)} />
            )}
          </div>
        </div>,
        ...renderBranch(node.id, depth + 1),
      ]);
    };
    return renderBranch(null, 0);
  };

  return (
    <div className="rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/50">
        <div className="font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {tForum("title")}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {!hideCreate && (
          <div className="bg-white/40 rounded-xl border border-white/60 p-4 shadow-sm">
            {!address ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 font-medium">{tForum("loginRequired")}</div>
                <Button size="sm" variant="cta" onClick={onConnectAndSign}>
                  {tForum("connectAndSign")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={subjectName}
                    onChange={(e) => onSubjectNameChange(e.target.value)}
                    placeholder={tForum("form.subjectPlaceholder")}
                    className="w-full px-3 py-2 border border-white/60 rounded-xl bg-white/50 focus:bg-white/90 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-800"
                  />
                  <select
                    value={actionVerb}
                    onChange={(e) => onActionVerbChange(e.target.value as any)}
                    className="w-full px-3 py-2 border border-white/60 rounded-xl bg-white/50 focus:bg-white/90 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-800"
                  >
                    <option value="priceReach">{tForum("form.action.priceReach")}</option>
                    <option value="willWin">{tForum("form.action.willWin")}</option>
                    <option value="willHappen">{tForum("form.action.willHappen")}</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={targetValue}
                    onChange={(e) => onTargetValueChange(e.target.value)}
                    placeholder={tForum("form.targetPlaceholder")}
                    className="w-full px-3 py-2 border border-white/60 rounded-xl bg-white/50 focus:bg-white/90 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-800"
                  />
                  <DatePicker
                    value={deadline}
                    onChange={onDeadlineChange}
                    includeTime={true}
                    placeholder={tForum("form.deadlinePlaceholder")}
                    className="w-full"
                  />
                  <select
                    value={category}
                    onChange={(e) => onCategoryChange(e.target.value as any)}
                    className="w-full px-3 py-2 border border-white/60 rounded-xl bg-white/50 focus:bg-white/90 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-800"
                  >
                    <option value="tech">{tForum("form.category.tech")}</option>
                    <option value="entertainment">{tForum("form.category.entertainment")}</option>
                    <option value="politics">{tForum("form.category.politics")}</option>
                    <option value="weather">{tForum("form.category.weather")}</option>
                    <option value="sports">{tForum("form.category.sports")}</option>
                    <option value="business">{tForum("form.category.business")}</option>
                    <option value="crypto">{tForum("form.category.crypto")}</option>
                    <option value="more">{tForum("form.category.more")}</option>
                  </select>
                </div>
                <div className="bg-white/40 border border-white/60 rounded-xl p-3 text-sm text-gray-800">
                  <div className="font-medium text-indigo-700">{tForum("form.previewTitle")}</div>
                  <div className="mt-1">{titlePreview || tForum("form.previewTitleFallback")}</div>
                  <div className="font-medium text-indigo-700 mt-3">
                    {tForum("form.previewCriteria")}
                  </div>
                  <div className="mt-1">
                    {criteriaPreview || tForum("form.previewCriteriaFallback")}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600">{formError || ""}</div>
                  <Button
                    onClick={onPostThread}
                    disabled={posting || !canSubmit}
                    size="md"
                    variant="cta"
                  >
                    {posting ? tForum("form.submitPosting") : tForum("form.submit")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {loading && <div className="text-sm text-gray-500">{tForum("list.loading")}</div>}
          {!loading && threads.length === 0 && (
            <div className="text-sm text-gray-500">{tForum("list.empty")}</div>
          )}
          {threads.map((t) => (
            <div key={t.id} className="bg-white/40 rounded-xl border border-white/60 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {t.title}
                  </div>
                  {String(t.content || "").trim() && (
                    <div className="text-sm text-gray-600 mt-1">{t.content}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {tForum("thread.meta.prefix")}{" "}
                    <span className="text-indigo-700 font-medium">{displayName(t.user_id)}</span>{" "}
                    {tForum("thread.meta.in")} {formatDateTime(t.created_at, locale)}{" "}
                    {tForum("thread.meta.suffix")}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Button
                    size="sm"
                    variant="cta"
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200/50"
                    onClick={() => onVote("thread", t.id, "up")}
                    disabled={userVotes.has(`thread:${t.id}`)}
                  >
                    ▲ {t.upvotes}
                  </Button>
                  <Button
                    size="sm"
                    variant="cta"
                    className="bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-200/50"
                    onClick={() => onVote("thread", t.id, "down")}
                    disabled={userVotes.has(`thread:${t.id}`)}
                  >
                    ▼ {t.downvotes}
                  </Button>
                  {userVotes.has(`thread:${t.id}`) && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        userVoteTypes[`thread:${t.id}`] === "down"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {userVoteTypes[`thread:${t.id}`] === "down"
                        ? tForum("thread.vote.downvoted")
                        : tForum("thread.vote.upvoted")}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-sm font-medium text-indigo-700">
                  {tForum("comments.title")}
                </div>
                <div className="mt-2">{buildTree(t.comments || [])}</div>
                {address && (
                  <div className="mt-2">
                    <ReplyBox onSubmit={(text) => onPostComment(t.id, text)} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
}
