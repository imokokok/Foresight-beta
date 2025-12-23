import { Activity, Globe } from "lucide-react";

export const ALLOWED_CATEGORIES = [
  "体育",
  "娱乐",
  "时政",
  "天气",
  "科技",
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
    chip: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200",
    chipActive:
      "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-200 shadow-md border-transparent",
    badge: "bg-orange-200 text-orange-800",
    border: "border-orange-200 hover:border-orange-300",
    softBg: "bg-gradient-to-br from-orange-100/60 to-white/0",
    accentText: "text-orange-600",
    activeCard: "bg-white/80 border-orange-200 shadow-md shadow-orange-100/50 scale-[1.02]",
    accentBar: "bg-orange-500",
    chatGradient: "from-orange-200/70 via-amber-100/60 to-white/0",
    headerGradient: "from-orange-500/90 to-amber-600/90",
    frameSurfaceGradient: "from-orange-100/70 via-amber-100/60 to-white/0",
  },
  娱乐: {
    chip: "bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200",
    chipActive:
      "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-200 shadow-md border-transparent",
    badge: "bg-pink-200 text-pink-800",
    border: "border-pink-200 hover:border-pink-300",
    softBg: "bg-gradient-to-br from-pink-100/60 to-white/0",
    accentText: "text-pink-600",
    activeCard: "bg-white/80 border-pink-200 shadow-md shadow-pink-100/50 scale-[1.02]",
    accentBar: "bg-pink-500",
    chatGradient: "from-pink-200/70 via-rose-100/60 to-white/0",
    headerGradient: "from-pink-500/90 to-rose-600/90",
    frameSurfaceGradient: "from-pink-100/70 via-rose-100/60 to-white/0",
  },
  时政: {
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200",
    chipActive:
      "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-200 shadow-md border-transparent",
    badge: "bg-emerald-200 text-emerald-800",
    border: "border-emerald-200 hover:border-emerald-300",
    softBg: "bg-gradient-to-br from-emerald-100/60 to-white/0",
    accentText: "text-emerald-600",
    activeCard: "bg-white/80 border-emerald-200 shadow-md shadow-emerald-100/50 scale-[1.02]",
    accentBar: "bg-emerald-500",
    chatGradient: "from-emerald-200/70 via-teal-100/60 to-white/0",
    headerGradient: "from-emerald-500/90 to-teal-600/90",
    frameSurfaceGradient: "from-emerald-100/70 via-teal-100/60 to-white/0",
  },
  天气: {
    chip: "bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-200",
    chipActive:
      "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-cyan-200 shadow-md border-transparent",
    badge: "bg-cyan-200 text-cyan-800",
    border: "border-cyan-200 hover:border-cyan-300",
    softBg: "bg-gradient-to-br from-cyan-100/60 to-white/0",
    accentText: "text-cyan-600",
    activeCard: "bg-white/80 border-cyan-200 shadow-md shadow-cyan-100/50 scale-[1.02]",
    accentBar: "bg-cyan-500",
    chatGradient: "from-cyan-200/70 via-blue-100/60 to-white/0",
    headerGradient: "from-cyan-500/90 to-blue-600/90",
    frameSurfaceGradient: "from-cyan-100/70 via-blue-100/60 to-white/0",
  },
  科技: {
    chip: "bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200",
    chipActive:
      "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-violet-200 shadow-md border-transparent",
    badge: "bg-violet-200 text-violet-800",
    border: "border-violet-200 hover:border-violet-300",
    softBg: "bg-gradient-to-br from-violet-100/60 to-white/0",
    accentText: "text-violet-600",
    activeCard: "bg-white/80 border-violet-200 shadow-md shadow-violet-100/50 scale-[1.02]",
    accentBar: "bg-violet-500",
    chatGradient: "from-violet-200/70 via-purple-100/60 to-white/0",
    headerGradient: "from-violet-500/90 to-purple-600/90",
    frameSurfaceGradient: "from-violet-100/70 via-purple-100/60 to-white/0",
  },
  更多: {
    chip: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200",
    chipActive:
      "bg-gradient-to-r from-gray-500 to-slate-500 text-white shadow-gray-200 shadow-md border-transparent",
    badge: "bg-gray-200 text-gray-800",
    border: "border-gray-200 hover:border-gray-300",
    softBg: "bg-gradient-to-br from-gray-100/60 to-white/0",
    accentText: "text-gray-600",
    activeCard: "bg-white/80 border-gray-200 shadow-md shadow-gray-100/50 scale-[1.02]",
    accentBar: "bg-gray-500",
    chatGradient: "from-gray-200/70 via-slate-100/60 to-white/0",
    headerGradient: "from-gray-500/90 to-slate-600/90",
    frameSurfaceGradient: "from-gray-100/70 via-slate-100/60 to-white/0",
  },
  default: {
    chip: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
    chipActive:
      "bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-slate-200 shadow-md border-transparent",
    badge: "bg-gray-200 text-gray-800",
    border: "border-slate-200 hover:border-slate-300",
    softBg: "bg-gradient-to-br from-slate-100/60 to-white/0",
    accentText: "text-slate-600",
    activeCard: "bg-white/80 border-indigo-200 shadow-md shadow-indigo-100/50 scale-[1.02]",
    accentBar: "bg-indigo-500",
    chatGradient: "from-indigo-200/70 via-purple-100/60 to-white/0",
    headerGradient: "from-indigo-500/90 to-purple-600/90",
    frameSurfaceGradient: "from-indigo-100/70 via-purple-100/60 to-white/0",
  },
};

export function getCategoryStyle(cat: string): CategoryStyle {
  return CATEGORY_STYLES[cat] || CATEGORY_STYLES.default;
}
