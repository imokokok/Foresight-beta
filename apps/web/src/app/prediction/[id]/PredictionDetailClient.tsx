"use client";

import { usePredictionDetail } from "./usePredictionDetail";
import Link from "next/link";
import { MarketHeader } from "@/components/market/MarketHeader";
import { MarketChart } from "@/components/market/MarketChart";
import { TradingPanel } from "@/components/market/TradingPanel";
import { MarketInfo } from "@/components/market/MarketInfo";
import { OutcomeList } from "@/components/market/OutcomeList";
import { Loader2 } from "lucide-react";

type PredictionDetailClientProps = {
  relatedProposalId?: number | null;
};

function buildJsonLd(prediction: any) {
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <MarketHeader
            prediction={prediction}
            followersCount={followersCount}
            following={following}
            onFollow={toggleFollow}
            followLoading={followLoading}
            followError={followError}
          />
        </div>

        <div className="mb-6 max-w-5xl px-1 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200">
          <div className="flex-1">
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{descriptionText}</p>
            <p className="mt-2 text-xs text-gray-500">
              价格代表事件发生的隐含概率，你可以随时买入或卖出持仓，观点变化时也能快速调整。
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:ml-6">
            <div className="flex flex-col px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 min-w-[96px]">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Yes
              </span>
              <span className="text-lg font-black text-gray-900">
                {Number.isFinite(yesProb) ? `${yesProb.toFixed(0)}%` : "-"}
              </span>
              <span className="mt-0.5 text-[11px] text-emerald-600/80">
                {Number.isFinite(yesProb) ? `${yesProb.toFixed(0)}¢` : ""}
              </span>
            </div>
            <div className="flex flex-col px-3 py-2 rounded-2xl bg-rose-50 border border-rose-100 min-w-[96px]">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                No
              </span>
              <span className="text-lg font-black text-gray-900">
                {Number.isFinite(noProb) ? `${noProb.toFixed(0)}%` : "-"}
              </span>
              <span className="mt-0.5 text-[11px] text-rose-600/80">
                {Number.isFinite(noProb) ? `${noProb.toFixed(0)}¢` : ""}
              </span>
            </div>
          </div>
        </div>

        {relatedProposalId && (
          <div className="mb-8 max-w-3xl rounded-3xl border border-emerald-100 bg-emerald-50/80 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-emerald-800">
              该预测市场源自社区在提案广场中的讨论，你可以回到原始提案继续交流设计思路和后续迭代建议。
            </p>
            <Link
              href={`/proposals/${relatedProposalId}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              查看对应提案
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* 2. Main Content (Left, 8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Chart */}
            <MarketChart
              market={market}
              prediction={prediction}
              tradeOutcome={tradeOutcome}
              setTradeOutcome={setTradeOutcome}
              outcomes={outcomes}
            />

            {/* Outcomes List */}
            {isMultiOutcome && (
              <OutcomeList
                prediction={prediction}
                selectedOutcome={tradeOutcome}
                onSelectOutcome={setTradeOutcome}
                onTrade={(side, idx) => {
                  setTradeSide(side);
                  setTradeOutcome(idx);
                }}
              />
            )}

            {/* Info Tabs & Content */}
            <MarketInfo prediction={prediction} />
          </div>

          {/* 3. Trading Panel (Right, 4 cols) */}
          <div className="lg:col-span-4">
            <div className="sticky top-24">
              <TradingPanel
                data={{
                  market,
                  prediction,
                  bestBid,
                  bestAsk,
                  balance,
                  depthBuy,
                  depthSell,
                  userOrders: openOrders,
                  trades,
                  outcomes,
                }}
                state={{
                  tradeSide,
                  tradeOutcome,
                  priceInput,
                  amountInput,
                  orderMode,
                  isSubmitting,
                  orderMsg,
                }}
                handlers={{
                  setTradeSide,
                  setTradeOutcome,
                  setPriceInput,
                  setAmountInput,
                  setOrderMode,
                  submitOrder,
                  cancelOrder,
                  handleMint,
                  handleRedeem,
                  setMintInput,
                }}
              />
            </div>
          </div>
        </div>

        {hasRelated && null}
      </div>
    </div>
  );
}
