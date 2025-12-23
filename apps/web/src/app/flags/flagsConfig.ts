import {
  Sun,
  BookOpen,
  Zap,
  CloudRain,
  Utensils,
  Moon,
  Footprints,
  Smartphone,
  Trash2,
  Phone,
} from "lucide-react";

export type OfficialTemplate = {
  id: string;
  title: string;
  description: string;
  icon: typeof Sun;
  color: string;
  gradient: string;
  shadow: string;
};

export function buildOfficialTemplates(tFlags: (key: string) => string): OfficialTemplate[] {
  return [
    {
      id: "early_bird",
      title: tFlags("official.templates.early_bird.title"),
      description: tFlags("official.templates.early_bird.description"),
      icon: Sun,
      color: "text-amber-500",
      gradient: "from-amber-100 to-orange-50",
      shadow: "shadow-amber-500/20",
    },
    {
      id: "reading_marathon",
      title: tFlags("official.templates.reading_marathon.title"),
      description: tFlags("official.templates.reading_marathon.description"),
      icon: BookOpen,
      color: "text-blue-500",
      gradient: "from-blue-100 to-cyan-50",
      shadow: "shadow-blue-500/20",
    },
    {
      id: "fitness_pro",
      title: tFlags("official.templates.fitness_pro.title"),
      description: tFlags("official.templates.fitness_pro.description"),
      icon: Zap,
      color: "text-emerald-500",
      gradient: "from-emerald-100 to-green-50",
      shadow: "shadow-emerald-500/20",
    },
    {
      id: "weather_prophet",
      title: tFlags("official.templates.weather_prophet.title"),
      description: tFlags("official.templates.weather_prophet.description"),
      icon: CloudRain,
      color: "text-sky-500",
      gradient: "from-sky-100 to-indigo-50",
      shadow: "shadow-sky-500/20",
    },
    {
      id: "no_takeout",
      title: tFlags("official.templates.no_takeout.title"),
      description: tFlags("official.templates.no_takeout.description"),
      icon: Utensils,
      color: "text-orange-500",
      gradient: "from-orange-100 to-amber-50",
      shadow: "shadow-orange-500/20",
    },
    {
      id: "sleep_early",
      title: tFlags("official.templates.sleep_early.title"),
      description: tFlags("official.templates.sleep_early.description"),
      icon: Moon,
      color: "text-indigo-500",
      gradient: "from-indigo-100 to-violet-50",
      shadow: "shadow-indigo-500/20",
    },
    {
      id: "walk_10k",
      title: tFlags("official.templates.walk_10k.title"),
      description: tFlags("official.templates.walk_10k.description"),
      icon: Footprints,
      color: "text-teal-500",
      gradient: "from-teal-100 to-emerald-50",
      shadow: "shadow-teal-500/20",
    },
    {
      id: "digital_detox",
      title: tFlags("official.templates.digital_detox.title"),
      description: tFlags("official.templates.digital_detox.description"),
      icon: Smartphone,
      color: "text-rose-500",
      gradient: "from-rose-100 to-pink-50",
      shadow: "shadow-rose-500/20",
    },
    {
      id: "declutter",
      title: tFlags("official.templates.declutter.title"),
      description: tFlags("official.templates.declutter.description"),
      icon: Trash2,
      color: "text-slate-500",
      gradient: "from-slate-100 to-gray-50",
      shadow: "shadow-slate-500/20",
    },
    {
      id: "call_parents",
      title: tFlags("official.templates.call_parents.title"),
      description: tFlags("official.templates.call_parents.description"),
      icon: Phone,
      color: "text-pink-500",
      gradient: "from-pink-100 to-rose-50",
      shadow: "shadow-pink-500/20",
    },
  ];
}

export type OfficialTemplateConfig = {
  days: number;
  timesPerDay: number;
  deposit: string;
};

export function defaultConfigFor(tplId: string): Partial<OfficialTemplateConfig> {
  switch (tplId) {
    case "early_bird":
      return {
        days: 7,
        timesPerDay: 1,
        deposit: "10",
      };
    case "reading_marathon":
      return {
        days: 30,
        timesPerDay: 1,
        deposit: "50",
      };
    case "fitness_pro":
      return {
        days: 28,
        timesPerDay: 1,
        deposit: "100",
      };
    case "weather_prophet":
    case "no_takeout":
    case "sleep_early":
    case "walk_10k":
    case "digital_detox":
    case "declutter":
    case "call_parents":
      return {
        days: 1,
        timesPerDay: 1,
        deposit: "5",
      };
    case "no_sugar":
      return {
        days: 14,
        timesPerDay: 1,
        deposit: "20",
      };
    case "coding_streak":
      return {
        days: 30,
        timesPerDay: 1,
        deposit: "50",
      };
    default:
      return {};
  }
}
