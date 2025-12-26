"use client";

import React from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { getCategoryStyle } from "./forumConfig";
import { ForumSidebar } from "./ForumSidebar";
import { ForumChatFrame } from "./ForumChatFrame";
import { useForumData } from "./useForumData";

function buildForumJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Foresight 讨论区",
        url: baseUrl + "/forum",
        description:
          "在 Foresight 讨论区围绕预测市场事件交流观点、分享策略，参与提案共创与市场分析。",
        inLanguage: "zh-CN",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "首页",
            item: baseUrl + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "讨论区",
            item: baseUrl + "/forum",
          },
        ],
      },
    ],
  };
}

export default function ForumPage() {
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get("eventId");
  const initialEventId =
    eventIdParam && !Number.isNaN(Number(eventIdParam)) ? Number(eventIdParam) : null;

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
  } = useForumData(initialEventId);

  const jsonLd = buildForumJsonLd();

  return (
    <div className="w-full bg-slate-50 p-4 lg:p-6 flex items-center justify-center overflow-hidden overflow-x-hidden font-sans text-slate-800 relative min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/20 blur-[110px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/20 blur-[110px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-6xl max-h-[720px] flex rounded-[32px] bg-slate-900/10 bg-gradient-to-br ${
          getCategoryStyle(activeCat).frameSurfaceGradient
        } backdrop-blur-xl border border-white/40 shadow-none overflow-hidden z-10`}
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
