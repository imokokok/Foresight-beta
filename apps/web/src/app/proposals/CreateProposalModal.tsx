import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  FileText,
  Send,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useCategories } from "@/hooks/useQueries";
import { useTranslations, t } from "@/lib/i18n";
import { PROPOSALS_EVENT_ID } from "./proposalsListUtils";
import { toast, handleApiError } from "@/lib/toast";

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateProposalModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProposalModalProps) {
  const { account, connectWallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"post" | "image" | "link">("post");
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "General",
    deadline: "",
  });
  const { data: categoriesData } = useCategories();
  const tProposals = useTranslations("proposals");

  const categoryNames = React.useMemo(() => {
    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
      const names: string[] = [];
      (categoriesData as any[]).forEach((item) => {
        const name = String((item as any).name || "").trim();
        if (name && !names.includes(name)) {
          names.push(name);
        }
      });
      return names;
    }
    return ["General", "Tech", "Business", "Crypto", "Sports", "Politics", "Other"];
  }, [categoriesData]);

  const handleSubmit = async () => {
    if (!account) {
      toast.warning(t("forum.errors.walletRequired"));
      connectWallet();
      return;
    }
    if (!form.title) return;

    try {
      setLoading(true);
      const res = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: PROPOSALS_EVENT_ID,
          title: form.title,
          content: form.content,
          category: form.category,
          walletAddress: account,
        }),
      });

      if (!res.ok) {
        let errorPayload: unknown = null;
        try {
          errorPayload = await res.json();
        } catch {
          errorPayload = { status: res.status };
        }
        handleApiError(errorPayload, "errors.somethingWrong");
        return;
      }

      toast.success(t("common.success"));
      setForm({ title: "", content: "", category: "General", deadline: "" });
      onSuccess();
      onClose();
    } catch (e) {
      handleApiError(e, "errors.somethingWrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-purple-500/15 backdrop-blur-md z-50 transition-all duration-300"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-purple-500/10 z-50 p-8 overflow-hidden max-h-[90vh] overflow-y-auto border border-white/50"
          >
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-50/50 to-transparent pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-purple-600 border border-purple-100">
                  <Sparkles className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-purple-700 tracking-tight">
                    {tProposals("create.title")}
                  </h2>
                  <p className="text-sm font-medium text-gray-400">
                    {tProposals("create.subtitle")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:scale-110 transition-all shadow-sm hover:shadow-md border border-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Type Tabs */}
            <div className="flex gap-3 mb-8 relative z-10">
              {[
                { id: "post", label: tProposals("create.tabPost"), icon: FileText },
                { id: "image", label: tProposals("create.tabImage"), icon: ImageIcon },
                { id: "link", label: tProposals("create.tabLink"), icon: LinkIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-4 rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all border-2 ${
                    activeTab === tab.id
                      ? "bg-purple-50 border-purple-200 text-purple-600 shadow-sm"
                      : "bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:border-gray-200"
                  }`}
                >
                  <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? "fill-current" : ""}`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form Fields */}
            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={tProposals("create.titlePlaceholder")}
                  className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-lg font-bold text-gray-800 placeholder:text-gray-300 transition-all shadow-sm"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                {activeTab === "post" && (
                  <div className="flex justify-end mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        const template = `Subject Name: 
Action Verb: 
Target Value: 
Expected Deadline: 
Criteria / Rules: 
`;
                        setForm((prev) => ({
                          ...prev,
                          content: prev.content ? prev.content + "\n\n" + template : template,
                        }));
                      }}
                      className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      Use Market Template
                    </button>
                  </div>
                )}
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder={
                    activeTab === "post"
                      ? tProposals("create.contentPlaceholderPost")
                      : activeTab === "link"
                        ? tProposals("create.contentPlaceholderLink")
                        : tProposals("create.contentPlaceholderImage")
                  }
                  rows={6}
                  className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-base font-medium text-gray-700 placeholder:text-gray-300 resize-none transition-all shadow-sm"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                  {tProposals("create.categoryLabel")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {categoryNames.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setForm({ ...form, category: cat })}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                        form.category === cat
                          ? "border-purple-200 bg-purple-50 text-purple-600 shadow-sm"
                          : "border-gray-100 bg-white text-gray-400 hover:border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex justify-end gap-3 relative z-10">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {tProposals("create.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !form.title}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-bold hover:shadow-lg hover:shadow-purple-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {loading ? tProposals("create.submitting") : tProposals("create.submit")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
