"use client";

import React, { useState } from "react";
import { usePredictionDetail } from "./usePredictionDetail";
import Link from "next/link";
import { MarketHeader } from "@/components/market/MarketHeader";
import { OnboardingBanner } from "@/components/market/OnboardingBanner";
import ChatPanel from "@/components/ChatPanel";
import { PredictionSideRail } from "./components/PredictionSideRail";
import { Loader2, X, ChevronUp, ChevronDown } from "lucide-react";
import { useUserPortfolio } from "@/hooks/useQueries";
import { AnimatePresence, motion } from "framer-motion";

type PredictionDetailClientProps = {
  relatedProposalId?: number | null;
};

function buildJsonLd(prediction: any) {
  // ... (保持原样)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const url = `${baseUrl}/prediction/${prediction.id}`;
  const imageUrl = prediction.image_url || `${baseUrl}/og-image.png`;
  const description =
    prediction.description ||
    prediction.criteria ||
    "链上预测市场事件，参与交易观点，基于区块链的去中心化预测市场平台。";
  const createdTime = prediction.createdAt || prediction.created_at;
  const updatedTime = prediction.updatedAt || prediction.updated_at || createdTime;
  const deadline = prediction.deadline;

  const article: any = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: prediction.title || "Foresight 预测市场事件",
    description,
    image: [imageUrl],
    url,
    mainEntityOfPage: url,
    inLanguage: "zh-CN",
    publisher: {
      "@type": "Organization",
      name: "Foresight",
      url: baseUrl,
    },
  };

  if (prediction.category) {
    article.articleSection = prediction.category;
  }

  if (createdTime) {
    article.datePublished = createdTime;
  }

  if (updatedTime) {
    article.dateModified = updatedTime;
  }

  if (deadline) {
    article.expires = deadline;
  }

  return article;
}

function buildBreadcrumbJsonLd(prediction: any) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "首页",
      item: baseUrl + "/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "热门预测",
      item: baseUrl + "/trending",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: prediction.title || "预测详情",
      item: `${baseUrl}/prediction/${prediction.id}`,
    },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

