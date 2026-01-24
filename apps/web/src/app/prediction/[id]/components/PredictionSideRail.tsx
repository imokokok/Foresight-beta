"use client";

import React, { useState } from "react";
import { BarChart3, ArrowLeftRight, Info, List } from "lucide-react";
import { TradingPanel } from "@/components/market/TradingPanel";
import { MarketChart } from "@/components/market/MarketChart";
import { MarketInfo } from "@/components/market/MarketInfo";
import { OutcomeList } from "@/components/market/OutcomeList";
import type { PredictionDetail } from "@/app/prediction/[id]/_lib/types";
import { useTranslations } from "@/lib/i18n";

type TabKey = "trade" | "chart" | "info" | "outcomes";

interface PredictionSideRailProps {
  prediction: PredictionDetail;
  market: any;
  address: string | null | undefined;

  // Trading Data
  bestBid: string;
  bestAsk: string;
  balance: string;
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
  orderMode: "limit" | "best";
  tif: "GTC" | "IOC" | "FOK";
  postOnly: boolean;
  maxSlippage: number;
  isSubmitting: boolean;
  orderMsg: string | null;
  mintInput: string;

  setTradeSide: (side: "buy" | "sell") => void;
  setTradeOutcome: (outcome: number) => void;
  setPriceInput: (val: string) => void;
  setAmountInput: (val: string) => void;
  setOrderMode: (mode: "limit" | "best") => void;
  setTif: (t: "GTC" | "FOK" | "IOC") => void;
  setPostOnly: (v: boolean) => void;
  setEditingOrderSalt: (salt: string | null) => void;
  setMaxSlippage: (v: number) => void;
  submitOrder: (opts?: { useProxy?: boolean; proxyAddress?: string }) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  handleMint: (amount: string) => Promise<void>;
  handleRedeem: (amount: string) => Promise<void>;
  setMintInput: (val: string) => void;

  // Proxy Wallet
  useProxy?: boolean;
  proxyBalance?: string;
  proxyAddress?: string;
  setUseProxy?: (val: boolean) => void;

  // Additional
  isMultiOutcome?: boolean;
}

export function PredictionSideRail({
  prediction,
  market,
  address,
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
  tif,
  postOnly,
  maxSlippage,
  isSubmitting,
  orderMsg,
  mintInput,
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
  useProxy,
  proxyBalance,
  proxyAddress,
  setUseProxy,
  isMultiOutcome,
}: PredictionSideRailProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("trade");
  const tTrading = useTranslations("trading");

  const tabs = [
    { key: "trade", icon: ArrowLeftRight, label: tTrading("tabTrade") },
    { key: "chart", icon: BarChart3, label: tTrading("tabChart") },
    ...(isMultiOutcome ? [{ key: "outcomes", icon: List, label: tTrading("tabOutcomes") }] : []),
    { key: "info", icon: Info, label: tTrading("tabInfo") },
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
                address,
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
                tif,
                postOnly,
                maxSlippage,
                isSubmitting,
                orderMsg,
                marketPlanPreview: null,
                marketPlanLoading: false,
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
                submitOrder: (opts?: { useProxy?: boolean; proxyAddress?: string }) => {
                  void submitOrder(opts);
                },
                cancelOrder: (orderId: string) => {
                  void cancelOrder(orderId);
                },
                handleMint: (amount: string) => {
                  void handleMint(amount);
                },
                handleRedeem: (amount: string) => {
                  void handleRedeem(amount);
                },
                setMintInput,
                setUseProxy,
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
