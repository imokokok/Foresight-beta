"use client";

import { motion } from "framer-motion";
import GradientPage from "@/components/ui/GradientPage";
import { getCategoryStyle } from "./forumConfig";
import { ForumSidebar } from "./ForumSidebar";
import { ForumChatFrame } from "./ForumChatFrame";
import { useForumData } from "./useForumData";

// 提取动画配置为模块级常量，避免每次渲染重新创建对象
const TV_ANIMATION = {
  initial: { scaleY: 0.005, scaleX: 0.2, opacity: 0 },
  animate: { scaleY: 1, scaleX: 1, opacity: 1 },
  transition: {
    scaleY: { duration: 0.4, ease: "easeOut" },
    scaleX: { duration: 0.3, delay: 0.15, ease: "easeOut" },
    opacity: { duration: 0.2 },
  },
} as const;

export default function ForumPage() {
  const {
    account,
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
    currentTopic,
    activeCat,
    displayName,
  } = useForumData();

  return (
    <GradientPage className="h-screen w-full px-4 lg:px-6 pt-8 lg:pt-14 pb-4 lg:pb-8 flex overflow-hidden overflow-x-hidden font-sans text-[var(--foreground)] relative">
      {/* 背景光晕 - 模拟电视屏幕发出的环境光 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/25 blur-[110px] dark:bg-purple-500/10" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/25 blur-[110px] dark:bg-sky-500/10" />
      </div>

      {/* 电视机整体容器 */}
      <motion.div
        initial={TV_ANIMATION.initial}
        animate={TV_ANIMATION.animate}
        transition={TV_ANIMATION.transition}
        className="w-full max-w-6xl flex flex-col items-center z-10"
      >
        {/* 电视机外壳 */}
        <div className="relative w-full max-h-[780px]">
          {/* 外壳边框 - 柔和淡紫色质感 */}
          <div className="absolute -inset-3 bg-gradient-to-br from-purple-200 via-fuchsia-200 to-purple-300 rounded-[42px] shadow-xl shadow-purple-300/40 dark:from-slate-700 dark:via-purple-800/50 dark:to-slate-800" />

          {/* 外壳内边框 - 柔和高光斜面 */}
          <div className="absolute -inset-1.5 bg-gradient-to-br from-purple-100 via-fuchsia-100 to-purple-200 rounded-[36px] dark:from-slate-600 dark:via-purple-700/40 dark:to-slate-700" />

          {/* 屏幕区域 */}
          <div className="relative flex rounded-[32px] overflow-hidden shadow-inner max-h-[720px] bg-gradient-to-br from-white via-purple-50/40 to-fuchsia-50/30 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-900 border border-purple-200/60 dark:border-slate-700/50">
            {/* 内部渐变背景 - 增加活力 */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-purple-100/40 via-fuchsia-100/30 to-violet-50/40 dark:from-purple-900/30 dark:via-fuchsia-900/20 dark:to-violet-950/30 opacity-90" />
            {/* 增加光晕效果 */}
            <div className="pointer-events-none absolute -z-10 top-0 right-0 w-96 h-96 rounded-full bg-fuchsia-200/40 blur-3xl dark:bg-fuchsia-600/15" />
            <div className="pointer-events-none absolute -z-10 bottom-0 left-1/3 w-80 h-80 rounded-full bg-purple-200/50 blur-3xl dark:bg-purple-600/15" />

            {/* CRT 扫描线效果 */}
            <div
              className="pointer-events-none absolute inset-0 z-50 opacity-[0.03] dark:opacity-[0.05]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.3) 1px, rgba(0,0,0,0.3) 2px)",
                backgroundSize: "100% 2px",
              }}
            />

            {/* 屏幕玻璃反光效果 */}
            <div className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-60" />
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-32 z-40 bg-gradient-to-b from-white/5 to-transparent" />

            {/* 屏幕边缘暗角 */}
            <div className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_100px_rgba(0,0,0,0.3)] rounded-[32px]" />

            <ForumSidebar
              categories={categories}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filtered={filtered}
              loading={loading}
              error={error}
              selectedTopicId={selectedTopicId}
              setSelectedTopicId={setSelectedTopicId}
            />
            <ForumChatFrame
              account={account}
              currentTopic={currentTopic}
              activeCat={activeCat}
              displayName={displayName}
              loading={loading}
              error={error}
            />
          </div>

          {/* 电源指示灯 */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-purple-400 shadow-md shadow-purple-400/50 animate-pulse" />
          </div>

          {/* 品牌 Logo 区域 */}
          <div className="absolute -bottom-1 right-6 text-[10px] font-bold tracking-[0.2em] text-purple-400/80 dark:text-purple-300/60 uppercase">
            Foresight
          </div>
        </div>

        {/* 电视机底座 */}
        <div className="relative mt-1">
          <div className="w-48 h-3 bg-gradient-to-b from-purple-200 to-purple-300 rounded-b-xl shadow-md shadow-purple-200/40 dark:from-slate-700 dark:to-slate-800" />
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-32 h-2 bg-gradient-to-b from-purple-300 to-purple-400/80 rounded-b-lg dark:from-slate-800 dark:to-slate-900" />
        </div>
      </motion.div>
    </GradientPage>
  );
}
