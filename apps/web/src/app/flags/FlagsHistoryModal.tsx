"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Users, ShieldCheck, CheckCircle2, Clock, History, Target } from "lucide-react";
import type { FlagItem } from "@/components/FlagCard";
import { formatAddress } from "@/lib/address";
import { useLocale, formatTranslation } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import { getFlagTierFromTotalDays, getTierSettleRule } from "@/lib/flagRewards";

type HistoryItem = {
  id: string;
  note: string;
  image_url?: string;
  created_at: string;
  review_status?: string;
  reviewer_id?: string;
  review_reason?: string;
  reviewed_at?: string;
};

type FlagsHistoryModalProps = {
  isOpen: boolean;
  flag: FlagItem | null;
  loading: boolean;
  items: HistoryItem[];
  viewerId: string;
  reviewSubmittingId: string | null;
  onClose: () => void;
  onReview: (checkinId: string, action: "approve" | "reject") => void;
  tFlags: (key: string) => string;
  tasksIndex?: number;
  tasksTotal?: number;
};

export function FlagsHistoryModal({
  isOpen,
  flag,
  loading,
  items,
  viewerId,
  reviewSubmittingId,
  onClose,
  onReview,
  tFlags,
  tasksIndex,
  tasksTotal,
}: FlagsHistoryModalProps) {
  // Determine if there are pending items to review
  const { locale } = useLocale();
  const pendingItems = items.filter((item) => item.review_status === "pending");
  const isWitnessMode =
    typeof tasksIndex === "number" && typeof tasksTotal === "number" && tasksTotal > 0;

  const startDate = flag ? new Date(flag.created_at) : null;
  const endDate = flag ? new Date(flag.deadline) : null;
  let challengeDurationText = "";
  let challengeRangeText = "";
  let totalDaysForRule: number | null = null;
  if (
    startDate &&
    endDate &&
    !Number.isNaN(startDate.getTime()) &&
    !Number.isNaN(endDate.getTime())
  ) {
    const msDay = 86400000;
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const totalDays = Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / msDay) + 1);
    totalDaysForRule = totalDays;
    const daysLabel = tFlags("card.time.daysLabel");
    challengeDurationText = `${totalDays} ${daysLabel}`;
    challengeRangeText = `${formatDateTime(startDate, locale)} - ${formatDateTime(endDate, locale)}`;
  }

  const successConditionText = (() => {
    const defaultText = tFlags("history.successCondition.default");
    if (!flag || !totalDaysForRule) return defaultText;

    const tier = getFlagTierFromTotalDays(totalDaysForRule);
    const rule = getTierSettleRule(tier);
    const minDays = Math.min(rule.minDays, totalDaysForRule);
    const thresholdPercent = Math.round(rule.threshold * 100);

    const template = tFlags("history.successCondition.dynamic");
    if (!template || template === "history.successCondition.dynamic") return defaultText;

    return formatTranslation(template, {
      minDays,
      threshold: thresholdPercent,
    });
  })();

  return (
    <AnimatePresence>
      {isOpen && flag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/40 backdrop-blur-3xl"
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] pointer-events-none" />
          </motion.div>

          <motion.div
            layoutId="history-modal-container"
            initial={{ opacity: 0, scale: 0.8, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 40 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col md:flex-row border border-white h-[85vh] md:h-[600px]"
          >
            {/* Left Decor Area */}
            <div
              className={`w-full md:w-72 p-8 flex flex-col relative overflow-hidden shrink-0 ${
                isWitnessMode
                  ? "bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-100"
                  : "bg-gradient-to-br from-purple-100 via-pink-100 to-rose-100"
              }`}
            >
              {/* Mesh Gradient Effect Overlay */}
              <div className="absolute inset-0 opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-white/30 rounded-full blur-[60px] animate-pulse" />
                <div
                  className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[50px] ${
                    isWitnessMode ? "bg-amber-500/10" : "bg-purple-500/10"
                  }`}
                />
              </div>

              <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex-1">
                  <motion.div
                    initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center md:items-start"
                  >
                    <div className="w-16 h-16 rounded-[1.5rem] bg-white/95 shadow-2xl flex items-center justify-center mb-6 border border-white/20">
                      {isWitnessMode ? (
                        <ShieldCheck className="w-8 h-8 text-amber-500" />
                      ) : (
                        <History className="w-8 h-8 text-purple-500" />
                      )}
                    </div>
                    <div className="text-4xl mb-2 filter drop-shadow-lg">
                      {isWitnessMode ? "👀" : "📅"}
                    </div>
                    <h3
                      className={`font-black text-xl leading-tight tracking-tight drop-shadow-sm mb-2 ${
                        isWitnessMode ? "text-amber-900" : "text-purple-900"
                      }`}
                    >
                      {isWitnessMode ? tFlags("history.witnessLabel") : tFlags("history.title")}
                    </h3>
                    <p
                      className={`text-sm font-medium leading-relaxed ${
                        isWitnessMode ? "text-amber-800/70" : "text-purple-800/70"
                      }`}
                    >
                      {isWitnessMode
                        ? tFlags("history.intro.witness")
                        : tFlags("history.intro.default")}
                    </p>
                  </motion.div>
                </div>

                <div className="mt-8">
                  <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-white/50 shadow-sm space-y-3">
                    <div
                      className={`text-xs font-black uppercase tracking-wider ${
                        isWitnessMode ? "text-amber-900/50" : "text-purple-900/50"
                      }`}
                    >
                      {isWitnessMode
                        ? tFlags("history.labels.currentWitnessTask")
                        : tFlags("history.labels.challengeTopic")}
                    </div>
                    <h4
                      className={`font-bold line-clamp-2 ${
                        isWitnessMode ? "text-amber-900" : "text-purple-900"
                      }`}
                    >
                      {flag.title}
                    </h4>
                    {flag.description && (
                      <p
                        className={`text-xs leading-relaxed ${
                          isWitnessMode ? "text-amber-900/80" : "text-purple-900/80"
                        }`}
                      >
                        {flag.description}
                      </p>
                    )}
                    <div className="space-y-1.5 text-[11px] font-bold">
                      <div
                        className={`flex items-center gap-2 ${
                          isWitnessMode ? "text-amber-800/80" : "text-purple-800/80"
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        <span>
                          {tFlags("history.labels.initiator")}: {formatAddress(flag.user_id)}
                        </span>
                      </div>
                      {flag.verification_type === "witness" && flag.witness_id && (
                        <div
                          className={`flex items-center gap-2 ${
                            isWitnessMode ? "text-amber-800/80" : "text-purple-800/80"
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>
                            {tFlags("history.witnessLabel")}: {formatAddress(flag.witness_id)}
                          </span>
                        </div>
                      )}
                      {challengeDurationText && (
                        <div
                          className={`flex items-center gap-2 ${
                            isWitnessMode ? "text-amber-800/80" : "text-purple-800/80"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>
                            {tFlags("history.labels.challengeDuration")}: {challengeDurationText}
                            {challengeRangeText ? ` · ${challengeRangeText}` : ""}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex items-start gap-2 ${
                          isWitnessMode ? "text-amber-800/80" : "text-purple-800/80"
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3 mt-[2px]" />
                        <span>
                          {tFlags("history.labels.successCondition")}: {successConditionText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isWitnessMode && (
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-amber-900/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${(((tasksIndex || 0) + 1) / (tasksTotal || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="text-[10px] font-black text-amber-900/50">
                        {(tasksIndex || 0) + 1}/{tasksTotal}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col relative h-full bg-white/50">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2.5 rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all z-20 group"
              >
                <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              </button>

              <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-xl mx-auto pt-8">
                  <h2 className="text-2xl font-black text-gray-900 mb-6">
                    {tFlags("history.title")}
                  </h2>

                  {loading ? (
                    <div className="flex justify-center py-20">
                      <Loader2
                        className={`w-8 h-8 animate-spin ${
                          isWitnessMode ? "text-amber-500" : "text-purple-500"
                        }`}
                      />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Clock className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">{tFlags("history.empty")}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {items.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`relative p-5 rounded-3xl border transition-all ${
                            item.review_status === "pending"
                              ? "bg-white border-amber-200 shadow-lg shadow-amber-500/5 ring-4 ring-amber-50"
                              : "bg-white border-gray-100 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  item.review_status === "pending"
                                    ? "bg-amber-500 animate-pulse"
                                    : item.review_status === "approved"
                                      ? "bg-emerald-500"
                                      : item.review_status === "rejected"
                                        ? "bg-rose-500"
                                        : "bg-gray-300"
                                }`}
                              />
                              <div className="text-xs font-bold text-gray-400">
                                {formatDateTime(item.created_at, locale)}
                              </div>
                            </div>
                            {item.review_status && item.review_status !== "pending" && (
                              <div
                                className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                  item.review_status === "approved"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {item.review_status === "approved"
                                  ? tFlags("history.status.approved")
                                  : tFlags("history.status.rejected")}
                              </div>
                            )}
                          </div>

                          <p className="text-gray-900 font-bold text-lg mb-4 leading-relaxed">
                            {item.note}
                          </p>
                          {item.image_url && (
                            <div className="rounded-2xl overflow-hidden mb-4 border border-gray-100 shadow-sm">
                              <img
                                src={item.image_url}
                                alt="Proof"
                                className="w-full object-cover max-h-64 hover:scale-105 transition-transform duration-500"
                              />
                            </div>
                          )}

                          {item.review_status && item.review_status !== "pending" && (
                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-[11px] text-gray-500">
                              {item.review_reason && (
                                <div className="flex items-start gap-2">
                                  <Target className="w-3 h-3 mt-[2px]" />
                                  <span>{item.review_reason}</span>
                                </div>
                              )}
                              {(item.reviewer_id || item.reviewed_at) && (
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>
                                    {item.reviewer_id ? formatAddress(item.reviewer_id) : null}
                                    {item.reviewer_id && item.reviewed_at ? " · " : null}
                                    {item.reviewed_at
                                      ? formatDateTime(item.reviewed_at, locale)
                                      : null}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {item.review_status === "pending" &&
                            flag.verification_type === "witness" && (
                              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100 border-dashed">
                                {String(flag.witness_id || "").toLowerCase() === viewerId ? (
                                  <>
                                    <button
                                      disabled={!!reviewSubmittingId}
                                      onClick={() => onReview(item.id, "reject")}
                                      className="flex-1 py-3 bg-rose-50 text-rose-600 text-sm font-black rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                      {reviewSubmittingId === item.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <X className="w-4 h-4" />
                                          {tFlags("history.actions.reject")}
                                        </>
                                      )}
                                    </button>
                                    <button
                                      disabled={!!reviewSubmittingId}
                                      onClick={() => onReview(item.id, "approve")}
                                      className="flex-1 py-3 bg-emerald-500 text-white text-sm font-black rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 transform active:scale-95"
                                    >
                                      {reviewSubmittingId === item.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-4 h-4" />
                                          {tFlags("history.actions.approve")}
                                        </>
                                      )}
                                    </button>
                                  </>
                                ) : (
                                  <div className="w-full py-3 bg-gray-50 text-gray-500 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    {tFlags("history.status.waitingReview")}
                                  </div>
                                )}
                              </div>
                            )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
