"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import DatePicker from "@/components/ui/DatePicker";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { motion } from "framer-motion";
import {
  AlignLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Coins,
  Layout,
  Sparkles,
  Type,
  AlertCircle,
  Plus,
  Trash2,
  Palette,
  Image as ImageIcon,
  Layers,
  Settings2,
  Scale,
  ChevronDown,
  Loader2,
  Save,
  RotateCcw,
  ChevronUp,
  FileText,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n";
import { useCategories } from "@/hooks/useQueries";

const CATEGORY_ID_MAP: Record<string, string> = {
  科技: "tech",
  娱乐: "entertainment",
  时政: "politics",
  天气: "weather",
  体育: "sports",
  商业: "business",
  加密货币: "crypto",
  更多: "more",
};

const CATEGORY_NAME_MAP: Record<string, string> = {
  tech: "科技",
  entertainment: "娱乐",
  politics: "时政",
  weather: "天气",
  sports: "体育",
  crypto: "加密货币",
  business: "商业",
  more: "更多",
};

const DRAFT_KEY = "admin_prediction_new_draft_v1";

type Outcome = {
  label: string;
  description?: string;
  color?: string;
  image_url?: string;
};

function usePredictionOutcomes(setOutcomes: React.Dispatch<React.SetStateAction<Outcome[]>>) {
  const onAddOutcome = useCallback(() => {
    setOutcomes((p) => [...p, { label: `选项${p.length}` }]);
  }, [setOutcomes]);

  const onDelOutcome = useCallback(
    (i: number) => {
      setOutcomes((p) => p.filter((_, idx) => idx !== i));
    },
    [setOutcomes]
  );

  const onOutcomeChange = useCallback(
    (i: number, k: keyof Outcome, v: any) => {
      setOutcomes((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
    },
    [setOutcomes]
  );

  return {
    onAddOutcome,
    onDelOutcome,
    onOutcomeChange,
  };
}

function usePredictionDraft(
  form: any,
  setForm: React.Dispatch<React.SetStateAction<any>>,
  outcomes: Outcome[],
  setOutcomes: React.Dispatch<React.SetStateAction<Outcome[]>>,
  tTrendingAdmin: ReturnType<typeof useTranslations>
) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const manualSaveDraft = () => {
    const payload = { form, outcomes, ts: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setLastSaved(new Date());
    setMsg(tTrendingAdmin("draft.savedMsg"));
    toast.success(tTrendingAdmin("draft.savedToastTitle"), tTrendingAdmin("draft.savedToastDesc"));
  };

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTimeout(() => {
          if (window.confirm(tTrendingAdmin("draft.restoreConfirm"))) {
            if (data.form)
              setForm((prev: any) => {
                const next = { ...prev, ...data.form };
                const rawCategory = String(next.category || "");
                if (rawCategory) {
                  next.category = CATEGORY_ID_MAP[rawCategory] || rawCategory;
                }
                return next;
              });
            if (data.outcomes) setOutcomes(data.outcomes);
            if (data.ts) setLastSaved(new Date(data.ts));
            toast.success(
              tTrendingAdmin("draft.restoredToastTitle"),
              tTrendingAdmin("draft.restoredToastDesc")
            );
          }
        }, 100);
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, [setForm, setOutcomes, tTrendingAdmin]);

  useEffect(() => {
    if (!form.title && !form.description && outcomes.length === 2 && outcomes[0].label === "Yes") {
      return;
    }

    const timer = setTimeout(() => {
      const payload = { form, outcomes, ts: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setLastSaved(new Date());
    }, 1000);
    return () => clearTimeout(timer);
  }, [form, outcomes]);

  const clearDraft = () => {
    if (!window.confirm(tTrendingAdmin("draft.clearConfirm"))) return;
    localStorage.removeItem(DRAFT_KEY);
    setForm({
      title: "",
      description: "",
      category: "tech",
      deadline: "",
      minStake: 1,
      criteria: "",
      type: "binary",
    });
    setOutcomes([{ label: "Yes" }, { label: "No" }]);
    setLastSaved(null);
    setMsg(tTrendingAdmin("draft.clearedMsg"));
  };

  return {
    lastSaved,
    msg,
    setMsg,
    manualSaveDraft,
    clearDraft,
  };
}

export default function AdminCreatePredictionPage() {
  const router = useRouter();
  const { account, siweLogin } = useWallet();
  const profileCtx = useUserProfileOptional();
  const { data: categoriesData } = useCategories();
  const tTrending = useTranslations("trending");
  const tTrendingAdmin = useTranslations("trending.admin");
  const tCommon = useTranslations("common");
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    category: "tech",
    deadline: "",
    minStake: 1,
    criteria: "",
    type: "binary",
  });
  const [outcomes, setOutcomes] = useState<Outcome[]>([{ label: "Yes" }, { label: "No" }]);
  const [submitting, setSubmitting] = useState(false);
  const [showDraftMenu, setShowDraftMenu] = useState(false);
  const { lastSaved, msg, setMsg, manualSaveDraft, clearDraft } = usePredictionDraft(
    form,
    setForm,
    outcomes,
    setOutcomes,
    tTrendingAdmin
  );

  const setField = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const { onAddOutcome, onDelOutcome, onOutcomeChange } = usePredictionOutcomes(setOutcomes);

  const submit = async () => {
    try {
      setSubmitting(true);
      setMsg(null);
      if (!account) {
        setMsg(tCommon("connectWallet"));
        return;
      }
      try {
        await siweLogin();
      } catch {}
      const categoryId = String(form.category || "");
      const categoryName = CATEGORY_NAME_MAP[categoryId] || categoryId;
      const payload: any = {
        title: form.title,
        description: form.description,
        category: categoryName,
        deadline: form.deadline,
        minStake: Number(form.minStake),
        criteria: form.criteria,
        type: form.type,
        walletAddress: String(account).toLowerCase(),
      };
      if (form.type === "multi") payload.outcomes = outcomes.map((o) => ({ ...o }));
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) {
        setMsg(String(j?.message || tTrendingAdmin("createFailed")));
        return;
      }
      setMsg(tTrendingAdmin("createSuccess"));
      const id = Number(j?.data?.id);
      if (Number.isFinite(id)) router.push(`/prediction/${id}`);
    } catch (e: any) {
      setMsg(String(e?.message || e || tTrendingAdmin("createFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!account) return;
    if (!profileCtx?.isAdmin) router.replace("/trending");
  }, [account, profileCtx?.isAdmin, router]);

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-violet-50 via-purple-50/20 to-fuchsia-50/30">
      {/* Paper Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] z-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-soft flex items-center justify-center text-brand border border-white/50 rotate-[-3deg]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-[10px] font-black text-brand uppercase tracking-widest">
                {tTrendingAdmin("page.badge")}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                {tTrending("actions.createPrediction")}
              </h1>
              {/* 3. 状态反馈 */}
              {lastSaved && (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white/50 px-3 py-1.5 rounded-full border border-white shadow-sm animate-in fade-in duration-500">
                  <Save className="w-3.5 h-3.5 text-brand" />
                  <span>
                    {tTrendingAdmin("draft.autoSavedPrefix")} {lastSaved.toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
            <p className="text-slate-500 mt-2 font-bold max-w-md leading-relaxed">
              {tTrendingAdmin("page.description")}
            </p>
          </div>
          <Button
            variant="subtle"
            onClick={() => router.push("/trending")}
            className="rounded-2xl shadow-soft"
          >
            {tTrendingAdmin("page.backToList")}
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <Card padding="lg" hover={false} className="space-y-12">
            {/* Section 1: Basic Info */}
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
                  <Layout className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">基本信息</h3>
                  <p className="text-xs font-bold text-slate-400">设置事件的核心识别参数</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    <Type className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldTitle")}
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    className="input-base !bg-white/60 font-bold text-lg"
                    placeholder={tTrendingAdmin("fieldTitlePlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldCategory")}
                  </label>
                  <div className="relative">
                    <select
                      value={form.category}
                      onChange={(e) => setField("category", e.target.value)}
                      className="input-base !bg-white/60 font-bold appearance-none cursor-pointer"
                    >
                      {Array.isArray(categoriesData) && categoriesData.length > 0 ? (
                        (categoriesData as any[]).map((item) => {
                          const name = String((item as any).name || "").trim();
                          if (!name) {
                            return null;
                          }
                          const id = CATEGORY_ID_MAP[name] || name;
                          const labelKey = String(id || "");
                          const label =
                            labelKey && labelKey !== name
                              ? tTrending(`category.${labelKey}`)
                              : name;
                          return (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          );
                        })
                      ) : (
                        <>
                          <option value="tech">{tTrending("category.tech")}</option>
                          <option value="entertainment">
                            {tTrending("category.entertainment")}
                          </option>
                          <option value="politics">{tTrending("category.politics")}</option>
                          <option value="weather">{tTrending("category.weather")}</option>
                          <option value="sports">{tTrending("category.sports")}</option>
                          <option value="business">{tTrending("category.business")}</option>
                          <option value="crypto">{tTrending("category.crypto")}</option>
                          <option value="more">{tTrending("category.more")}</option>
                        </>
                      )}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <DatePicker
                    label={tTrendingAdmin("fieldDeadline")}
                    value={form.deadline}
                    onChange={(val) => setField("deadline", val)}
                    includeTime={true}
                    placeholder={tTrendingAdmin("deadlinePlaceholder")}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldMinStakeLabel")}
                  </label>
                  <input
                    type="number"
                    value={form.minStake}
                    onChange={(e) => setField("minStake", e.target.value)}
                    className="input-base !bg-white/60 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Details */}
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
                  <AlignLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    {tTrendingAdmin("section.detailsTitle")}
                  </h3>
                  <p className="text-xs font-bold text-slate-400">
                    {tTrendingAdmin("section.detailsSubtitle")}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
                    {tTrendingAdmin("fieldDescription")}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    className="input-base !bg-white/60 min-h-[120px] resize-none leading-relaxed font-medium"
                    placeholder={tTrendingAdmin("fieldDescriptionPlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5" /> {tTrendingAdmin("fieldCriteria")}
                  </label>
                  <input
                    value={form.criteria}
                    onChange={(e) => setField("criteria", e.target.value)}
                    className="input-base !bg-white/60 font-bold"
                    placeholder={tTrendingAdmin("fieldCriteriaPlaceholder")}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Type & Outcomes */}
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    {tTrendingAdmin("section.typeTitle")}
                  </h3>
                  <p className="text-xs font-bold text-slate-400">
                    {tTrendingAdmin("section.typeSubtitle")}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-2 p-1.5 bg-slate-100/50 rounded-2xl w-fit border border-slate-200/60">
                  <button
                    onClick={() => setField("type", "binary")}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                      form.type === "binary"
                        ? "bg-white text-brand shadow-soft border border-white"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tTrendingAdmin("type.binary")}
                  </button>
                  <button
                    onClick={() => setField("type", "multi")}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                      form.type === "multi"
                        ? "bg-white text-brand shadow-soft border border-white"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tTrendingAdmin("type.multi")}
                  </button>
                </div>

                {form.type === "multi" && (
                  <div className="bg-slate-50/50 rounded-[2rem] p-8 border border-slate-200/60 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-black text-slate-800">
                        {tTrendingAdmin("multi.optionsTitle")}
                      </div>
                      <button
                        type="button"
                        onClick={onAddOutcome}
                        className="px-4 py-2 bg-brand/10 text-brand font-black rounded-xl text-[10px] uppercase tracking-wider hover:bg-brand/20 transition-all flex items-center gap-2 border border-brand/10"
                      >
                        <Plus className="w-3.5 h-3.5" /> {tTrendingAdmin("multi.addOption")}
                      </button>
                    </div>

                    <div className="space-y-4">
                      {outcomes.map((o, i) => (
                        <div
                          key={i}
                          className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white shadow-soft flex flex-col gap-4 group hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">
                              {i + 1}
                            </div>
                            <input
                              value={o.label}
                              onChange={(e) => onOutcomeChange(i, "label", e.target.value)}
                              placeholder="选项名称 (如: 会, 不会)"
                              className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 font-black placeholder:text-slate-300 p-0 text-lg"
                            />
                            <button
                              type="button"
                              onClick={() => onDelOutcome(i)}
                              className="p-2 rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-3 bg-white/50 rounded-xl px-4 py-3 border border-slate-100 focus-within:border-brand/30 transition-all shadow-inner">
                              <AlignLeft className="w-4 h-4 text-slate-400" />
                              <input
                                value={o.description || ""}
                                onChange={(e) => onOutcomeChange(i, "description", e.target.value)}
                                placeholder={tTrendingAdmin("multi.optionDescriptionPlaceholder")}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-600 p-0 placeholder:text-slate-400 font-medium"
                              />
                            </div>
                            <div className="flex items-center gap-3 bg-white/50 rounded-xl px-4 py-3 border border-slate-100 focus-within:border-brand/30 transition-all shadow-inner">
                              <Palette className="w-4 h-4 text-slate-400" />
                              <input
                                value={o.color || ""}
                                onChange={(e) => onOutcomeChange(i, "color", e.target.value)}
                                placeholder="Hex 颜色"
                                className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-600 p-0 placeholder:text-slate-400 font-mono"
                              />
                              {o.color && (
                                <div
                                  className="w-4 h-4 rounded-full border border-white shadow-sm"
                                  style={{ backgroundColor: o.color }}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-3 bg-white/50 rounded-xl px-4 py-3 border border-slate-100 focus-within:border-brand/30 transition-all shadow-inner">
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                              <input
                                value={o.image_url || ""}
                                onChange={(e) => onOutcomeChange(i, "image_url", e.target.value)}
                                placeholder={tTrendingAdmin("multi.optionImagePlaceholder")}
                                className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-600 p-0 placeholder:text-slate-400 font-medium"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-10 border-t border-dashed border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col gap-2 relative">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-400 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>{tTrendingAdmin("page.immutableWarning")}</span>
                </div>

                {msg && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black w-fit ${
                      msg.includes("成功") || msg.includes("保存")
                        ? "text-emerald-600 bg-emerald-50"
                        : "text-red-600 bg-red-50"
                    }`}
                  >
                    {msg}
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                {/* Draft Actions */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDraftMenu(!showDraftMenu)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-brand transition-colors px-3 py-2 rounded-lg hover:bg-brand/5 border border-transparent hover:border-brand/10"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {tTrendingAdmin("draft.menuLabel")}
                    <ChevronUp
                      className={`w-3.5 h-3.5 transition-transform ${showDraftMenu ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showDraftMenu && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                      <div className="text-[10px] font-black text-slate-400 px-2 py-1 uppercase tracking-wider mb-1">
                        {tTrendingAdmin("draft.menuTitle")}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          manualSaveDraft();
                          setShowDraftMenu(false);
                        }}
                        className="w-full flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-brand px-2 py-2 rounded-lg hover:bg-brand/5 transition-colors text-left"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {tTrendingAdmin("draft.saveCurrent")}
                      </button>

                      {lastSaved && (
                        <button
                          type="button"
                          onClick={() => {
                            clearDraft();
                            setShowDraftMenu(false);
                          }}
                          className="w-full flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-red-500 px-2 py-2 rounded-lg hover:bg-red-50 transition-colors text-left mt-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {tTrendingAdmin("draft.reset")}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  disabled={submitting}
                  onClick={submit}
                  variant="primary"
                  className="w-full md:w-64 h-14 rounded-2xl shadow-brand/20 text-lg"
                >
                  {submitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      {tTrendingAdmin("page.submit")} <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
