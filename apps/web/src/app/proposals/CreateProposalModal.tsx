import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Image as ImageIcon, Sparkles, Send, Plus, Trash2 } from "lucide-react";
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
  const { account, connectWallet, siweLogin, isAuthenticated } = useWallet();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    subjectName: string;
    actionVerb: "priceReach" | "willWin" | "willHappen";
    targetValue: string;
    category: string;
    resolutionTime: string;
    outcomes: string[];
    resolutionCriteria: string;
    primarySourceUrl: string;
    extraLinks: string[];
    imageUrls: string[];
  }>({
    title: "",
    description: "",
    subjectName: "",
    actionVerb: "willHappen",
    targetValue: "",
    category: "General",
    resolutionTime: "",
    outcomes: ["Yes", "No"],
    resolutionCriteria: "",
    primarySourceUrl: "",
    extraLinks: [],
    imageUrls: [],
  });
  const { data: categoriesData } = useCategories();
  const tProposals = useTranslations("proposals");

  const categoryNames = useMemo(() => {
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

  const isValidHttpUrl = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return false;
    try {
      const u = new URL(raw);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const normalizedOutcomes = useMemo(() => {
    const list = (form.outcomes || []).map((x) => String(x || "").trim()).filter(Boolean);
    const uniq: string[] = [];
    for (const x of list) {
      const key = x.toLowerCase();
      if (!uniq.some((y) => y.toLowerCase() === key)) uniq.push(x);
    }
    return uniq;
  }, [form.outcomes]);

  const buildContent = useCallbackContent(() => {
    const parts: string[] = [];
    const desc = String(form.description || "").trim();
    const subjectName = String(form.subjectName || "").trim();
    const actionVerb = String(form.actionVerb || "").trim();
    const actionVerbLabel =
      actionVerb === "priceReach"
        ? "价格达到"
        : actionVerb === "willWin"
          ? "将会赢得"
          : actionVerb === "willHappen"
            ? "将会发生"
            : actionVerb;
    const targetValue = String(form.targetValue || "").trim();

    if (subjectName) parts.push(`Subject Name: ${subjectName}`);
    if (actionVerbLabel) parts.push(`Action Verb: ${actionVerbLabel}`);
    if (targetValue) parts.push(`Target Value: ${targetValue}`);
    if (desc) parts.push(desc);
    parts.push("---");
    if (form.resolutionTime) {
      parts.push(`Resolution Time: ${form.resolutionTime}`);
    }
    if (normalizedOutcomes.length >= 2) {
      parts.push("Outcomes:");
      normalizedOutcomes.forEach((o) => parts.push(`- ${o}`));
    }
    if (form.primarySourceUrl.trim()) {
      parts.push(`Primary Source: ${form.primarySourceUrl.trim()}`);
    }
    const links = (form.extraLinks || []).map((x) => String(x || "").trim()).filter(Boolean);
    if (links.length > 0) {
      parts.push("Additional Links:");
      links.forEach((u) => parts.push(`- ${u}`));
    }
    const imgs = (form.imageUrls || []).map((x) => String(x || "").trim()).filter(Boolean);
    if (imgs.length > 0) {
      parts.push("Attachments:");
      imgs.forEach((u) => parts.push(`- ${u}`));
    }
    return parts.join("\n");
  });

  function useCallbackContent(factory: () => string) {
    return React.useCallback(factory, [factory]);
  }

  const validate = () => {
    const title = String(form.title || "").trim();
    if (!title) return tProposals("create.titlePlaceholder");
    if (title.replace(/\s+/g, "").length < 8) return tProposals("create.titlePlaceholder");

    const subjectName = String(form.subjectName || "").trim();
    if (!subjectName) return "请填写主体名称";

    const actionVerb = String(form.actionVerb || "").trim();
    if (!actionVerb) return "请选择动作类型";

    const targetValue = String(form.targetValue || "").trim();
    if (!targetValue) return "请填写目标值";

    if (!String(form.category || "").trim()) return tProposals("create.categoryLabel");

    const resolutionTime = String(form.resolutionTime || "").trim();
    const ms = resolutionTime ? new Date(resolutionTime).getTime() : NaN;
    if (!Number.isFinite(ms)) return "请填写到期/结算时间";
    if (ms <= Date.now()) return "到期/结算时间必须在未来";

    if (normalizedOutcomes.length < 2) return "至少需要 2 个结果选项";

    const criteria = String(form.resolutionCriteria || "").trim();
    if (criteria.length < 20) return "请补充结算规则（至少 20 字）";

    const source = String(form.primarySourceUrl || "").trim();
    if (!isValidHttpUrl(source)) return "请填写有效的主要来源链接（http/https）";

    return null;
  };

  const onUploadImage = async (file: File) => {
    if (!account) {
      toast.warning(t("forum.errors.walletRequired"));
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("walletAddress", account);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const payload =
          data && typeof data === "object"
            ? { status: res.status, ...data }
            : { status: res.status };
        handleApiError(payload, "errors.somethingWrong");
        return;
      }
      const url = String(data?.data?.publicUrl || "").trim();
      if (!url) {
        toast.error(t("errors.somethingWrong"));
        return;
      }
      setForm((prev) => ({ ...prev, imageUrls: Array.from(new Set([...prev.imageUrls, url])) }));
      toast.success(t("common.success"));
    } catch (e) {
      handleApiError(e, "errors.somethingWrong");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!account) {
      toast.warning(t("forum.errors.walletRequired"));
      await connectWallet();
      return;
    }
    const err = validate();
    if (err) {
      toast.warning(err);
      return;
    }

    try {
      setLoading(true);
      if (!isAuthenticated) {
        const r = await siweLogin();
        if (!r.success) {
          toast.error(t("errors.wallet.verifyFailed"), r.error);
          return;
        }
      }
      const deadlineIso = new Date(form.resolutionTime).toISOString();
      const content = buildContent();
      const res = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: PROPOSALS_EVENT_ID,
          title: form.title.trim(),
          content,
          category: form.category,
          deadline: deadlineIso,
          titlePreview: form.title.trim(),
          criteriaPreview: form.resolutionCriteria.trim(),
          subjectName: form.subjectName.trim(),
          actionVerb: form.actionVerb,
          targetValue: form.targetValue.trim(),
          primarySourceUrl: form.primarySourceUrl.trim(),
          outcomes: normalizedOutcomes,
          extraLinks: (form.extraLinks || []).map((x) => String(x || "").trim()).filter(Boolean),
          imageUrls: (form.imageUrls || []).map((x) => String(x || "").trim()).filter(Boolean),
          walletAddress: account,
        }),
      });

      if (!res.ok) {
        let errorPayload: unknown = null;
        try {
          errorPayload = await res.json();
        } catch {
          errorPayload = null;
        }
        const mergedErrorPayload =
          errorPayload && typeof errorPayload === "object" && errorPayload !== null
            ? { ...(errorPayload as Record<string, unknown>), status: res.status }
            : { status: res.status };

        handleApiError(mergedErrorPayload, "errors.somethingWrong");
        return;
      }

      toast.success(t("common.success"));
      setForm({
        title: "",
        description: "",
        subjectName: "",
        actionVerb: "willHappen",
        targetValue: "",
        category: "General",
        resolutionTime: "",
        outcomes: ["Yes", "No"],
        resolutionCriteria: "",
        primarySourceUrl: "",
        extraLinks: [],
        imageUrls: [],
      });
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-purple-500/15 backdrop-blur-md z-50 transition-all duration-300"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-purple-500/10 z-50 p-8 overflow-hidden max-h-[90vh] overflow-y-auto border border-white/50"
          >
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-50/50 to-transparent pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

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

            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={tProposals("create.titlePlaceholder")}
                  className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-lg font-bold text-gray-800 placeholder:text-gray-300 transition-all shadow-sm"
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    主体名称
                  </label>
                  <input
                    value={form.subjectName}
                    onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
                    placeholder="例如：BTC、特朗普、Apple"
                    className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-sm font-semibold text-gray-700 placeholder:text-gray-300 transition-all shadow-sm"
                    maxLength={64}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    动作类型
                  </label>
                  <select
                    value={form.actionVerb}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        actionVerb: e.target.value as "priceReach" | "willWin" | "willHappen",
                      })
                    }
                    className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-sm font-semibold text-gray-700 transition-all shadow-sm"
                  >
                    <option value="willHappen">将会发生</option>
                    <option value="priceReach">价格达到</option>
                    <option value="willWin">将会赢得</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    目标值
                  </label>
                  <input
                    value={form.targetValue}
                    onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                    placeholder="例如：100000、胜选、通过"
                    className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-sm font-semibold text-gray-700 placeholder:text-gray-300 transition-all shadow-sm"
                    maxLength={64}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    选择分类
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categoryNames.map((cat) => (
                      <button
                        key={cat}
                        type="button"
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

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    到期 / 结算时间
                  </label>
                  <input
                    type="datetime-local"
                    value={form.resolutionTime}
                    onChange={(e) => setForm({ ...form, resolutionTime: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-sm font-semibold text-gray-700 placeholder:text-gray-300 transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    结果选项
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, outcomes: [...prev.outcomes, ""] }))
                    }
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    添加选项
                  </button>
                </div>
                <div className="space-y-2">
                  {form.outcomes.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={v}
                        onChange={(e) => {
                          const next = [...form.outcomes];
                          next[idx] = e.target.value;
                          setForm({ ...form, outcomes: next });
                        }}
                        placeholder={idx === 0 ? "Yes" : idx === 1 ? "No" : `Outcome ${idx + 1}`}
                        className="flex-1 px-4 py-3 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-sm font-semibold text-gray-700 placeholder:text-gray-300 transition-all shadow-sm"
                        maxLength={32}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (form.outcomes.length <= 2) return;
                          const next = form.outcomes.filter((_, i) => i !== idx);
                          setForm({ ...form, outcomes: next });
                        }}
                        disabled={form.outcomes.length <= 2}
                        className="w-10 h-10 rounded-2xl bg-white border-2 border-gray-100 text-gray-400 hover:text-rose-600 hover:border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    主要来源链接（必填）
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        outcomes: prev.outcomes.length ? prev.outcomes : ["Yes", "No"],
                        resolutionCriteria:
                          prev.resolutionCriteria ||
                          "以客观可验证来源为准；在到期时间前满足条件视为达成；如存在歧义以主要来源的正式公告为准。",
                      }));
                    }}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    Use Market Template
                  </button>
                </div>
                <input
                  value={form.primarySourceUrl}
                  onChange={(e) => setForm({ ...form, primarySourceUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-base font-semibold text-gray-700 placeholder:text-gray-300 transition-all shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                  结算规则（必填）
                </label>
                <textarea
                  value={form.resolutionCriteria}
                  onChange={(e) => setForm({ ...form, resolutionCriteria: e.target.value })}
                  placeholder="清晰说明什么条件算 Yes/No，以什么来源为准…"
                  rows={4}
                  className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-base font-medium text-gray-700 placeholder:text-gray-300 resize-none transition-all shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                  详细描述（可选）
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={tProposals("create.contentPlaceholderPost")}
                  rows={5}
                  className="w-full px-6 py-4 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-base font-medium text-gray-700 placeholder:text-gray-300 resize-none transition-all shadow-sm"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    补充链接（可选）
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, extraLinks: [...prev.extraLinks, ""] }))
                    }
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    添加链接
                  </button>
                </div>
                <div className="space-y-2">
                  {form.extraLinks.map((u, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={u}
                        onChange={(e) => {
                          const next = [...form.extraLinks];
                          next[idx] = e.target.value;
                          setForm({ ...form, extraLinks: next });
                        }}
                        placeholder="https://..."
                        className="flex-1 px-4 py-3 rounded-2xl bg-white border-2 border-gray-100 focus:border-purple-300 focus:ring-4 focus:ring-purple-100/50 outline-none text-sm font-semibold text-gray-700 placeholder:text-gray-300 transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            extraLinks: prev.extraLinks.filter((_, i) => i !== idx),
                          }))
                        }
                        className="w-10 h-10 rounded-2xl bg-white border-2 border-gray-100 text-gray-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {form.extraLinks.length === 0 && (
                    <div className="text-xs text-slate-400">可添加多个补充来源或参考资料链接</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                    图片 / 媒体（可选）
                  </label>
                  <div className="text-xs text-slate-400">
                    {uploading
                      ? "上传中…"
                      : form.imageUrls.length
                        ? `${form.imageUrls.length} 张`
                        : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1 px-4 py-3 rounded-2xl bg-white border-2 border-gray-100 hover:border-purple-200 hover:bg-purple-50/40 transition-all cursor-pointer text-sm font-semibold text-slate-600 flex items-center justify-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    选择图片
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void onUploadImage(file);
                        e.target.value = "";
                      }}
                      disabled={uploading}
                    />
                  </label>
                </div>
                {form.imageUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {form.imageUrls.map((u) => (
                      <div
                        key={u}
                        className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden"
                      >
                        <img src={u} alt="" className="w-full h-24 object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              imageUrls: prev.imageUrls.filter((x) => x !== u),
                            }))
                          }
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-slate-200 text-slate-500 hover:text-rose-600 flex items-center justify-center shadow-sm"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 relative z-10">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {tProposals("create.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  loading ||
                  uploading ||
                  !form.title.trim() ||
                  !form.subjectName.trim() ||
                  !form.targetValue.trim() ||
                  !form.resolutionTime ||
                  !form.primarySourceUrl.trim()
                }
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
