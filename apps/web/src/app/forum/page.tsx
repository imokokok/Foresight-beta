"use client";

import React from "react";
import { motion } from "framer-motion";
import { getCategoryStyle } from "./forumConfig";
import { ForumSidebar } from "./ForumSidebar";
import { ForumChatFrame } from "./ForumChatFrame";
import { useForumData } from "./useForumData";

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
    <div className="h-screen w-full bg-[#f8faff] p-4 lg:p-6 flex overflow-hidden overflow-x-hidden font-sans text-slate-800 relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/30 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/30 blur-[100px]" />
      </div>
      {/* TV Frame: unify left cards and chat into one frame */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex-1 flex rounded-[32px] bg-gradient-to-br ${
          getCategoryStyle(activeCat).frameSurfaceGradient
        } backdrop-blur-xl border border-white/30 shadow-2xl shadow-indigo-100/50 overflow-hidden z-10`}
      >
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
      </motion.div>
    </div>
  );
}
