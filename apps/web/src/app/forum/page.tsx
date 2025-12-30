"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ChevronUp, X } from "lucide-react";
import GradientPage from "@/components/ui/GradientPage";
import { ForumSidebar } from "./ForumSidebar";
import { ForumChatFrame } from "./ForumChatFrame";
import { useForumData } from "./useForumData";
import { t } from "@/lib/i18n";

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
    loadingMore,
    error,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
    displayName,
    hasNextPage,
    loadMore,
    total,
    // 实时更新
    newCount,
    refreshAndReset,
    isConnected,
    // 滚动位置
    saveScrollPosition,
    getSavedScrollPosition,
  } = useForumData();

  // 移动端话题选择器抽屉状态
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // 移动端选择话题后关闭抽屉
  const handleMobileTopicSelect = (id: number) => {
    setSelectedTopicId(id);
    setMobileDrawerOpen(false);
  };

  return (
    <GradientPage className="h-screen w-full px-2 md:px-4 lg:px-6 pt-4 md:pt-8 lg:pt-14 pb-0 md:pb-4 lg:pb-8 flex overflow-hidden overflow-x-hidden font-sans text-[var(--foreground)] relative">
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
        className="w-full max-w-6xl flex flex-col items-center z-10 h-full md:h-auto"
      >
        {/* 电视机外壳 - 在移动端简化 */}
        <div className="relative w-full h-full md:h-auto md:max-h-[780px]">
          {/* 外壳边框 - 仅在 md 及以上显示 */}
          <div className="hidden md:block absolute -inset-3 bg-gradient-to-br from-purple-200 via-fuchsia-200 to-purple-300 rounded-[42px] shadow-xl shadow-purple-300/40 dark:from-slate-700 dark:via-purple-800/50 dark:to-slate-800" />

          {/* 外壳内边框 - 仅在 md 及以上显示 */}
          <div className="hidden md:block absolute -inset-1.5 bg-gradient-to-br from-purple-100 via-fuchsia-100 to-purple-200 rounded-[36px] dark:from-slate-600 dark:via-purple-700/40 dark:to-slate-700" />

          {/* 屏幕区域 */}
          <div className="relative flex flex-col md:flex-row rounded-2xl md:rounded-[32px] overflow-hidden shadow-inner h-full md:h-auto md:max-h-[720px] bg-gradient-to-br from-white via-purple-50/40 to-fuchsia-50/30 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-900 border border-purple-200/60 dark:border-slate-700/50">
            {/* 内部渐变背景 */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white via-purple-50/60 to-fuchsia-50/50 dark:from-slate-900 dark:via-purple-950/40 dark:to-slate-900 opacity-100" />
            {/* 光晕效果 */}
            <div className="pointer-events-none absolute -z-10 top-0 right-0 w-48 md:w-96 h-48 md:h-96 rounded-full bg-fuchsia-200/50 blur-3xl dark:bg-fuchsia-600/20" />
            <div className="pointer-events-none absolute -z-10 bottom-0 left-1/3 w-40 md:w-80 h-40 md:h-80 rounded-full bg-purple-200/60 blur-3xl dark:bg-purple-600/20" />

            {/* CRT 扫描线效果 - 仅在 md 及以上显示 */}
            <div
              className="hidden md:block pointer-events-none absolute inset-0 z-50 opacity-[0.015] dark:opacity-[0.03]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.2) 1px, rgba(0,0,0,0.2) 2px)",
                backgroundSize: "100% 2px",
              }}
            />

            {/* 屏幕玻璃反光效果 - 仅在 md 及以上显示 */}
            <div className="hidden md:block pointer-events-none absolute inset-0 z-40 bg-gradient-to-br from-white/15 via-transparent to-transparent opacity-40" />
            <div className="hidden md:block pointer-events-none absolute top-0 left-0 right-0 h-32 z-40 bg-gradient-to-b from-white/10 to-transparent opacity-30" />

            {/* 屏幕边缘暗角 */}
            <div className="pointer-events-none absolute inset-0 z-30 rounded-2xl md:rounded-[32px]" />

            {/* 桌面端侧边栏 - 仅在 md 及以上显示 */}
            <div className="hidden md:flex">
              <ForumSidebar
                categories={categories}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filtered={filtered}
                loading={loading}
                loadingMore={loadingMore}
                error={error}
                selectedTopicId={selectedTopicId}
                setSelectedTopicId={setSelectedTopicId}
                hasNextPage={hasNextPage}
                loadMore={loadMore}
                total={total}
                newCount={newCount}
                refreshAndReset={refreshAndReset}
                isConnected={isConnected}
                saveScrollPosition={saveScrollPosition}
                getSavedScrollPosition={getSavedScrollPosition}
              />
            </div>

            {/* 聊天区域 - 全宽度在移动端 */}
            <ForumChatFrame
              account={account}
              currentTopic={currentTopic}
              activeCat={activeCat}
              displayName={displayName}
              loading={loading}
              error={error}
              onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
            />
          </div>

          {/* 电源指示灯 - 仅在 md 及以上显示 */}
          <div className="hidden md:flex absolute -bottom-1 left-1/2 -translate-x-1/2 items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-purple-400 shadow-md shadow-purple-400/50 animate-pulse" />
          </div>

          {/* 品牌 Logo 区域 - 仅在 md 及以上显示 */}
          <div className="hidden md:block absolute -bottom-1 right-6 text-[10px] font-bold tracking-[0.2em] text-purple-400/80 dark:text-purple-300/60 uppercase">
            Foresight
          </div>
        </div>

        {/* 电视机底座 - 仅在 md 及以上显示 */}
        <div className="hidden md:block relative mt-1">
          <div className="w-48 h-3 bg-gradient-to-b from-purple-200 to-purple-300 rounded-b-xl shadow-md shadow-purple-200/40 dark:from-slate-700 dark:to-slate-800" />
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-32 h-2 bg-gradient-to-b from-purple-300 to-purple-400/80 rounded-b-lg dark:from-slate-800 dark:to-slate-900" />
        </div>
      </motion.div>

      {/* 移动端话题选择按钮 - 固定在底部 */}
      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 bg-brand-accent text-white rounded-full shadow-lg shadow-brand/40 font-bold text-sm active:scale-95 transition-transform"
      >
        <MessageSquare size={18} />
        <span>{t("forum.selectTopicMobile")}</span>
        <ChevronUp size={16} />
      </button>

      {/* 移动端话题选择抽屉 */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="md:hidden fixed inset-0 bg-black/50 z-50"
            />
            {/* 抽屉内容 */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
            >
              {/* 抽屉头部 */}
              <div className="flex items-center justify-between p-4 border-b border-purple-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-brand/10 rounded-xl flex items-center justify-center">
                    <MessageSquare size={18} className="text-brand" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">{t("forum.sidebarTitle")}</h3>
                    <p className="text-xs text-slate-500">{t("forum.topicCount").replace("{count}", String(filtered.length))}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              {/* 抽屉内容 - 使用 ForumSidebar 的内容部分 */}
              <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
                <ForumSidebar
                  categories={categories}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  filtered={filtered}
                  loading={loading}
                  loadingMore={loadingMore}
                  error={error}
                  selectedTopicId={selectedTopicId}
                  setSelectedTopicId={handleMobileTopicSelect}
                  hasNextPage={hasNextPage}
                  loadMore={loadMore}
                  total={total}
                  newCount={newCount}
                  refreshAndReset={refreshAndReset}
                  isConnected={isConnected}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </GradientPage>
  );
}
