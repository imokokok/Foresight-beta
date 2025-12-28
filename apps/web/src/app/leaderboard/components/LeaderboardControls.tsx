"use client";

import { Flame, Target, Trophy } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export type LeaderboardControlsProps = {
  timeRange: string;
  category: string;
  onTimeRangeChange: (id: string) => void;
  onCategoryChange: (id: string) => void;
};

export function LeaderboardControls({
  timeRange,
  category,
  onTimeRangeChange,
  onCategoryChange,
}: LeaderboardControlsProps) {
  const t = useTranslations("leaderboard");

  const timeRangeOptions = [
    { id: "weekly", labelKey: "timeRange.weekly" },
    { id: "monthly", labelKey: "timeRange.monthly" },
    { id: "all", labelKey: "timeRange.all" },
  ];

  const categoryOptions = [
    { id: "profit", labelKey: "category.profit", icon: Trophy },
    { id: "winrate", labelKey: "category.winrate", icon: Target },
    { id: "streak", labelKey: "category.streak", icon: Flame },
  ];

  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-16 bg-white/70 backdrop-blur-2xl p-2 rounded-[2rem] border border-white/60 shadow-lg shadow-purple-500/5 max-w-4xl mx-auto">
      <div className="flex bg-gray-100/50 p-1 rounded-[1.5rem]">
        {timeRangeOptions.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTimeRangeChange(tab.id)}
            className={`
                  relative px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300
                  ${
                    timeRange === tab.id
                      ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20"
                      : "text-gray-500 hover:text-gray-800 hover:bg-white/50"
                  }
                `}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar px-2">
        {categoryOptions.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`
                  px-4 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center gap-2 border
                  ${
                    category === cat.id
                      ? "bg-white text-purple-700 border-purple-100 shadow-md shadow-purple-500/5 ring-1 ring-purple-100"
                      : "bg-transparent text-gray-500 border-transparent hover:bg-white/40"
                  }
                `}
          >
            <cat.icon
              className={`w-4 h-4 ${category === cat.id ? "text-fuchsia-500" : "text-gray-400"}`}
            />
            {t(cat.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
