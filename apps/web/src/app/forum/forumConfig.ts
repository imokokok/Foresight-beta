import { Activity, Globe } from "lucide-react";

export const ALLOWED_CATEGORIES = [
  "科技",
  "娱乐",
  "时政",
  "天气",
  "体育",
  "商业",
  "加密货币",
  "更多",
] as const;

export const CATEGORIES = [{ id: "all", name: "All Topics", icon: Globe }].concat(
  ALLOWED_CATEGORIES.map((c) => ({ id: c, name: c, icon: Activity }))
);

export type CategoryStyle = {
  chip: string;
  chipActive: string;
  badge: string;
  border: string;
  softBg: string;
  accentText: string;
  activeCard: string;
  accentBar: string;
  chatGradient: string;
  headerGradient: string;
  frameSurfaceGradient: string;
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  体育: {
    chip: "bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100",
    chipActive:
      "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-200/80 shadow-md border-transparent",
    badge: "bg-orange-100 text-orange-800",
    border: "border-orange-100 hover:border-orange-200",
    softBg: "bg-gradient-to-br from-orange-50/70 to-white/0",
    accentText: "text-orange-500",
    activeCard: "bg-white/85 border-orange-100 shadow-md shadow-orange-100/60 scale-[1.02]",
    accentBar: "bg-orange-500",
    chatGradient: "from-orange-100/70 via-amber-50/60 to-white/0",
    headerGradient: "from-orange-500/90 to-amber-500/90",
    frameSurfaceGradient: "from-orange-50/70 via-amber-50/60 to-white/0",
  },
  娱乐: {
    chip: "bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100",
    chipActive:
      "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-200/80 shadow-md border-transparent",
    badge: "bg-pink-100 text-pink-800",
    border: "border-pink-100 hover:border-pink-200",
    softBg: "bg-gradient-to-br from-pink-50/70 to-white/0",
    accentText: "text-pink-500",
    activeCard: "bg-white/85 border-pink-100 shadow-md shadow-pink-100/60 scale-[1.02]",
    accentBar: "bg-pink-500",
    chatGradient: "from-pink-100/70 via-rose-50/60 to-white/0",
    headerGradient: "from-pink-500/90 to-rose-500/90",
    frameSurfaceGradient: "from-pink-50/70 via-rose-50/60 to-white/0",
  },
  时政: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100",
    chipActive:
      "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-200/80 shadow-md border-transparent",
    badge: "bg-emerald-100 text-emerald-800",
    border: "border-emerald-100 hover:border-emerald-200",
    softBg: "bg-gradient-to-br from-emerald-50/70 to-white/0",
    accentText: "text-emerald-500",
    activeCard: "bg-white/85 border-emerald-100 shadow-md shadow-emerald-100/60 scale-[1.02]",
    accentBar: "bg-emerald-500",
    chatGradient: "from-emerald-100/70 via-teal-50/60 to-white/0",
    headerGradient: "from-emerald-500/90 to-teal-500/90",
    frameSurfaceGradient: "from-emerald-50/70 via-teal-50/60 to-white/0",
  },
  天气: {
    chip: "bg-cyan-50 text-cyan-700 border-cyan-100 hover:bg-cyan-100",
    chipActive:
      "bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-cyan-200/80 shadow-md border-transparent",
    badge: "bg-cyan-100 text-cyan-800",
    border: "border-cyan-100 hover:border-cyan-200",
    softBg: "bg-gradient-to-br from-cyan-50/70 to-white/0",
    accentText: "text-cyan-500",
    activeCard: "bg-white/85 border-cyan-100 shadow-md shadow-cyan-100/60 scale-[1.02]",
    accentBar: "bg-cyan-500",
    chatGradient: "from-cyan-100/70 via-sky-50/60 to-white/0",
    headerGradient: "from-cyan-500/90 to-sky-500/90",
    frameSurfaceGradient: "from-cyan-50/70 via-sky-50/60 to-white/0",
  },
  科技: {
    chip: "bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100",
    chipActive:
      "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-violet-200/80 shadow-md border-transparent",
    badge: "bg-violet-100 text-violet-800",
    border: "border-violet-100 hover:border-violet-200",
    softBg: "bg-gradient-to-br from-violet-50/70 to-white/0",
    accentText: "text-violet-500",
    activeCard: "bg-white/85 border-violet-100 shadow-md shadow-violet-100/60 scale-[1.02]",
    accentBar: "bg-violet-500",
    chatGradient: "from-violet-100/70 via-purple-50/60 to-white/0",
    headerGradient: "from-violet-500/90 to-purple-500/90",
    frameSurfaceGradient: "from-violet-50/70 via-purple-50/60 to-white/0",
  },
  更多: {
    chip: "bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100",
    chipActive:
      "bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-slate-200/80 shadow-md border-transparent",
    badge: "bg-slate-100 text-slate-800",
    border: "border-slate-100 hover:border-slate-200",
    softBg: "bg-gradient-to-br from-slate-50/70 to-white/0",
    accentText: "text-slate-600",
    activeCard: "bg-white/85 border-slate-100 shadow-md shadow-slate-100/60 scale-[1.02]",
    accentBar: "bg-slate-600",
    chatGradient: "from-slate-100/70 via-slate-50/60 to-white/0",
    headerGradient: "from-slate-600/90 to-slate-800/90",
    frameSurfaceGradient: "from-slate-50/70 via-slate-50/60 to-white/0",
  },
  default: {
    chip: "bg-brand-accent/15 text-brand-accent border-brand-accent/40 hover:bg-brand-accent/25",
    chipActive: "bg-brand-accent/80 text-white border-brand-accent shadow-brand",
    badge: "bg-brand-accent/15 text-brand-accent",
    border: "border-brand-accent/20 hover:border-brand-accent/60",
    softBg: "bg-gradient-to-br from-brand-accent/10 via-white/0 to-white/0",
    accentText: "text-brand-accent",
    activeCard: "bg-white/95 border-brand-accent/30 shadow-brand scale-[1.01]",
    accentBar: "bg-brand-accent",
    chatGradient: "from-brand-accent/30 via-brand-accent/15 to-white",
    headerGradient: "bg-brand-accent/20",
    frameSurfaceGradient: "from-brand-accent/10 via-brand-accent/10 to-white",
  },
};

export function getCategoryStyle(cat: string): CategoryStyle {
  return CATEGORY_STYLES.default;
}
