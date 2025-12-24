"use client";

import { usePredictionDetail } from "./usePredictionDetail";

// Components
import { MarketHeader } from "@/components/market/MarketHeader";
import { MarketChart } from "@/components/market/MarketChart";
import { TradingPanel } from "@/components/market/TradingPanel";
import { MarketInfo } from "@/components/market/MarketInfo";
import { OutcomeList } from "@/components/market/OutcomeList";
import { Loader2 } from "lucide-react";
export default function PredictionDetailClient() {
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

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 font-sans pb-20 relative overflow-hidden">
      {/* Colorful Blobs Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] bg-pink-200/40 rounded-full blur-[120px] mix-blend-multiply animate-blob animation-delay-4000"></div>
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-emerald-100/40 rounded-full blur-[100px] mix-blend-multiply animate-blob animation-delay-6000"></div>
      </div>

      <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] pointer-events-none opacity-30 z-0"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        {/* 1. Header Section */}
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
            <OutcomeList
              prediction={prediction}
              selectedOutcome={tradeOutcome}
              onSelectOutcome={setTradeOutcome}
              onTrade={(side, idx) => {
                setTradeSide(side);
                setTradeOutcome(idx);
              }}
            />

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
                }}
              />
              <div className="mt-4 bg-white border border-purple-100 rounded-3xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                  <span>铸币 (USDC → 预测份额)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={mintInput}
                    onChange={(e) => setMintInput(e.target.value)}
                    placeholder="输入铸币数量 (USDC)"
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm text-gray-900 focus:outline-none focus:border-purple-500 focus:bg-purple-50/30 focus:ring-2 focus:ring-purple-500/10"
                  />
                  <button
                    onClick={() => mintInput && handleMint(mintInput)}
                    disabled={!market || !account || !mintInput}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    铸币
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  先用 USDC 铸造完整预测份额，再在上方交易面板中挂卖单。
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
