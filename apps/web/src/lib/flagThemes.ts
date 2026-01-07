import {
  Camera,
  Clock,
  Droplet,
  Flag,
  Home,
  Ban,
  BookOpen,
  Brain,
  Moon,
  Sun,
  Zap,
} from "lucide-react";

type FlagThemeConfig = {
  icon: any;
  color: string;
  bg: string;
  gradient: string;
  emoji: string;
};

export const THEME_MAP: Record<string, FlagThemeConfig> = {
  early_morning: {
    icon: Clock,
    color: "text-orange-500",
    bg: "bg-orange-50",
    gradient: "from-[#FF8C42] via-[#FFAA5A] to-[#FFD56B]",
    emoji: "🌅",
  },
  drink_water_8: {
    icon: Droplet,
    color: "text-blue-500",
    bg: "bg-blue-50",
    gradient: "from-[#4FACFE] via-[#00F2FE] to-[#70E1F5]",
    emoji: "💧",
  },
  steps_10k: {
    icon: Zap,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    gradient: "from-[#43E97B] via-[#38F9D7] to-[#5EEAD4]",
    emoji: "🏃",
  },
  read_20_pages: {
    icon: BookOpen,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    gradient: "from-[#667EEA] via-[#764BA2] to-[#6B8DFF]",
    emoji: "📖",
  },
  meditate_10m: {
    icon: Brain,
    color: "text-purple-500",
    bg: "bg-purple-50",
    gradient: "from-[#A18CD1] via-[#FBC2EB] to-[#E2D1F9]",
    emoji: "🧘",
  },
  sleep_before_11: {
    icon: Moon,
    color: "text-slate-500",
    bg: "bg-slate-50",
    gradient: "from-[#2C3E50] via-[#4CA1AF] to-[#2C3E50]",
    emoji: "🌙",
  },
  no_sugar_day: {
    icon: Ban,
    color: "text-rose-500",
    bg: "bg-rose-50",
    gradient: "from-[#F093FB] via-[#F5576C] to-[#FF8ED0]",
    emoji: "🍎",
  },
  breakfast_photo: {
    icon: Camera,
    color: "text-amber-500",
    bg: "bg-amber-50",
    gradient: "from-[#F6D365] via-[#FDA085] to-[#F6D365]",
    emoji: "🍳",
  },
  sunlight_20m: {
    icon: Sun,
    color: "text-yellow-500",
    bg: "bg-yellow-50",
    gradient: "from-[#FCEEB5] via-[#FAD0C4] to-[#FFD1FF]",
    emoji: "☀️",
  },
  tidy_room_10m: {
    icon: Home,
    color: "text-teal-500",
    bg: "bg-teal-50",
    gradient: "from-[#13547A] via-[#80D0C7] to-[#13547A]",
    emoji: "🏠",
  },
  default: {
    icon: Flag,
    color: "text-violet-600",
    bg: "bg-violet-50",
    gradient: "from-[#7F56D9] via-[#9E77ED] to-[#6941C6]",
    emoji: "✨",
  },
};
