import React, { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { TradeTabContent } from "./tradingPanel/TradeTabContent";
import { DepthTabContent } from "./tradingPanel/DepthTabContent";
import { HistoryTabContent, OrdersTabContent } from "./tradingPanel/OrdersHistoryTabs";
import { formatPrice, formatAmount, decodePrice } from "./utils/priceUtils";
import { useReservedBalance } from "./hooks/useReservedBalance";
import { useTradingCalculations } from "./hooks/useTradingCalculations";

type MarketPlanPreview = {
  slippagePercent: number;
  avgPrice: number;
  worstPrice: number;
  totalCost: number;
  filledAmount: number;
  partialFill: boolean;
};

interface TradingPanelData {
  market: any;
  prediction: any;
  account?: string | null;
  bestBid: string;
  bestAsk: string;
  balance: string;
  shareBalance?: string;
  positionStake?: number;
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
  tif: "GTC" | "IOC" | "FOK";
  postOnly: boolean;
  maxSlippage: number;
  isSubmitting: boolean;
  orderMsg: string | null;
  marketPlanPreview?: MarketPlanPreview | null;
  marketPlanLoading?: boolean;
  useProxy?: boolean;
  proxyBalance?: string;
  proxyAddress?: string;
}

interface TradingPanelHandlers {
  setTradeSide: (s: "buy" | "sell") => void;
  setTradeOutcome: (i: number) => void;
  setPriceInput: (v: string) => void;
  setAmountInput: (v: string) => void;
  setOrderMode: (m: "limit" | "best") => void;
  setTif: (t: "GTC" | "IOC" | "FOK") => void;
  setPostOnly: (v: boolean) => void;
  setEditingOrderSalt: (salt: string | null) => void;
  setMaxSlippage: (v: number) => void;
  submitOrder: (opts?: { useProxy?: boolean; proxyAddress?: string }) => void;
  cancelOrder: (salt: string) => void;
  handleMint: (amount: string) => void;
  handleRedeem: (amount: string) => void;
  setMintInput: (v: string) => void;
  setUseProxy?: (v: boolean) => void;
  onDeposit?: () => void;
}

interface TradingPanelProps {
  data: TradingPanelData & { mintInput?: string };
  state: TradingPanelState;
  handlers: TradingPanelHandlers;
}

export function TradingPanel(props: TradingPanelProps) {
  const { data, state, handlers } = props;
  const {
    market,
    prediction,
    account,
    bestBid,
    bestAsk,
    balance,
    shareBalance,
    positionStake,
    depthBuy,
    depthSell,
    userOrders,
    trades = [],
    outcomes,
    mintInput = "",
  } = data;
  const {
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
  } = state;
  const {
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
    onDeposit,
  } = handlers;

  const [activeTab, setActiveTab] = useState<"trade" | "depth" | "orders" | "history">("trade");
  const tTrading = useTranslations("trading");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tWallet = useTranslations("wallet");

  const fillPrice = (p: string) => {
    setOrderMode("limit");
    setPriceInput(p);
  };

  const isWalletConnected = !!account;
  const isTradeTab = activeTab === "trade";
  const isManageTab = activeTab === "orders" || activeTab === "history";

  // 使用自定义 hooks 处理计算逻辑
  const { reservedAccountUsdc, reservedProxyUsdc } = useReservedBalance(
    account,
    proxyAddress,
    userOrders
  );

  const {
    currentShares,
    markPrice,
    stakeBefore,
    markValue,
    unrealizedPnl,
    unrealizedPct,
    hasPositionCard,
  } = useTradingCalculations({
    shareBalance,
    positionStake,
    bestBid,
    bestAsk,
  });

  const handleEditOrder = (o: any) => {
    try {
      const side: "buy" | "sell" = o.is_buy ? "buy" : "sell";
      const outcomeIndex = Number(o.outcome_index ?? 0);
      const priceStr = typeof o.price === "string" ? o.price : String(o.price ?? "0");
      const remainingStr =
        typeof o.remaining === "string" ? o.remaining : String(o.remaining ?? "0");
      setTradeSide(side);
      setTradeOutcome(Number.isFinite(outcomeIndex) ? outcomeIndex : 0);
      setOrderMode("limit");
      setPriceInput(formatPrice(priceStr));
      setAmountInput(formatAmount(remainingStr));
      setEditingOrderSalt(String(o.maker_salt));
      setActiveTab("trade");
    } catch {
      setEditingOrderSalt(null);
      setActiveTab("trade");
    }
  };

  return (
    <div className="bg-white border border-purple-100 rounded-3xl overflow-hidden flex flex-col h-full min-h-[600px] shadow-xl shadow-purple-500/5 relative">
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isWalletConnected ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              1
            </div>
            <span className={isWalletConnected ? "font-semibold text-slate-800" : ""}>
              {tTrading("steps.connectWallet")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isTradeTab
                  ? "bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              2
            </div>
            <span className={isTradeTab ? "font-semibold text-slate-800" : ""}>
              {tTrading("steps.placeOrder")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isManageTab
                  ? "bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              3
            </div>
            <span className={isManageTab ? "font-semibold text-slate-800" : ""}>
              {tTrading("steps.manageOrders")}
            </span>
          </div>
        </div>
      </div>

      {hasPositionCard && (
        <div className="px-4 pt-3">
          <div className="bg-white border border-purple-100 rounded-2xl px-3 py-2.5 flex items-center justify-between shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-gray-500">
                {tTrading("preview.positionImpactTitle")}
              </span>
              <span className="text-xs text-gray-500">
                {formatNumber(currentShares, undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {tTrading("sharesUnit")} · {formatCurrency(markValue)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-right">
                <span
                  className={`block text-sm font-bold ${
                    unrealizedPnl < 0
                      ? "text-rose-600"
                      : unrealizedPnl > 0
                        ? "text-emerald-600"
                        : "text-gray-900"
                  }`}
                >
                  {unrealizedPnl > 0 ? "+" : ""}
                  {formatCurrency(unrealizedPnl)}
                </span>
                <span className="block text-[11px] text-gray-400">
                  {unrealizedPct > 0 ? "+" : ""}
                  {formatPercent(Math.abs(unrealizedPct))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (currentShares <= 0) return;
                  setActiveTab("trade");
                  setTradeSide("sell");
                  setOrderMode("best");
                  setAmountInput(currentShares.toFixed(6).replace(/\.?0+$/, ""));
                }}
                className="px-2 py-1 rounded-full border border-rose-100 bg-rose-50 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-200 transition-colors"
              >
                {tTrading("sell")} {tTrading("hints.max")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex border-b border-gray-100 bg-gray-50/50 p-1 mx-2 mt-3 rounded-xl gap-1">
        <button
          onClick={() => setActiveTab("trade")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "trade"
              ? "text-purple-600 bg-white shadow-sm ring-1 ring-purple-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/50"
          }`}
        >
          {handlers.onDeposit
            ? `${tTrading("tabTrade")} & ${tWallet("deposit")}`
            : tTrading("tabTrade")}
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
          {tTrading("tabHistory")}
        </button>
      </div>

      <div className="flex-1 p-5 overflow-y-auto">
        {activeTab === "trade" && (
          <TradeTabContent
            tradeSide={tradeSide}
            setTradeSide={setTradeSide}
            tradeOutcome={tradeOutcome}
            setTradeOutcome={setTradeOutcome}
            outcomes={outcomes}
            prediction={prediction}
            tTrading={tTrading}
            tCommon={tCommon}
            tAuth={tAuth}
            tWallet={tWallet}
            orderMode={orderMode}
            setOrderMode={setOrderMode}
            tif={tif}
            setTif={setTif}
            postOnly={postOnly}
            setPostOnly={setPostOnly}
            maxSlippage={maxSlippage}
            setMaxSlippage={setMaxSlippage}
            bestBid={bestBid}
            bestAsk={bestAsk}
            priceInput={priceInput}
            setPriceInput={setPriceInput}
            amountInput={amountInput}
            setAmountInput={setAmountInput}
            balance={balance}
            currentShares={currentShares}
            positionStake={positionStake}
            markPrice={markPrice}
            markValue={markValue}
            unrealizedPnl={unrealizedPnl}
            unrealizedPct={unrealizedPct}
            submitOrder={submitOrder}
            isSubmitting={isSubmitting}
            market={market}
            orderMsg={orderMsg}
            mintInput={mintInput}
            setMintInput={setMintInput}
            handleMint={handleMint}
            handleRedeem={handleRedeem}
            formatPrice={formatPrice}
            decodePrice={decodePrice}
            fillPrice={fillPrice}
            marketPlanPreview={marketPlanPreview ?? null}
            marketPlanLoading={!!marketPlanLoading}
            useProxy={useProxy}
            proxyBalance={proxyBalance}
            proxyAddress={proxyAddress}
            reservedUsdc={reservedAccountUsdc}
            reservedProxyUsdc={reservedProxyUsdc}
            setUseProxy={setUseProxy}
            onDeposit={handlers.onDeposit}
          />
        )}

        {activeTab === "depth" && (
          <DepthTabContent
            depthBuy={depthBuy}
            depthSell={depthSell}
            bestBid={bestBid}
            bestAsk={bestAsk}
            formatPrice={formatPrice}
            formatAmount={formatAmount}
            fillPrice={fillPrice}
          />
        )}

        {activeTab === "orders" && (
          <OrdersTabContent
            userOrders={userOrders}
            outcomes={outcomes}
            tTrading={tTrading}
            tCommon={tCommon}
            cancelOrder={cancelOrder}
            formatPrice={formatPrice}
            formatAmount={formatAmount}
            onEditOrder={handleEditOrder}
          />
        )}

        {activeTab === "history" && (
          <HistoryTabContent
            trades={trades}
            outcomes={outcomes}
            tTrading={tTrading}
            tCommon={tCommon}
            formatPrice={formatPrice}
            formatAmount={formatAmount}
          />
        )}
      </div>
    </div>
  );
}
