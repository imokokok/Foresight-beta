export function catCls(cat?: string) {
  const c = String(cat || "").toLowerCase();
  if (c.includes("科技")) return "bg-sky-50 text-sky-700 border-sky-100";
  if (c.includes("体育")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (c.includes("娱乐")) return "bg-pink-50 text-pink-700 border-pink-100";
  if (c.includes("时政") || c.includes("政治"))
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (c.includes("天气")) return "bg-cyan-50 text-cyan-700 border-cyan-100";
  if (c.includes("加密") || c.includes("crypto"))
    return "bg-indigo-50 text-indigo-700 border-indigo-100";
  if (c.includes("生活")) return "bg-rose-50 text-rose-700 border-rose-100";
  if (c.includes("更多")) return "bg-slate-50 text-slate-700 border-slate-100";
  return "bg-slate-50 text-slate-700 border-slate-100";
}

export function getAccentClass(roomCategory?: string) {
  const c = String(roomCategory || "").toLowerCase();
  if (c.includes("体育")) return "text-emerald-600 border-emerald-100";
  if (c.includes("娱乐")) return "text-rose-600 border-rose-100";
  if (c.includes("时政") || c.includes("政治")) return "text-teal-600 border-teal-100";
  if (c.includes("天气")) return "text-sky-600 border-sky-100";
  if (c.includes("科技")) return "text-violet-600 border-violet-100";
  if (c.includes("更多")) return "text-slate-600 border-slate-100";
  return "text-indigo-600 border-indigo-100";
}
