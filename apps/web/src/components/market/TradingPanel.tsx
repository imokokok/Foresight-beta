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
import { useTranslations } from "@/lib/i18n";

const BIGINT_ZERO = BigInt(0);
const BIGINT_THRESHOLD = BigInt("1000000000000");

interface TradingPanelData {
  market: any;
  prediction: any;
  bestBid: string;
  bestAsk: string;
  balance: string;
  depthBuy: Array<{ price: string; qty: string }>;
  depthSell: Array<{ price: string; qty: string }>;
  userOrders: any[];
  trades?: any[];
  outcomes: any[];
}

interface TradingPanelState {
  tradeSide: "buy" | "sell";
  tradeOutcome: number;
  priceInput: string;
  amountInput: string;
  orderMode: "limit" | "best";
  isSubmitting: boolean;
  orderMsg: string | null;
}

interface TradingPanelHandlers {
  setTradeSide: (s: "buy" | "sell") => void;
  setTradeOutcome: (i: number) => void;
  setPriceInput: (v: string) => void;
  setAmountInput: (v: string) => void;
  setOrderMode: (m: "limit" | "best") => void;
  submitOrder: () => void;
  cancelOrder: (id: string) => void;
}

interface TradingPanelProps {
  data: TradingPanelData;
  state: TradingPanelState;
  handlers: TradingPanelHandlers;
}

