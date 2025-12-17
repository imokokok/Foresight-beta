
import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleDollarSign,
  Info,
  ListFilter,
  Loader2,
  Wallet,
} from "lucide-react";
import { formatUnits } from "ethers";

const BIGINT_ZERO = BigInt(0);
const BIGINT_THRESHOLD = BigInt("1000000000000");

interface TradingPanelProps {
  market: any;
  prediction: any;
  tradeSide: "buy" | "sell";
  setTradeSide: (s: "buy" | "sell") => void;
  tradeOutcome: number;
  setTradeOutcome: (i: number) => void;
  priceInput: string;
  setPriceInput: (v: string) => void;
  amountInput: string;
  setAmountInput: (v: string) => void;
  orderMode: "limit" | "best";
  setOrderMode: (m: "limit" | "best") => void;
  submitOrder: () => void;
  isSubmitting: boolean;
  orderMsg: string | null;
  bestBid: string;
  bestAsk: string;
  balance: string; // User balance text
  depthBuy: Array<{ price: string; qty: string }>;
  depthSell: Array<{ price: string; qty: string }>;
  userOrders: any[];
  cancelOrder: (id: string) => void;
  outcomes: any[];
}

export function TradingPanel({
  market,
  prediction,
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
  submitOrder,
  isSubmitting,
  orderMsg,
  bestBid,
  bestAsk,
  balance,
  depthBuy,
  depthSell,
  userOrders,
  cancelOrder,
  outcomes,
}: TradingPanelProps) {
  const [activeTab, setActiveTab] = useState<"trade" | "depth" | "orders">("trade");

  // Format Helpers
  const formatPrice = (p: string) => {
    try {
      const v = BigInt(p);
      if (v === BIGINT_ZERO) return "-";
      const decimals = v > BIGINT_THRESHOLD ? 18 : 6;
      return Number(formatUnits(v, decimals)).toFixed(2);
    } catch {
      return "-";
    }
  };

  const formatAmount = (raw: string) => {
    try {
      const v = BigInt(raw);
      if (v === BIGINT_ZERO) return "0";
      if (v > BIGINT_THRESHOLD) {
        return Number(formatUnits(v, 18)).toFixed(4);
      }
      return raw;
    } catch {
      return raw;
    }
  };

  const fillPrice = (p: string) => {
    setOrderMode("limit");
    setPriceInput(p);
  };

  // Calculations
  const priceNum = Number(priceInput) || 0;
  const amountNum = Number(amountInput) || 0;
  const total = priceNum * amountNum;
  const potentialReturn = tradeSide === "buy" ? amountNum * 1 : 0; // Buy pays price, gets 1.
  const potentialProfit = tradeSide === "buy" ? amountNum - total : 0;
  const profitPercent = total > 0 ? (potentialProfit / total) * 100 : 0;

  const currentOutcomeLabel =
    outcomes[tradeOutcome]?.label || (tradeOutcome === 0 ? "Yes" : "No");
  const currentOutcomeColor =
    outcomes[tradeOutcome]?.color || (tradeOutcome === 0 ? "#10b981" : "#ef4444");

  return (
    <div className="bg-white border border-purple-100 rounded-3xl overflow-hidden flex flex-col h-full min-h-[600px] shadow-xl shadow-purple-500/5 relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400"></div>
      
      {/* Top Tabs */}
      <div className="flex border-b border-gray-100 bg-gray-50/50 p-1 mx-2 mt-4 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab("trade")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === "trade"
                ? "text-purple-600 bg-white shadow-sm ring-1 ring-purple-100"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
            }`}
          >
            交易
          </button>
          <button
            onClick={() => setActiveTab("depth")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === "depth"
                ? "text-purple-600 bg-white shadow-sm ring-1 ring-purple-100"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
            }`}
          >
            深度
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === "orders"
                ? "text-purple-600 bg-white shadow-sm ring-1 ring-purple-100"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
            }`}
          >
            订单 ({userOrders.length})
          </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-5 overflow-y-auto">
        {activeTab === "trade" && (
          <div className="space-y-6">
            {/* Outcome Selector (if multi) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                选择结果
              </label>
              <div className="flex flex-wrap gap-2">
                {outcomes.map((o, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTradeOutcome(idx)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border font-medium transition-all ${
                      tradeOutcome === idx
                        ? "border-purple-200 bg-purple-50 text-purple-700 shadow-sm"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shadow-sm"
                      style={{
                        backgroundColor:
                          o.color || (idx === 0 ? "#10b981" : "#ef4444"),
                      }}
                    />
                    {o.label || (idx === 0 ? "Yes" : "No")}
                  </button>
                ))}
              </div>
            </div>

            {/* Buy/Sell Switch */}
            <div className="bg-gray-100 p-1.5 rounded-xl grid grid-cols-2 shadow-inner">
              <button
                onClick={() => setTradeSide("buy")}
                className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  tradeSide === "buy"
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    : "text-gray-500 hover:text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                <ArrowUp className="w-4 h-4" /> 买入
              </button>
              <button
                onClick={() => setTradeSide("sell")}
                className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  tradeSide === "sell"
                    ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/20"
                    : "text-gray-500 hover:text-rose-600 hover:bg-rose-50"
                }`}
              >
                <ArrowDown className="w-4 h-4" /> 卖出
              </button>
            </div>

            {/* Order Type */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">订单类型</span>
              <div className="flex gap-4">
                <button
                  onClick={() => setOrderMode("limit")}
                  className={`font-semibold transition-colors ${
                    orderMode === "limit" ? "text-purple-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  限价单
                </button>
                <button
                  onClick={() => setOrderMode("best")}
                  className={`font-semibold transition-colors ${
                    orderMode === "best" ? "text-purple-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  市价单
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-gray-500">
                  <span>价格 (USDC)</span>
                  {orderMode === "best" && (
                    <span className="text-purple-500">自动匹配最优价</span>
                  )}
                </div>
                <div className="relative group">
                  <input
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    disabled={orderMode === "best"}
                    placeholder="0.00"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-4 pr-10 text-gray-900 font-medium focus:outline-none focus:border-purple-500 focus:bg-purple-50/30 focus:ring-4 focus:ring-purple-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-400"
                  />
                  <span className="absolute right-4 top-3.5 text-gray-400 font-medium">
                    $
                  </span>
                </div>
                {/* Quick Price Refs */}
                <div className="flex gap-3 text-xs font-medium pt-1">
                  <button
                    onClick={() => fillPrice(formatPrice(bestBid))}
                    className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors"
                  >
                    买一: {formatPrice(bestBid)}
                  </button>
                  <button
                    onClick={() => fillPrice(formatPrice(bestAsk))}
                    className="text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md hover:bg-rose-100 transition-colors"
                  >
                    卖一: {formatPrice(bestAsk)}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-gray-500">
                  <span>数量 (Shares)</span>
                  <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md">
                    <Wallet className="w-3 h-3" />
                    {balance}
                  </span>
                </div>
                <input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-900 font-medium focus:outline-none focus:border-purple-500 focus:bg-purple-50/30 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder-gray-400"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm border border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">总投入</span>
                <span className="text-gray-900 font-bold text-base">
                  ${total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">潜在回报</span>
                <span className="text-emerald-600 font-bold text-base flex items-center gap-1">
                  ${potentialReturn.toFixed(2)} 
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-medium">
                    +{profitPercent.toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="space-y-3">
              <button
                onClick={submitOrder}
                disabled={isSubmitting || !market}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 ${
                  isSubmitting
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                    : tradeSide === "buy"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200"
                    : "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-rose-200"
                }`}
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                {isSubmitting
                  ? "处理中..."
                  : `${tradeSide === "buy" ? "买入" : "卖出"} ${currentOutcomeLabel}`}
              </button>
              {orderMsg && (
                <div
                  className={`text-center text-xs font-medium p-2.5 rounded-lg flex items-center justify-center gap-2 ${
                    orderMsg.includes("成功")
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : "bg-rose-50 text-rose-600 border border-rose-100"
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  {orderMsg}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "depth" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Bids */}
              <div>
                <div className="text-xs font-bold text-emerald-600 mb-3 border-b-2 border-emerald-100 pb-2 flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" /> 买单 (Bids)
                </div>
                <div className="space-y-1.5">
                  {depthBuy.length === 0 && (
                    <div className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">暂无买单</div>
                  )}
                  {depthBuy.map((row, i) => (
                    <div
                      key={i}
                      onClick={() => fillPrice(row.price)}
                      className="flex justify-between text-xs cursor-pointer hover:bg-emerald-50 p-2 rounded-lg transition-colors group"
                    >
                      <span className="text-emerald-600 font-medium group-hover:text-emerald-700">{row.price}</span>
                      <span className="text-gray-500 group-hover:text-gray-700">{row.qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Asks */}
              <div>
                <div className="text-xs font-bold text-rose-600 mb-3 border-b-2 border-rose-100 pb-2 flex items-center gap-1">
                  <ArrowDown className="w-3 h-3" /> 卖单 (Asks)
                </div>
                <div className="space-y-1.5">
                  {depthSell.length === 0 && (
                    <div className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">暂无卖单</div>
                  )}
                  {depthSell.map((row, i) => (
                    <div
                      key={i}
                      onClick={() => fillPrice(row.price)}
                      className="flex justify-between text-xs cursor-pointer hover:bg-rose-50 p-2 rounded-lg transition-colors group"
                    >
                      <span className="text-rose-600 font-medium group-hover:text-rose-700">{row.price}</span>
                      <span className="text-gray-500 group-hover:text-gray-700">{row.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-3">
            {userOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <ListFilter className="w-10 h-10 mb-3 opacity-20" />
                <span className="text-sm font-medium">暂无挂单</span>
              </div>
            ) : (
              userOrders.map((o) => (
                <div
                  key={o.id}
                  className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-md ${
                          o.is_buy
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : "bg-rose-50 text-rose-600 border border-rose-100"
                        }`}
                      >
                        {o.is_buy ? "买" : "卖"}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {outcomes[o.outcome_index]?.label ||
                          (o.outcome_index === 0 ? "Yes" : "No")}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-500 mt-1.5 ml-1">
                      {formatPrice(o.price)} x {formatAmount(o.remaining)}
                    </div>
                  </div>
                  <button
                    onClick={() => cancelOrder(o.maker_salt)}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors border border-rose-100"
                  >
                    撤单
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
