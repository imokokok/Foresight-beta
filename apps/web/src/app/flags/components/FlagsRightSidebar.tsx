import React from "react";
import { Sparkles } from "lucide-react";
import type { OfficialTemplate } from "../flagsConfig";

export type FlagsRightSidebarProps = {
  tFlags: (key: string) => string;
  officialTemplates: OfficialTemplate[];
  onTemplateClick: (template: OfficialTemplate) => void;
  onViewAll: () => void;
};

export function FlagsRightSidebar({
  tFlags,
  officialTemplates,
  onTemplateClick,
  onViewAll,
}: FlagsRightSidebarProps) {
  return (
    <div className="hidden 2xl:flex flex-col w-72 shrink-0 gap-6 z-10 h-full overflow-y-auto scrollbar-hide pb-20">
      <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-5 border border-white/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-gray-900">{tFlags("sidebar.trendingTitle")}</h3>
          <button
            onClick={onViewAll}
            className="text-[10px] font-bold text-purple-600 hover:underline"
          >
            {tFlags("sidebar.viewAll")}
          </button>
        </div>
        <div className="space-y-3">
          {officialTemplates.slice(0, 3).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onTemplateClick(tpl)}
              className="group w-full text-left p-3 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer flex gap-3 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tpl.gradient} flex items-center justify-center text-white shadow-sm shrink-0`}
              >
                <tpl.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 truncate group-hover:text-purple-700 transition-colors">
                  {tpl.title}
                </div>
                <div className="text-[10px] text-gray-400 font-medium truncate">
                  {tpl.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="relative z-10">
          <Sparkles className="w-5 h-5 text-yellow-300 mb-3" />
          <p className="text-sm font-bold leading-relaxed opacity-90 mb-4">
            {tFlags("sidebar.quote.text")}
          </p>
          <div className="flex items-center gap-2 text-[10px] font-medium opacity-60">
            <div className="w-1 h-1 rounded-full bg-white" />
            <span>{tFlags("sidebar.quote.label")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
