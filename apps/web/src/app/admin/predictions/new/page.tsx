"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useCategories } from "@/hooks/useQueries";

export default function AdminCreatePredictionPage() {
  const router = useRouter();
  const { account, siweLogin } = useWallet();
  const profileCtx = useUserProfileOptional();
  const { data: categoriesData } = useCategories();
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    category: "科技",
    deadline: "",
    minStake: 1,
    criteria: "",
    type: "binary",
  });
  const [outcomes, setOutcomes] = useState<
    Array<{ label: string; description?: string; color?: string; image_url?: string }>
  >([{ label: "Yes" }, { label: "No" }]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setField = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const onAddOutcome = () => setOutcomes((p) => [...p, { label: `选项${p.length}` }]);
  const onDelOutcome = (i: number) => setOutcomes((p) => p.filter((_, idx) => idx !== i));
  const onOutcomeChange = (i: number, k: string, v: any) =>
    setOutcomes((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const submit = async () => {
    try {
      setSubmitting(true);
      setMsg(null);
      if (!account) {
        setMsg("请先连接钱包");
        return;
      }
      try {
        await siweLogin();
      } catch {}
      const payload: any = {
        title: form.title,
        description: form.description,
        category: form.category,
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
        setMsg(String(j?.message || "创建失败"));
        return;
      }
      setMsg("创建成功");
      const id = Number(j?.data?.id);
      if (Number.isFinite(id)) router.push(`/prediction/${id}`);
    } catch (e: any) {
      setMsg(String(e?.message || e || "创建失败"));
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
                Admin Console
              </div>
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight">创建预测事件</h1>
            <p className="text-slate-500 mt-2 font-bold max-w-md leading-relaxed">
              在这里配置全球预测市场的核心数据。请确保规则描述准确且无歧义。
            </p>
          </div>
          <Button
            variant="subtle"
            onClick={() => router.push("/trending")}
            className="rounded-2xl shadow-soft"
          >
            返回列表
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
                    <Type className="w-3.5 h-3.5" /> 预测标题
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    className="input-base !bg-white/60 font-bold text-lg"
                    placeholder="例如：2025年比特币价格是否会突破15万美元？"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> 领域分类
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
                          return (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          );
                        })
                      ) : (
                        <>
                          <option value="科技">科技 Technology</option>
                          <option value="娱乐">娱乐 Entertainment</option>
                          <option value="时政">时政 Politics</option>
                          <option value="天气">天气 Weather</option>
                          <option value="体育">体育 Sports</option>
                          <option value="商业">商业 Business</option>
                          <option value="加密货币">加密货币 Crypto</option>
                          <option value="更多">更多 More</option>
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
                    label="截止时间"
                    value={form.deadline}
                    onChange={(val) => setField("deadline", val)}
                    includeTime={true}
                    placeholder="选择预测截止时间"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5" /> 最小参与金额 (USDC)
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
                  <h3 className="text-lg font-black text-slate-800">详细规则</h3>
                  <p className="text-xs font-bold text-slate-400">描述预测背景与判定准则</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">
                    事件背景描述
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    className="input-base !bg-white/60 min-h-[120px] resize-none leading-relaxed font-medium"
                    placeholder="请详细描述预测事件的背景、范围以及其他重要信息..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5" /> 判定标准 (Oracle Criteria)
                  </label>
                  <input
                    value={form.criteria}
                    onChange={(e) => setField("criteria", e.target.value)}
                    className="input-base !bg-white/60 font-bold"
                    placeholder="例如：以 CoinMarketCap 在截止时刻的收盘价格为准"
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
                  <h3 className="text-lg font-black text-slate-800">预测类型与选项</h3>
                  <p className="text-xs font-bold text-slate-400">配置用户可以选择的预测结果</p>
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
                    二元预测 (Binary)
                  </button>
                  <button
                    onClick={() => setField("type", "multi")}
                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                      form.type === "multi"
                        ? "bg-white text-brand shadow-soft border border-white"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    多元预测 (Multi)
                  </button>
                </div>

                {form.type === "multi" && (
                  <div className="bg-slate-50/50 rounded-[2rem] p-8 border border-slate-200/60 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-black text-slate-800">选项列表管理</div>
                      <button
                        type="button"
                        onClick={onAddOutcome}
                        className="px-4 py-2 bg-brand/10 text-brand font-black rounded-xl text-[10px] uppercase tracking-wider hover:bg-brand/20 transition-all flex items-center gap-2 border border-brand/10"
                      >
                        <Plus className="w-3.5 h-3.5" /> 添加选项
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
                                placeholder="补充描述"
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
                                placeholder="图片链接"
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
              <div className="flex items-center gap-3 text-xs font-bold text-slate-400 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>重要：发布后部分关键信息（如标题、截止日期）将无法修改。</span>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                {msg && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`px-4 py-2 rounded-xl text-xs font-black ${
                      msg.includes("成功")
                        ? "text-emerald-600 bg-emerald-50"
                        : "text-red-600 bg-red-50"
                    }`}
                  >
                    {msg}
                  </motion.div>
                )}
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
                      立即创建 <ArrowRight className="w-5 h-5 ml-2" />
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
