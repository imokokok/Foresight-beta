"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, Clock, Edit2, Save, X } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { useTranslations, useLocale, formatTranslation } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { formatAddress } from "@/lib/address";
import GradientPage from "@/components/ui/GradientPage";

type Thread = Database["public"]["Tables"]["forum_threads"]["Row"];

type ReviewItem = Thread & {
  proposalLink?: string;
  category?: string | null;
  deadline?: string | null;
  title_preview?: string | null;
  criteria_preview?: string | null;
  subject_name?: string | null;
  action_verb?: string | null;
  target_value?: string | null;
};

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();
  const tCommon = useTranslations("common");
  const tProposals = useTranslations("proposals");
  const { locale } = useLocale();

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review/proposals?status=pending_review", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/proposals");
        return;
      }
      if (!res.ok) {
        setError(tProposals("review.loadFailed"));
        setItems([]);
        return;
      }
      const data = await res.json();
      const list: Thread[] = data.items || [];
      const mapped: ReviewItem[] = list.map((t) => ({
        ...t,
        proposalLink: `/proposals/${t.id}`,
      }));
      setItems(mapped);
      if (mapped.length > 0 && selectedId == null) {
        setSelectedId(mapped[0].id);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [router, selectedId, tProposals]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const selected = items.find((x) => x.id === selectedId) || null;

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    category: "",
    deadline: "",
    title_preview: "",
    criteria_preview: "",
    subject_name: "",
    action_verb: "",
    target_value: "",
  });

  useEffect(() => {
    setEditing(false);
    setReason("");
  }, [selectedId]);

  const startEdit = () => {
    if (!selected) return;
    setEditForm({
      category: String(selected.category || ""),
      deadline: selected.deadline ? new Date(selected.deadline).toISOString().split("T")[0] : "",
      title_preview: String(selected.title_preview || ""),
      criteria_preview: String(selected.criteria_preview || ""),
      subject_name: String(selected.subject_name || ""),
      action_verb: String(selected.action_verb || ""),
      target_value: String(selected.target_value || ""),
    });
    setEditing(true);
  };

  const saveMetadata = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/review/proposals/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_metadata",
          patch: {
            ...editForm,
            deadline: editForm.deadline ? new Date(editForm.deadline).toISOString() : null,
          },
        }),
      });
      if (!res.ok) {
        alert("Failed to update metadata");
        return;
      }
      setEditing(false);
      await loadItems();
    } catch {
      alert("Failed to update metadata");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAction = async (action: "approve" | "reject" | "needs_changes") => {
    if (!selected) return;
    if ((action === "reject" || action === "needs_changes") && !reason.trim()) {
      alert(tProposals("review.alertReasonRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/review/proposals/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!res.ok) {
        alert(tProposals("review.alertSubmitFailed"));
        return;
      }
      setReason("");
      await loadItems();
    } catch {
      alert(tProposals("review.alertSubmitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GradientPage className="min-h-screen relative overflow-hidden p-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
      </div>
      <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{tProposals("review.title")}</h1>
            <p className="text-sm text-slate-500 mt-1">{tProposals("review.subtitle")}</p>
          </div>
          <button
            onClick={() => router.push("/proposals")}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {tProposals("review.backToProposals")}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden max-h-[70vh]">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-800">
                  {tProposals("review.pendingListTitle")}
                </span>
              </div>
              <button
                onClick={loadItems}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                {tCommon("refresh")}
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">{tProposals("review.loading")}</div>
              ) : error ? (
                <div className="p-6 flex items-center gap-2 text-sm text-rose-500">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              ) : items.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">{tProposals("review.empty")}</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={`px-4 py-3 cursor-pointer text-sm ${
                        selectedId === item.id ? "bg-purple-50" : "hover:bg-slate-50"
                      }`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-900 font-semibold truncate">
                            {item.title || tProposals("review.untitled")}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {item.content || tProposals("review.noDescription")}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] font-semibold text-slate-400">
                            {item.category || tProposals("review.uncategorized")}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDateTime(item.created_at, locale)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden max-h-[70vh]">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                {tProposals("review.detailTitle")}
              </span>
              {selected && (
                <a
                  href={selected.proposalLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-purple-600 hover:text-purple-700"
                >
                  {tProposals("review.openProposalPage")}
                </a>
              )}
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {!selected ? (
                <div className="text-sm text-slate-500">{tProposals("review.selectPrompt")}</div>
              ) : (
                <>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">
                      {tProposals("review.fieldTitle")}
                    </div>
                    <div className="text-lg font-bold text-slate-900">{selected.title}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">
                      {tProposals("review.fieldBody")}
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">
                      {selected.content || tProposals("review.noBody")}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
                    <div>
                      <div className="font-semibold text-slate-400 mb-1">
                        {tProposals("review.fieldAuthor")}
                      </div>
                      <div>{selected.user_id}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-400 mb-1">
                        {tProposals("review.fieldStatus")}
                      </div>
                      <div>{selected.review_status || "pending_review"}</div>
                    </div>
                  </div>
                  {selected.reviewed_by && selected.reviewed_at && (
                    <div className="mt-1 text-[11px] text-slate-400">
                      <span>
                        {formatTranslation(tProposals("review.reviewedByLine"), {
                          reviewer: formatAddress(selected.reviewed_by),
                          time: formatDateTime(selected.reviewed_at, locale),
                        })}
                      </span>
                    </div>
                  )}
                  <div className="py-2">
                    {editing ? (
                      <div className="border rounded-xl p-4 bg-slate-50 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">Metadata Editor</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditing(false)}
                              className="p-1 hover:bg-slate-200 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={saveMetadata}
                              disabled={submitting}
                              className="p-1 bg-purple-600 text-white hover:bg-purple-700 rounded"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">
                              Category
                            </label>
                            <input
                              className="w-full text-xs p-2 border rounded"
                              value={editForm.category}
                              onChange={(e) =>
                                setEditForm({ ...editForm, category: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">
                              Deadline
                            </label>
                            <input
                              type="date"
                              className="w-full text-xs p-2 border rounded"
                              value={editForm.deadline}
                              onChange={(e) =>
                                setEditForm({ ...editForm, deadline: e.target.value })
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">
                              Subject Name
                            </label>
                            <input
                              className="w-full text-xs p-2 border rounded"
                              value={editForm.subject_name}
                              onChange={(e) =>
                                setEditForm({ ...editForm, subject_name: e.target.value })
                              }
                              placeholder="e.g. Bitcoin"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">
                              Action Verb
                            </label>
                            <input
                              className="w-full text-xs p-2 border rounded"
                              value={editForm.action_verb}
                              onChange={(e) =>
                                setEditForm({ ...editForm, action_verb: e.target.value })
                              }
                              placeholder="e.g. price reaches"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">
                              Target Value
                            </label>
                            <input
                              className="w-full text-xs p-2 border rounded"
                              value={editForm.target_value}
                              onChange={(e) =>
                                setEditForm({ ...editForm, target_value: e.target.value })
                              }
                              placeholder="e.g. $100k"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">
                              Title Preview (Auto-Market)
                            </label>
                            <input
                              className="w-full text-xs p-2 border rounded"
                              value={editForm.title_preview}
                              onChange={(e) =>
                                setEditForm({ ...editForm, title_preview: e.target.value })
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">
                              Criteria Preview
                            </label>
                            <textarea
                              className="w-full text-xs p-2 border rounded"
                              rows={2}
                              value={editForm.criteria_preview}
                              onChange={(e) =>
                                setEditForm({ ...editForm, criteria_preview: e.target.value })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-xl p-4 bg-slate-50/50 space-y-2 relative group">
                        <button
                          onClick={startEdit}
                          className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-purple-600 bg-white border border-slate-200 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div>
                            <span className="text-slate-400">Category:</span>{" "}
                            <span className="font-medium ml-1">{selected.category || "-"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Deadline:</span>{" "}
                            <span className="font-medium ml-1">
                              {selected.deadline ? formatDateTime(selected.deadline, locale) : "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Subject:</span>{" "}
                            <span className="font-medium ml-1">{selected.subject_name || "-"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Verb:</span>{" "}
                            <span className="font-medium ml-1">{selected.action_verb || "-"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Target:</span>{" "}
                            <span className="font-medium ml-1">{selected.target_value || "-"}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400">Title Preview:</span>{" "}
                            <span className="font-medium ml-1 block truncate">
                              {selected.title_preview || "-"}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400">Criteria:</span>{" "}
                            <span className="font-medium ml-1 block truncate">
                              {selected.criteria_preview || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">
                      {tProposals("review.fieldReviewNote")}
                    </div>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={tProposals("review.reviewReasonPlaceholder")}
                      rows={3}
                      className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-3">
              <button
                disabled={!selected || submitting}
                onClick={() => submitAction("approve")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {tProposals("review.actionApprove")}
              </button>
              <button
                disabled={!selected || submitting}
                onClick={() => submitAction("needs_changes")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <AlertCircle className="w-4 h-4" />
                {tProposals("review.actionNeedsChanges")}
              </button>
              <button
                disabled={!selected || submitting}
                onClick={() => submitAction("reject")}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {tProposals("review.actionReject")}
              </button>
              <div className="ml-auto text-[11px] text-slate-400">
                {tProposals("review.hintAutoMarket")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GradientPage>
  );
}