export function TradingPanel(props: TradingPanelProps) {
  const { data, state, handlers } = props;
  const {
    market,
    prediction,
    bestBid,
    bestAsk,
    balance,
    depthBuy,
    depthSell,
    userOrders,
    trades = [],
    outcomes,
  } = data;
  const { tradeSide, tradeOutcome, priceInput, amountInput, orderMode, isSubmitting, orderMsg } =
    state;
  const {
    setTradeSide,
    setTradeOutcome,
    setPriceInput,
    setAmountInput,
    setOrderMode,
    submitOrder,
    cancelOrder,
  } = handlers;
  const [activeTab, setActiveTab] = useState<"trade" | "depth" | "orders" | "history">("trade");
  const tTrading = useTranslations("trading");
  const tCommon = useTranslations("common");

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
    outcomes[tradeOutcome]?.label || (tradeOutcome === 0 ? tCommon("yes") : tCommon("no"));
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
          {tTrading("tabTrade")}
        </button>
        <button
          onClick={() => setActiveTab("depth")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "depth"
              ? "text-purple-600 bg-white shadow-sm ring-1 ring-purple-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
          }`}
        >
          {tTrading("depth")}
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "orders"
              ? "text-purple-600 bg-white shadow-sm ring-1 ring-purple-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
          }`}
        >
          {tTrading("myOrders")} ({userOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "history"
              ? "text-purple-600 bg-white shadow-sm ring-1 ring-purple-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
          }`}
        >
          成交
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-5 overflow-y-auto">
        {activeTab === "trade" && (
          <div className="space-y-6">
            {/* Outcome Selector (if multi) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {tTrading("selectOutcome")}
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
                        backgroundColor: o.color || (idx === 0 ? "#10b981" : "#ef4444"),
                      }}
                    />
                    {o.label || (idx === 0 ? tCommon("yes") : tCommon("no"))}
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
                <ArrowUp className="w-4 h-4" /> {tTrading("buy")}
              </button>
              <button
                onClick={() => setTradeSide("sell")}
                className={`py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  tradeSide === "sell"
                    ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/20"
                    : "text-gray-500 hover:text-rose-600 hover:bg-rose-50"
                }`}
              >
                <ArrowDown className="w-4 h-4" /> {tTrading("sell")}
              </button>
            </div>

            {/* Order Type */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">{tTrading("orderType")}</span>
              <div className="flex gap-4">
                <button
                  onClick={() => setOrderMode("limit")}
                  className={`font-semibold transition-colors ${
                    orderMode === "limit" ? "text-purple-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tTrading("limitOrder")}
                </button>
                <button
                  onClick={() => setOrderMode("best")}
                  className={`font-semibold transition-colors ${
                    orderMode === "best" ? "text-purple-600" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tTrading("marketOrder")}
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-gray-500">
                  <span>{tTrading("price")} (USDC)</span>
                  {orderMode === "best" && (
                    <span className="text-purple-500">{tTrading("autoMatchBest")}</span>
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
                  <span className="absolute right-4 top-3.5 text-gray-400 font-medium">$</span>
                </div>
                {/* Quick Price Refs */}
                <div className="flex gap-3 text-xs font-medium pt-1">
                  <button
                    onClick={() => fillPrice(formatPrice(bestBid))}
                    className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors"
                  >
                    {tTrading("bestBid").replace("{price}", formatPrice(bestBid))}
                  </button>
                  <button
                    onClick={() => fillPrice(formatPrice(bestAsk))}
                    className="text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md hover:bg-rose-100 transition-colors"
                  >
                    {tTrading("bestAsk").replace("{price}", formatPrice(bestAsk))}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-gray-500">
                  <span>
                    {tTrading("amount")} ({tTrading("sharesUnit")})
                  </span>
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
                <span className="text-gray-500">{tTrading("totalInvestment")}</span>
                <span className="text-gray-900 font-bold text-base">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{tTrading("potentialReturn")}</span>
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
                  ? tTrading("submitting")
                  : `${tradeSide === "buy" ? tTrading("buy") : tTrading("sell")} ${currentOutcomeLabel}`}
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
          <div className="flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 px-4 py-2 text-xs font-bold text-gray-500 border-b border-gray-800">
              <span>Price (USDC)</span>
              <span className="text-right">Shares</span>
              <span className="text-right">Total</span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[400px]">
              {/* Asks (Sells) - Rendered High to Low (Reverse of default Low to High) */}
              <div className="flex flex-col justify-end">
                {[...depthSell].reverse().map((row, i) => {
                  const maxQty = Math.max(
                    ...depthBuy.map((d) => Number(d.qty)),
                    ...depthSell.map((d) => Number(d.qty)),
                    1
                  );
                  const width = (Number(row.qty) / maxQty) * 100;
                  const total = Number(formatPrice(row.price)) * Number(formatAmount(row.qty));

                  return (
                    <div
                      key={`ask-${i}`}
                      onClick={() => fillPrice(formatPrice(row.price))}
                      className="grid grid-cols-3 px-4 py-1.5 text-xs cursor-pointer hover:bg-gray-800 relative group"
                    >
                      <div
                        className="absolute top-0 right-0 h-full bg-rose-500/10 transition-all duration-300"
                        style={{ width: `${width}%` }}
                      />
                      <span className="text-rose-400 font-medium relative z-10">
                        {formatPrice(row.price)}
                      </span>
                      <span className="text-right text-gray-300 relative z-10">
                        {formatAmount(row.qty)}
                      </span>
                      <span className="text-right text-gray-500 relative z-10">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Spread */}
              <div className="py-2 bg-gray-800/50 text-center text-xs text-gray-400 font-medium border-y border-gray-800 my-1">
                Spread:{" "}
                {bestAsk && bestBid
                  ? (Number(formatPrice(bestAsk)) - Number(formatPrice(bestBid))).toFixed(2)
                  : "-"}
              </div>

              {/* Bids (Buys) - Rendered High to Low (Default) */}
              <div>
                {depthBuy.map((row, i) => {
                  const maxQty = Math.max(
                    ...depthBuy.map((d) => Number(d.qty)),
                    ...depthSell.map((d) => Number(d.qty)),
                    1
                  );
                  const width = (Number(row.qty) / maxQty) * 100;
                  const total = Number(formatPrice(row.price)) * Number(formatAmount(row.qty));

                  return (
                    <div
                      key={`bid-${i}`}
                      onClick={() => fillPrice(formatPrice(row.price))}
                      className="grid grid-cols-3 px-4 py-1.5 text-xs cursor-pointer hover:bg-gray-800 relative group"
                    >
                      <div
                        className="absolute top-0 right-0 h-full bg-emerald-500/10 transition-all duration-300"
                        style={{ width: `${width}%` }}
                      />
                      <span className="text-emerald-400 font-medium relative z-10">
                        {formatPrice(row.price)}
                      </span>
                      <span className="text-right text-gray-300 relative z-10">
                        {formatAmount(row.qty)}
                      </span>
                      <span className="text-right text-gray-500 relative z-10">
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {depthBuy.length === 0 && depthSell.length === 0 && (
                <div className="text-center py-10 text-gray-600 text-xs">No orders yet</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-3">
            {userOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <ListFilter className="w-10 h-10 mb-3 opacity-20" />
                <span className="text-sm font-medium">{tTrading("emptyOrders")}</span>
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
                        {o.is_buy ? tTrading("buy") : tTrading("sell")}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {outcomes[o.outcome_index]?.label ||
                          (o.outcome_index === 0 ? tCommon("yes") : tCommon("no"))}
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
                    {tTrading("cancelOrder")}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <ListFilter className="w-10 h-10 mb-3 opacity-20" />
                <span className="text-sm font-medium">暂无成交记录</span>
              </div>
            ) : (
              trades.map((t, i) => (
                <div
                  key={i}
                  className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-md ${
                        t.is_buy ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {t.is_buy ? tTrading("buy") : tTrading("sell")}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">
                        {outcomes[t.outcome_index]?.label ||
                          (t.outcome_index === 0 ? tCommon("yes") : tCommon("no"))}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(t.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">${formatPrice(t.price)}</div>
                    <div className="text-xs font-medium text-gray-500">
                      {formatAmount(t.amount)} {tTrading("sharesUnit")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