export default function PredictionDetailClient({ relatedProposalId }: PredictionDetailClientProps) {
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const {
    loading,
    error,
    prediction,
    market,
    account,
    followersCount,
    following,
    toggleFollow,
    followLoading,
    followError,
    tradeSide,
    setTradeSide,
    tradeOutcome,
    setTradeOutcome,
    priceInput,
    setPriceInput,
    amountInput,
    setAmountInput,
    orderMode,
    setOrderMode,
    isSubmitting,
    orderMsg,
    depthBuy,
    depthSell,
    bestBid,
    bestAsk,
    openOrders,
    trades,
    balance,
    mintInput,
    setMintInput,
    handleMint,
    handleRedeem,
    submitOrder,
    cancelOrder,
  } = usePredictionDetail();

  const { data: portfolio, isLoading: portfolioLoading } = useUserPortfolio(account || undefined);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        {error || "未找到预测事件"}
      </div>
    );
  }

  const outcomes = prediction.outcomes || [];
  const hasRelated = false;
  const isMultiOutcome = (prediction.outcomes?.length ?? 0) > 2;
  const yesProb = prediction.stats?.yesProbability ?? 0;
  const noProb = prediction.stats?.noProbability ?? 0;
  const descriptionText =
    prediction.description ||
    prediction.criteria ||
    "链上预测市场事件，参与交易观点，基于区块链的去中心化预测市场平台。";

  const predictionIdNum = Number(prediction.id);
  const currentPosition =
    account && portfolio?.positions
      ? (portfolio.positions as any[]).find((p: any) => Number(p.id) === predictionIdNum)
      : null;

  let positionSideProbPercent: number | null = null;
  if (currentPosition && (currentPosition as any).stats) {
    const stats = (currentPosition as any).stats;
    const yesProbability =
      typeof stats.yesProbability === "number" ? stats.yesProbability : undefined;
    const noProbability = typeof stats.noProbability === "number" ? stats.noProbability : undefined;
    if (typeof yesProbability === "number" && typeof noProbability === "number") {
      const isYes = String((currentPosition as any).outcome || "").toLowerCase() === "yes";
      const sideProb = isYes ? yesProbability : noProbability;
      const pct = Number((sideProb * 100).toFixed(1));
      positionSideProbPercent = Math.max(0, Math.min(100, pct));
    }
  }

  // Helper to render SideRail content
  const renderSideRail = () => (
    <PredictionSideRail
      prediction={prediction}
      market={market}
      account={account}
      bestBid={bestBid}
      bestAsk={bestAsk}
      balance={balance}
      depthBuy={depthBuy}
      depthSell={depthSell}
      openOrders={openOrders}
      trades={trades}
      outcomes={outcomes}
      tradeSide={tradeSide}
      tradeOutcome={tradeOutcome}
      priceInput={priceInput}
      amountInput={amountInput}
      orderMode={orderMode}
      isSubmitting={isSubmitting}
      orderMsg={orderMsg}
      mintInput={mintInput}
      setTradeSide={setTradeSide}
      setTradeOutcome={setTradeOutcome}
      setPriceInput={setPriceInput}
      setAmountInput={setAmountInput}
      setOrderMode={setOrderMode}
      submitOrder={submitOrder}
      cancelOrder={cancelOrder}
      handleMint={handleMint}
      handleRedeem={handleRedeem}
      setMintInput={setMintInput}
      isMultiOutcome={isMultiOutcome}
    />
  );

  return (
    <div className="min-h-screen relative text-gray-900 font-sans pb-24 lg:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(prediction)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(prediction)),
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-violet-50 via-purple-50/20 to-fuchsia-50/10" />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <MarketHeader
            prediction={prediction}
            followersCount={followersCount}
            following={following}
            onFollow={toggleFollow}
            followLoading={followLoading}
            followError={followError}
          />
        </div>

        {/* Summary Card */}
        <div className="mb-6 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm">
          <div className="flex-1">
            <p className="text-sm text-slate-800 leading-relaxed line-clamp-3">{descriptionText}</p>
            {account && currentPosition && !portfolioLoading && (
              <div className="mt-3 inline-flex items-center text-[11px] text-slate-500 gap-2 rounded-full bg-slate-50/80 px-2.5 py-1 border border-slate-100">
                <span className="text-slate-400">我的持仓</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                    String((currentPosition as any).outcome || "").toLowerCase() === "yes"
                      ? "bg-emerald-50 text-emerald-700"
                      : String((currentPosition as any).outcome || "").toLowerCase() === "no"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {(currentPosition as any).outcome}
                </span>
                <span>
                  投入{" "}
                  <span className="font-semibold text-slate-900">
                    ${Number((currentPosition as any).stake || 0).toFixed(2)}
                  </span>
                </span>
                <span>
                  收益{" "}
                  <span
                    className={`font-semibold ${
                      String((currentPosition as any).pnl || "").startsWith("+")
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {(currentPosition as any).pnl}
                  </span>
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:ml-6">
            <div className="flex flex-col px-3 py-2 rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-teal-50 border border-emerald-100/80 shadow-sm shadow-emerald-500/10 min-w-[110px]">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Yes
              </span>
              <span className="text-lg font-black text-slate-900">
                {Number.isFinite(yesProb) ? `${yesProb.toFixed(0)}%` : "-"}
              </span>
            </div>
            <div className="flex flex-col px-3 py-2 rounded-2xl bg-gradient-to-br from-rose-50 via-rose-50/70 to-orange-50 border border-rose-100/80 shadow-sm shadow-rose-500/10 min-w-[110px]">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                No
              </span>
              <span className="text-lg font-black text-slate-900">
                {Number.isFinite(noProb) ? `${noProb.toFixed(0)}%` : "-"}
              </span>
            </div>
          </div>
        </div>

        {relatedProposalId && (
          <div className="mb-6 max-w-3xl rounded-3xl border border-emerald-100/70 bg-gradient-to-r from-emerald-50/90 via-emerald-50/80 to-teal-50/80 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm shadow-emerald-500/10">
            <p className="text-xs sm:text-sm text-emerald-900">
              该预测市场源自社区在提案广场中的讨论，你可以回到原始提案继续交流设计思路和后续迭代建议。
            </p>
            <Link
              href={`/proposals/${relatedProposalId}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/30 hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              查看对应提案
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-320px)] min-h-[600px]">
          {/* Main Content (Chat) - Left, 8 cols */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <OnboardingBanner category={prediction.category} />
            <div className="flex-1 overflow-hidden rounded-2xl shadow-sm border border-slate-200 bg-white">
              <ChatPanel
                eventId={predictionIdNum}
                roomTitle={prediction.title}
                roomCategory={prediction.category}
                hideHeader={false}
              />
            </div>
          </div>

          {/* Side Rail (Trade/Info) - Right, 4 cols - Desktop Only */}
          <div className="hidden lg:col-span-4 lg:block h-full">
            <div className="h-full sticky top-4">{renderSideRail()}</div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <button
          onClick={() => setShowMobileDrawer(true)}
          className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <ChevronUp className="w-5 h-5" />
          交易 / 详情
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {showMobileDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileDrawer(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[2rem] shadow-2xl lg:hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                <span className="font-bold text-slate-900 mt-2">预测市场详情</span>
                <button
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-2 bg-slate-100 rounded-full text-slate-500 mt-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50">{renderSideRail()}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
