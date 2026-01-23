"use client";

import { usePredictionDetail } from "./usePredictionDetail";
import Link from "next/link";
import { MarketHeader } from "@/components/market/MarketHeader";
import { MarketChart } from "@/components/market/MarketChart";
import { TradingPanel } from "@/components/market/TradingPanel";
import { MarketInfo } from "@/components/market/MarketInfo";
import { OutcomeList } from "@/components/market/OutcomeList";
import { SettlementPanel } from "./components/SettlementPanel";
import { Modal } from "@/components/ui/Modal";
import DepositModal from "@/components/DepositModal";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useUserPortfolio } from "@/hooks/useQueries";
import { useTranslations } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { safeJsonLdStringify } from "@/lib/seo";
import { useAuthOptional } from "@/contexts/AuthContext";
import { getEventStatus, getStatusBadgeColor, getStatusText } from "@/lib/date-utils";

type PredictionDetailClientProps = {
  relatedProposalId?: number | null;
};

function buildJsonLd(prediction: any, defaultDescription: string, defaultTitle: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const url = `${baseUrl}/prediction/${prediction.id}`;
  const imageUrl = prediction.image_url || `${baseUrl}/og-image.png`;
  const description = prediction.description || prediction.criteria || defaultDescription;
  const createdTime = prediction.createdAt || prediction.created_at;
  const updatedTime = prediction.updatedAt || prediction.updated_at || createdTime;
  const deadline = prediction.deadline;

  const article: any = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: prediction.title || defaultTitle,
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

function buildBreadcrumbJsonLd(
  prediction: any,
  breadcrumbs: { home: string; trending: string; predictionDetail: string }
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://foresight.market";
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: breadcrumbs.home,
      item: baseUrl + "/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: breadcrumbs.trending,
      item: baseUrl + "/trending",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: prediction.title || breadcrumbs.predictionDetail,
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
  const tMarket = useTranslations("market");
  const tCommon = useTranslations("common");
  const tTrading = useTranslations("trading");
  const t = useTranslations();
  const auth = useAuthOptional();
  const userId = auth?.user?.id ?? null;
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
    tif,
    setTif,
    postOnly,
    setPostOnly,
    maxSlippage,
    setMaxSlippage,
    editingOrderSalt,
    setEditingOrderSalt,
    isSubmitting,
    orderMsg,
    depthBuy,
    depthSell,
    bestBid,
    bestAsk,
    openOrders,
    trades,
    balance,
    shareBalance,
    mintInput,
    setMintInput,
    handleMint,
    handleRedeem,
    submitOrder,
    cancelOrder,
    marketPlanPreview,
    marketPlanLoading,
    marketConfirmOpen,
    marketConfirmMessage,
    cancelMarketConfirm,
    runMarketConfirm,
    useProxy,
    setUseProxy,
    proxyAddress,
    proxyBalance,
    proxyShareBalance,
  } = usePredictionDetail();

  const { data: portfolio, isLoading: portfolioLoading } = useUserPortfolio(account || undefined);

  const [depositOpen, setDepositOpen] = useState(false);

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
        {error || tMarket("detail.notFound")}
      </div>
    );
  }

  const outcomes = prediction.outcomes || [];
  const isMultiOutcome = (prediction.outcomes?.length ?? 0) > 2;
  const yesProb = prediction.stats?.yesProbability ?? 0;
  const noProb = prediction.stats?.noProbability ?? 0;
  const yesLabel = tMarket("detail.yesLabel");
  const noLabel = tMarket("detail.noLabel");
  const descriptionText =
    prediction.description || prediction.criteria || tMarket("detail.defaultDescription");
  const eventStatus = getEventStatus(
    prediction.deadline,
    prediction.status === "completed" || prediction.status === "cancelled"
  );
  const statusBadgeColor = getStatusBadgeColor(eventStatus);
  const statusBadgeText = getStatusText(eventStatus, t);
  const isOffline = eventStatus === "resolved" || eventStatus === "expired";

  const predictionIdNum = Number(prediction.id);
  const currentPosition =
    account && portfolio?.positions
      ? (portfolio.positions as any[]).find((p: any) => Number(p.id) === predictionIdNum)
      : null;
  const positionStake = currentPosition ? Number((currentPosition as any).stake || 0) : 0;

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

  const currentOutcomeRaw = String((currentPosition as any)?.outcome || "");
  const currentOutcomeLower = currentOutcomeRaw.toLowerCase();
  const currentOutcomeLabel =
    currentOutcomeLower === "yes"
      ? yesLabel
      : currentOutcomeLower === "no"
        ? noLabel
        : currentOutcomeRaw;

  return (
    <div className="min-h-screen relative text-gray-900 font-sans pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(
            buildJsonLd(
              prediction,
              tMarket("detail.defaultDescription"),
              tMarket("detail.defaultTitle")
            )
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(
            buildBreadcrumbJsonLd(prediction, {
              home: tMarket("breadcrumbs.home"),
              trending: tMarket("breadcrumbs.trending"),
              predictionDetail: tMarket("breadcrumbs.predictionDetail"),
            })
          ),
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-violet-50 via-purple-50/20 to-fuchsia-50/10" />
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

        <div className="mb-8 max-w-5xl">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            <div className="flex-1 pl-4 border-l-2 border-brand/20">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-3">
                {descriptionText}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {tMarket("detail.priceHint")}
              </p>
              {isOffline && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeColor}`}
                  >
                    {statusBadgeText}
                  </span>
                  <span>{tTrading("orderFlow.marketClosed")}</span>
                </div>
              )}
              {account && currentPosition && !portfolioLoading && (
                <div className="mt-3 max-w-md">
                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] px-3 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 backdrop-blur-md shadow-sm">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 dark:text-slate-500">
                          {tMarket("detail.myPosition")}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                            String((currentPosition as any).outcome || "").toLowerCase() === "yes"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : String((currentPosition as any).outcome || "").toLowerCase() ===
                                  "no"
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                : "bg-slate-500/10 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {currentOutcomeLabel}
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                        <span>
                          {tMarket("detail.stake")}{" "}
                          <span className="font-semibold text-[var(--foreground)]">
                            ${Number((currentPosition as any).stake || 0).toFixed(2)}
                          </span>
                        </span>
                        {positionSideProbPercent !== null && (
                          <span className="text-slate-400 dark:text-slate-500">
                            {tMarket("detail.implied")} {positionSideProbPercent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {tMarket("detail.pnl")}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          String((currentPosition as any).pnl || "").startsWith("+")
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {(currentPosition as any).pnl}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sm:w-[280px] flex flex-col gap-4">
              <div className="w-full">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {yesLabel}
                  </span>
                  <span className="text-[var(--foreground)] normal-case font-black text-sm">
                    {Number.isFinite(yesProb) ? `${yesProb.toFixed(0)}%` : "-"}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200/70 dark:bg-slate-700/50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${Math.max(0, Math.min(100, yesProb))}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {Number.isFinite(yesProb) ? `${yesProb.toFixed(0)}¢` : ""}
                </div>
              </div>

              <div className="w-full">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    {noLabel}
                  </span>
                  <span className="text-[var(--foreground)] normal-case font-black text-sm">
                    {Number.isFinite(noProb) ? `${noProb.toFixed(0)}%` : "-"}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200/70 dark:bg-slate-700/50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-orange-500"
                    style={{ width: `${Math.max(0, Math.min(100, noProb))}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {Number.isFinite(noProb) ? `${noProb.toFixed(0)}¢` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>

        {relatedProposalId && (
          <div className="mb-8 max-w-3xl rounded-3xl border border-emerald-100/70 bg-gradient-to-r from-emerald-50/90 via-emerald-50/80 to-teal-50/80 px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm shadow-emerald-500/10">
            <p className="text-xs sm:text-sm text-emerald-900">
              {tMarket("detail.proposalOriginHint")}
            </p>
            <Link
              href={`/proposals/${relatedProposalId}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/30 hover:bg-emerald-700 transition-colors whitespace-nowrap"
            >
              {tMarket("detail.viewProposal")}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
          {/* 2. Main Content (Left, 8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Chart */}
            <MarketChart
              market={market}
              prediction={prediction}
              tradeOutcome={tradeOutcome}
              setTradeOutcome={setTradeOutcome}
              outcomes={outcomes}
              marketKey={market && prediction ? `${market.chain_id}:${prediction.id}` : undefined}
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
                  account,
                  bestBid,
                  bestAsk,
                  balance,
                  shareBalance: useProxy ? proxyShareBalance : shareBalance,
                  positionStake,
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
                  tif,
                  postOnly,
                  maxSlippage,
                  isSubmitting,
                  orderMsg,
                  marketPlanPreview,
                  marketPlanLoading,
                  useProxy,
                  proxyBalance,
                  proxyAddress,
                }}
                handlers={{
                  setTradeSide,
                  setTradeOutcome,
                  setPriceInput,
                  setAmountInput,
                  setOrderMode,
                  setTif,
                  setPostOnly,
                  setEditingOrderSalt,
                  setMaxSlippage,
                  submitOrder,
                  cancelOrder,
                  handleMint,
                  handleRedeem,
                  setMintInput,
                  setUseProxy,
                  onDeposit: () => {
                    if (!userId) {
                      try {
                        window.dispatchEvent(new CustomEvent("fs:open-wallet-modal"));
                      } catch {}
                      toast.error(tCommon("loginRequiredForDeposit"));
                      return;
                    }
                    setDepositOpen(true);
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onRequireLogin={() => {
          setDepositOpen(false);
          try {
            window.dispatchEvent(new CustomEvent("fs:open-wallet-modal"));
          } catch {}
          toast.error(tCommon("loginRequiredForDeposit"));
        }}
      />

      <Modal
        open={marketConfirmOpen}
        onClose={cancelMarketConfirm}
        role="alertdialog"
        ariaLabelledby="market-order-confirm-title"
        ariaDescribedby="market-order-confirm-desc"
      >
        <div className="bg-white rounded-xl shadow-xl p-5 w-[92vw] max-w-sm border border-gray-100">
          <h3 id="market-order-confirm-title" className="text-sm font-semibold text-gray-900">
            {tCommon("confirm")}
          </h3>
          <p
            id="market-order-confirm-desc"
            className="mt-2 text-sm text-gray-600 whitespace-pre-wrap"
          >
            {marketConfirmMessage || ""}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={cancelMarketConfirm}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              onClick={runMarketConfirm}
            >
              {tCommon("confirm")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
