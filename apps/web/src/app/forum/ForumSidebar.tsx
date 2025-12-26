import React from "react";
import { MessageSquare, Search, Users, TrendingUp } from "lucide-react";
import { normalizeCategory } from "@/features/trending/trendingModel";
import { getCategoryStyle } from "./forumConfig";
import type { ForumCategory, PredictionItem } from "./useForumList";

type ForumSidebarProps = {
  categories: ForumCategory[];
  activeCategory: string;
  setActiveCategory: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filtered: PredictionItem[];
  loading: boolean;
  error: string | null;
  selectedTopicId: number | null;
  setSelectedTopicId: React.Dispatch<React.SetStateAction<number | null>>;
};

export function ForumSidebar({
  categories,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  filtered,
  loading,
  error,
  selectedTopicId,
  setSelectedTopicId,
}: ForumSidebarProps) {
  const allCategory = categories.find((cat) => cat.id === "all");
  const otherCategories = categories.filter((cat) => cat.id !== "all");

  return (
    <div className="w-64 flex-shrink-0 border-r border-white/30 flex flex-col overflow-x-hidden">
      <div className="p-5 border-b border-white/20 bg-white/10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand shadow-lg shadow-indigo-200/50 border border-white/50">
            <MessageSquare size={20} fill="currentColor" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 leading-tight tracking-tight">
              Forum
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1 h-1 rounded-full bg-brand animate-pulse"></div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">
                Community
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 space-y-3">
          {allCategory && (
            <div>
              {(() => {
                const style = getCategoryStyle(allCategory.name);
                const isActive = activeCategory === allCategory.id;
                return (
                  <button
                    key={allCategory.id}
                    onClick={() => setActiveCategory(allCategory.id)}
                    className={`w-full justify-center px-4 py-2 rounded-full text-[11px] font-bold transition-all duration-200 border flex items-center ${
                      isActive ? style.chipActive : style.chip
                    }`}
                  >
                    {allCategory.name}
                  </button>
                );
              })()}
            </div>
          )}

          {otherCategories.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {otherCategories.map((cat) => {
                const style = getCategoryStyle(cat.name);
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 border text-center ${
                      isActive ? style.chipActive : style.chip
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-black/5 rounded-xl blur-md group-focus-within:bg-brand/5 transition-all"></div>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand transition-colors z-10"
            size={16}
          />
          <input
            type="text"
            placeholder="搜索话题或讨论..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-brand/5 focus:border-brand/40 transition-all outline-none relative z-0 shadow-sm group-hover:shadow-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-white/80">
            {loading ? "加载话题中..." : error ? "暂无可用话题" : "暂无话题"}
          </div>
        ) : (
          filtered.map((topic) => {
            const catName = normalizeCategory(topic.category);
            const style = getCategoryStyle(catName);
            const isActive = selectedTopicId === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`w-full text-left p-3.5 rounded-2xl transition-all duration-200 border group relative overflow-hidden ${style.softBg} ${
                  isActive
                    ? style.activeCard
                    : `border-transparent hover:ring-1 hover:ring-white/40 hover:shadow-sm ${style.border}`
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${style.badge}`}
                  >
                    {catName}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {topic.created_at ? new Date(topic.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <h3 className="text-sm font-bold leading-snug mb-2 text-slate-700 group-hover:text-slate-900 line-clamp-2">
                  {topic.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {topic.followers_count ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp size={12} className={style.accentText} /> {catName}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
