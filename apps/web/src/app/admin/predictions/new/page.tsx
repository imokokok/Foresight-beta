"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";

export default function AdminCreatePredictionPage() {
  const router = useRouter();
  const { account, siweLogin } = useWallet();
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
    const check = async () => {
      try {
        if (!account) return
        const r = await fetch(`/api/user-profiles?address=${String(account).toLowerCase()}`, { cache: 'no-store' })
        const j = await r.json().catch(() => ({}))
        if (!j?.profile?.is_admin) router.replace('/trending')
      } catch {}
    }
    check()
  }, [account, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-3xl font-bold text-gray-900">管理员 · 创建预测事件</div>
            <div className="text-sm text-gray-700 mt-1">支持 binary 与 multi，多元事件可自定义选项</div>
          </div>
          <button onClick={() => router.push('/trending')} className="px-4 py-2 rounded-full bg-gray-900 text-white">返回 Trending</button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-300 p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-800 mb-1">标题</div>
              <input value={form.title} onChange={(e) => setField("title", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 placeholder:text-gray-500 text-gray-900" placeholder="例如：美联储下次议息利率变动幅度" />
            </div>
            <div>
              <div className="text-sm text-gray-800 mb-1">分类</div>
              <input value={form.category} onChange={(e) => setField("category", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 placeholder:text-gray-500 text-gray-900" placeholder="科技/娱乐/时政/天气" />
            </div>
            <div>
              <div className="text-sm text-gray-800 mb-1">截止时间</div>
              <input type="datetime-local" value={form.deadline} onChange={(e) => setField("deadline", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 text-gray-900" />
            </div>
            <div>
              <div className="text-sm text-gray-800 mb-1">最小押注</div>
              <input type="number" value={form.minStake} onChange={(e) => setField("minStake", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 text-gray-900" />
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-800 mb-1">类型</div>
            <div className="flex gap-3">
              <button onClick={() => setField('type', 'binary')} className={`px-4 py-2 rounded-full border ${form.type==='binary'?'bg-purple-600 text-white border-purple-600':'bg-gray-100 text-gray-900 border-gray-300'}`}>binary</button>
              <button onClick={() => setField('type', 'multi')} className={`px-4 py-2 rounded-full border ${form.type==='multi'?'bg-purple-600 text-white border-purple-600':'bg-gray-100 text-gray-900 border-gray-300'}`}>multi</button>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-800 mb-1">描述</div>
            <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 placeholder:text-gray-500 text-gray-900" rows={4} placeholder="简要说明范围、来源与判定方式" />
          </div>

          <div>
            <div className="text-sm text-gray-800 mb-1">判定标准</div>
            <input value={form.criteria} onChange={(e) => setField("criteria", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-purple-600 focus:border-purple-600 placeholder:text-gray-500 text-gray-900" placeholder="例如：以官方公告或权威媒体报道为准" />
          </div>

          {form.type === "multi" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-800">选项</div>
                <button type="button" onClick={onAddOutcome} className="px-3 py-2 bg-purple-600 text-white rounded-xl">添加选项</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {outcomes.map((o, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-gray-200 text-gray-900 text-sm">{o.label || `选项${i}`}</span>
                ))}
              </div>
              <div className="space-y-2">
                {outcomes.map((o, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <span className="text-xs col-span-1">#{i}</span>
                    <input value={o.label} onChange={(e) => onOutcomeChange(i, "label", e.target.value)} placeholder="label" className="border rounded-xl px-3 py-2 col-span-3 placeholder:text-gray-500 text-gray-900" />
                    <input value={o.description || ""} onChange={(e) => onOutcomeChange(i, "description", e.target.value)} placeholder="description" className="border rounded-xl px-3 py-2 col-span-4 placeholder:text-gray-500 text-gray-900" />
                    <input value={o.color || ""} onChange={(e) => onOutcomeChange(i, "color", e.target.value)} placeholder="color" className="border rounded-xl px-3 py-2 col-span-2 placeholder:text-gray-500 text-gray-900" />
                    <input value={o.image_url || ""} onChange={(e) => onOutcomeChange(i, "image_url", e.target.value)} placeholder="image url" className="border rounded-xl px-3 py-2 col-span-2 placeholder:text-gray-500 text-gray-900" />
                    <button type="button" onClick={() => onDelOutcome(i)} className="px-2 py-2 bg-gray-200 text-gray-900 rounded-xl col-span-1">删除</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-gray-800">提交前请确认标题与选项</div>
            <button disabled={submitting} onClick={submit} className="px-5 py-3 rounded-xl bg-purple-600 text-white disabled:opacity-50">{submitting ? "提交中" : "创建"}</button>
          </div>
          {msg && <div className="text-sm text-gray-800">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
