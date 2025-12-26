"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { useTranslations } from "@/lib/i18n";

type Thread = Database["public"]["Tables"]["forum_threads"]["Row"];

type ReviewItem = Thread & {
  proposalLink?: string;
  category?: string | null;
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

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review/proposals?status=pending_review", { cache: "no-store" });
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
  }, [selectedId, tProposals]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const selected = items.find((x) => x.id === selectedId) || null;

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-rose-50/30 p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
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
                            {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
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
    </div>
  );
}
