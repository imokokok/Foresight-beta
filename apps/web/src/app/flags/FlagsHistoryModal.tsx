import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Users, X, Clock, CheckCircle2 } from "lucide-react";
import type { FlagItem } from "@/components/FlagCard";

type HistoryItem = {
  id: string;
  note: string;
  image_url?: string;
  created_at: string;
  review_status?: string;
  reviewer_id?: string;
  review_reason?: string;
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
}: FlagsHistoryModalProps) {
  return (
    <AnimatePresence>
      {isOpen && flag && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-xl shrink-0">
              <div>
                <h3 className="text-2xl font-black text-gray-900">{tFlags("history.title")}</h3>
                {flag.verification_type === "witness" && flag.witness_id && (
                  <div className="mt-1 text-xs font-bold text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{tFlags("history.witnessLabel")}</span>
                    <span className="text-gray-700">
                      {flag.witness_id.length > 12
                        ? `${flag.witness_id.slice(0, 6)}...${flag.witness_id.slice(-4)}`
                        : flag.witness_id}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 text-gray-500 font-medium">
                  {tFlags("history.empty")}
                </div>
              ) : (
                <div className="relative border-l-2 border-gray-100 ml-4 space-y-8">
                  {items.map((item) => (
                    <div key={item.id} className="relative pl-8">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-purple-500" />
                      <div className="text-xs font-bold text-gray-400 mb-1">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-gray-900 font-medium mb-2">{item.note}</p>
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt="Proof"
                            className="w-full rounded-lg mb-2 object-cover max-h-48"
                          />
                        )}

                        {item.review_status === "pending" &&
                          flag.verification_type === "witness" && (
                            <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                              {String(flag.witness_id || "").toLowerCase() === viewerId ? (
                                <>
                                  <button
                                    disabled={!!reviewSubmittingId}
                                    onClick={() => onReview(item.id, "approve")}
                                    className="flex-1 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-200"
                                  >
                                    {reviewSubmittingId === item.id
                                      ? "..."
                                      : tFlags("history.actions.approve")}
                                  </button>
                                  <button
                                    disabled={!!reviewSubmittingId}
                                    onClick={() => onReview(item.id, "reject")}
                                    className="flex-1 py-1.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-lg hover:bg-rose-200"
                                  >
                                    {reviewSubmittingId === item.id
                                      ? "..."
                                      : tFlags("history.actions.reject")}
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />{" "}
                                  {tFlags("history.status.waitingReview")}
                                </span>
                              )}
                            </div>
                          )}
                        {item.review_status === "approved" && (
                          <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {tFlags("history.status.approved")}
                          </div>
                        )}
                        {item.review_status === "rejected" && (
                          <div className="mt-2 text-xs font-bold text-rose-600 flex items-center gap-1">
                            <X className="w-3 h-3" /> {tFlags("history.status.rejected")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
