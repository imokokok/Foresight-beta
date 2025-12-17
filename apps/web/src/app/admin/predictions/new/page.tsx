"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import DatePicker from "@/components/ui/DatePicker";
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
  Scale
} from "lucide-react";

export default function AdminCreatePredictionPage() {
  const router = useRouter();
  const { account, siweLogin } = useWallet();
  const profileCtx = useUserProfileOptional();
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    category: "科技",
    deadline: "",
    minStake: 1,
    criteria: "",
    type: "binary",
  });
  const [outcomes, setOutcomes] = useState<Array<{ label: string; description?: string; color?: string; image_url?: string }>>([
    { label: "Yes" },
    { label: "No" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setField = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const onAddOutcome = () => setOutcomes((p) => [...p, { label: `选项${p.length}` }]);
  const onDelOutcome = (i: number) => setOutcomes((p) => p.filter((_, idx) => idx !== i));
  const onOutcomeChange = (i: number, k: string, v: any) => setOutcomes((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const submit = async () => {
    try {
      setSubmitting(true);
      setMsg(null);
      if (!account) { setMsg("请先连接钱包"); return }
      try { await siweLogin() } catch {}
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
    <div className="min-h-screen relative overflow-hidden bg-gray-50/50">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-pink-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                <Sparkles className="w-6 h-6" />
              </span>
              创建预测事件
            </h1>
            <p className="text-gray-500 mt-2 font-medium ml-1">
              配置事件详情、规则与选项，发布新的预测市场
            </p>
          </div>
          <button 
            onClick={() => router.push('/trending')} 
            className="px-6 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            返回列表
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-purple-500/5 border border-white/60 p-8 md:p-10 space-y-10"
        >
          {/* Section 1: Basic Info */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">
              <Layout className="w-5 h-5 text-purple-500" />
              基本信息
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                  <Type className="w-4 h-4 text-gray-400" /> 标题
                </label>
                <input 
                  value={form.title} 
                  onChange={(e) => setField("title", e.target.value)} 
                  className="w-full rounded-2xl border border-gray-200 bg-white/50 px-5 py-4 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 font-bold text-gray-900" 
                  placeholder="例如：2025年比特币价格是否会突破15万美元？" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gray-400" /> 分类
                </label>
                <div className="relative">
                  <select 
                    value={form.category} 
                    onChange={(e) => setField("category", e.target.value)} 
                    className="w-full rounded-2xl border border-gray-200 bg-white/50 px-5 py-4 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all text-gray-900 font-medium appearance-none cursor-pointer"
                  >
                    <option value="科技">科技 Technology</option>
                    <option value="娱乐">娱乐 Entertainment</option>
                    <option value="时政">时政 Politics</option>
                    <option value="天气">天气 Weather</option>
                    <option value="体育">体育 Sports</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <Layout className="w-4 h-4" />
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
                <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-gray-400" /> 最小押注 (USDC)
                </label>
                <input 
                  type="number" 
                  value={form.minStake} 
                  onChange={(e) => setField("minStake", e.target.value)} 
                  className="w-full rounded-2xl border border-gray-200 bg-white/50 px-5 py-4 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all font-mono font-medium text-gray-900" 
                />
              </div>
            </div>
          </div>

          {/* Section 2: Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">
              <AlignLeft className="w-5 h-5 text-purple-500" />
              详细规则
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1">事件描述</label>
              <textarea 
                value={form.description} 
                onChange={(e) => setField("description", e.target.value)} 
                className="w-full rounded-2xl border border-gray-200 bg-white/50 px-5 py-4 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 text-gray-900 min-h-[120px] resize-none leading-relaxed" 
                placeholder="请详细描述预测事件的背景、范围以及其他重要信息..." 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                <Scale className="w-4 h-4 text-gray-400" /> 判定标准
              </label>
              <input 
                value={form.criteria} 
                onChange={(e) => setField("criteria", e.target.value)} 
                className="w-full rounded-2xl border border-gray-200 bg-white/50 px-5 py-4 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 text-gray-900" 
                placeholder="例如：以 CoinMarketCap 在截止时刻的收盘价格为准" 
              />
            </div>
          </div>

          {/* Section 3: Type & Outcomes */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">
              <Settings2 className="w-5 h-5 text-purple-500" />
              预测类型与选项
            </div>

            <div className="flex gap-4 p-1 bg-gray-100 rounded-2xl w-fit">
              <button 
                onClick={() => setField('type', 'binary')} 
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  form.type==='binary'
                    ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                二元预测 (Binary)
              </button>
              <button 
                onClick={() => setField('type', 'multi')} 
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  form.type==='multi'
                    ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                多元预测 (Multi)
              </button>
            </div>

            {form.type === "multi" && (
              <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-gray-700">选项配置</div>
                  <button 
                    type="button" 
                    onClick={onAddOutcome} 
                    className="px-4 py-2 bg-purple-100 text-purple-700 font-bold rounded-xl text-xs hover:bg-purple-200 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> 添加选项
                  </button>
                </div>
                
                <div className="space-y-3">
                  {outcomes.map((o, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col gap-3 group hover:border-purple-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <input 
                          value={o.label} 
                          onChange={(e) => onOutcomeChange(i, "label", e.target.value)} 
                          placeholder="选项名称 (Label)" 
                          className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 font-bold placeholder:text-gray-300 p-0" 
                        />
                        <button 
                          type="button" 
                          onClick={() => onDelOutcome(i)} 
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 focus-within:border-purple-200 focus-within:bg-white transition-colors">
                          <AlignLeft className="w-3.5 h-3.5 text-gray-400" />
                          <input 
                            value={o.description || ""} 
                            onChange={(e) => onOutcomeChange(i, "description", e.target.value)} 
                            placeholder="描述 (选填)" 
                            className="w-full bg-transparent border-none focus:ring-0 text-xs text-gray-700 p-0 placeholder:text-gray-400" 
                          />
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 focus-within:border-purple-200 focus-within:bg-white transition-colors">
                          <Palette className="w-3.5 h-3.5 text-gray-400" />
                          <input 
                            value={o.color || ""} 
                            onChange={(e) => onOutcomeChange(i, "color", e.target.value)} 
                            placeholder="颜色 Hex (选填)" 
                            className="w-full bg-transparent border-none focus:ring-0 text-xs text-gray-700 p-0 placeholder:text-gray-400" 
                          />
                          {o.color && <div className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: o.color }} />}
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 focus-within:border-purple-200 focus-within:bg-white transition-colors">
                          <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                          <input 
                            value={o.image_url || ""} 
                            onChange={(e) => onOutcomeChange(i, "image_url", e.target.value)} 
                            placeholder="图片 URL (选填)" 
                            className="w-full bg-transparent border-none focus:ring-0 text-xs text-gray-700 p-0 placeholder:text-gray-400" 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
             <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span>提交后部分信息将不可修改</span>
             </div>
             
             <button 
                disabled={submitting} 
                onClick={submit} 
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-lg shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:transform-none transition-all flex items-center gap-2"
             >
                {submitting ? (
                  <>正在创建...</>
                ) : (
                  <>
                    立即创建 <ArrowRight className="w-5 h-5" />
                  </>
                )}
             </button>
          </div>
          
          {msg && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl text-sm font-bold text-center ${
                msg.includes("成功") 
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : "bg-red-50 text-red-600 border border-red-100"
              }`}
            >
              {msg}
            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  );
}
