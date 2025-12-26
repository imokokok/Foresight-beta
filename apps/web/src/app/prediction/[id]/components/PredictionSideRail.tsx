"use client";

import React, { useState } from "react";
import { BarChart3, ArrowLeftRight, Info, List } from "lucide-react";
import { TradingPanel } from "@/components/market/TradingPanel";
import { MarketChart } from "@/components/market/MarketChart";
import { MarketInfo } from "@/components/market/MarketInfo";
import { OutcomeList } from "@/components/market/OutcomeList";
import type { PredictionDetail } from "@/app/prediction/[id]/usePredictionDetail";

type TabKey = "trade" | "chart" | "info" | "outcomes";

interface PredictionSideRailProps {
  prediction: PredictionDetail;
  market: any;
  account: string | null | undefined;

  // Trading Data
  bestBid: number | null;
  bestAsk: number | null;
  balance: any;
  depthBuy: any[];
  depthSell: any[];
  openOrders: any[];
  trades: any[];
  outcomes: any[];

  // Trading State & Handlers
  tradeSide: "buy" | "sell";
  tradeOutcome: number;
  priceInput: string;
  amountInput: string;
  orderMode: "limit" | "market";
  isSubmitting: boolean;
  orderMsg: string | null;
  mintInput: string;

  setTradeSide: (side: "buy" | "sell") => void;
  setTradeOutcome: (outcome: number) => void;
  setPriceInput: (val: string) => void;
  setAmountInput: (val: string) => void;
  setOrderMode: (mode: "limit" | "market") => void;
  submitOrder: () => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  handleMint: () => Promise<void>;
  handleRedeem: () => Promise<void>;
  setMintInput: (val: string) => void;

  // Additional
  isMultiOutcome?: boolean;
}

export function PredictionSideRail({
  prediction,
  market,
  account,
  bestBid,
  bestAsk,
  balance,
  depthBuy,
  depthSell,
  openOrders,
  trades,
  outcomes,
  tradeSide,
  tradeOutcome,
  priceInput,
  amountInput,
  orderMode,
  isSubmitting,
  orderMsg,
  mintInput,
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
  isMultiOutcome,
}: PredictionSideRailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("trade");

  const tabs = [
    { key: "trade", icon: ArrowLeftRight, label: "交易" },
    { key: "chart", icon: BarChart3, label: "图表" },
    ...(isMultiOutcome ? [{ key: "outcomes", icon: List, label: "选项" }] : []),
    { key: "info", icon: Info, label: "详情" },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex items-center p-1 bg-slate-50 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === tab.key
                ? "bg-white text-purple-600 shadow-sm ring-1 ring-black/5"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
        <div className="p-4">
          {activeTab === "trade" && (
            <TradingPanel
              data={{
                market,
                prediction,
                account,
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
          )}

          {activeTab === "chart" && (
            <MarketChart
              market={market}
              prediction={prediction}
              tradeOutcome={tradeOutcome}
              setTradeOutcome={setTradeOutcome}
              outcomes={outcomes}
            />
          )}

          {activeTab === "outcomes" && isMultiOutcome && (
            <OutcomeList
              prediction={prediction}
              selectedOutcome={tradeOutcome}
              onSelectOutcome={setTradeOutcome}
              onTrade={(side, idx) => {
                setTradeSide(side);
                setTradeOutcome(idx);
                setActiveTab("trade");
              }}
            />
          )}

          {activeTab === "info" && <MarketInfo prediction={prediction} />}
        </div>
      </div>
    </div>
  );
}
