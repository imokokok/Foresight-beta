"use client";

import { memo } from "react";

/**
 * 话题卡片骨架屏组件
 * 用于在加载状态时显示占位内容，提升用户体验
 */
export const TopicCardSkeleton = memo(function TopicCardSkeleton() {
  return (
    <div className="w-full p-3.5 rounded-2xl border bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 animate-pulse">
      <div className="flex justify-between items-start mb-2">
        {/* 分类标签骨架 */}
        <div className="h-4 w-12 bg-purple-200/60 dark:bg-slate-600/60 rounded-full" />
        {/* 日期骨架 */}
        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
      {/* 标题骨架 - 两行 */}
      <div className="space-y-1.5 mb-3">
        <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
      {/* 底部信息骨架 */}
      <div className="flex items-center gap-3">
        <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-14 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    </div>
  );
});

/**
 * 多个骨架屏列表
 */
export const TopicCardSkeletonList = memo(function TopicCardSkeletonList({
  count = 5,
}: {
  count?: number;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TopicCardSkeleton key={i} />
      ))}
    </div>
  );
});
