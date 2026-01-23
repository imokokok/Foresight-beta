import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Info, Loader2, Wallet } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent, formatInteger } from "@/lib/format";

type MarketPlanPreview = {
  slippagePercent: number;
  avgPrice: number;
  worstPrice: number;
  totalCost: number;
  filledAmount: number;
  partialFill: boolean;
};

export type TradeTabContentProps = {
  tradeSide: "buy" | "sell";
  setTradeSide: (s: "buy" | "sell") => void;
  tradeOutcome: number;
  setTradeOutcome: (i: number) => void;
  outcomes: any[];
  prediction: any;
  tTrading: (key: string) => string;
  tCommon: (key: string) => string;
  tAuth: (key: string) => string;
  tWallet: (key: string) => string;
  orderMode: "limit" | "best";
  setOrderMode: (m: "limit" | "best") => void;
  tif: "GTC" | "IOC" | "FOK";
  setTif: (t: "GTC" | "IOC" | "FOK") => void;
  postOnly: boolean;
  setPostOnly: (v: boolean) => void;
  maxSlippage: number;
  setMaxSlippage: (v: number) => void;
  bestBid: string;
  bestAsk: string;
  priceInput: string;
  setPriceInput: (v: string) => void;
  amountInput: string;
  setAmountInput: (v: string) => void;
  balance: string;
  currentShares: number;
  positionStake?: number;
  markPrice?: number;
  markValue?: number;
  unrealizedPnl?: number;
  unrealizedPct?: number;
  submitOrder: (opts?: { useProxy?: boolean; proxyAddress?: string }) => void;
  isSubmitting: boolean;
  market: any;
  orderMsg: string | null;
  mintInput: string;
  setMintInput: (v: string) => void;
  handleMint: (amount: string) => void;
  handleRedeem: (amount: string) => void;
  formatPrice: (p: string, showCents?: boolean) => string;
  decodePrice: (p: string) => number;
  fillPrice: (p: string) => void;
  marketPlanPreview: MarketPlanPreview | null;
  marketPlanLoading: boolean;
  useProxy?: boolean;
  proxyBalance?: string;
  proxyAddress?: string;
  reservedUsdc?: number;
  reservedProxyUsdc?: number;
  setUseProxy?: (v: boolean) => void;
  onDeposit?: () => void;
};

export function TradeTabContent({
  tradeSide,
  setTradeSide,
  tradeOutcome,
  setTradeOutcome,
  outcomes,
  prediction,
  tTrading,
  tCommon,
  tAuth,
  tWallet,
  orderMode,
  setOrderMode,
  tif,
  setTif,
  postOnly,
  setPostOnly,
  maxSlippage,
  setMaxSlippage,
  bestBid,
  bestAsk,
  priceInput,
  setPriceInput,
  amountInput,
  setAmountInput,
  balance,
  currentShares,
  positionStake,
  markPrice,
  markValue,
  unrealizedPnl,
  unrealizedPct,
  submitOrder,
  isSubmitting,
  market,
  orderMsg,
  mintInput,
  setMintInput,
  handleMint,
  handleRedeem,
  formatPrice,
  decodePrice,
  fillPrice,
  marketPlanPreview,
  marketPlanLoading,
  useProxy,
  proxyBalance,
  proxyAddress,
  reservedUsdc,
  reservedProxyUsdc,
  setUseProxy,
  onDeposit,
}: TradeTabContentProps) {
  const parseUsdcBalanceNumber = (v: string | undefined) => {
    if (!v) return 0;
    const digits = v.replace(/[^0-9.]/g, "");
    const n = parseFloat(digits);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const effectiveUsdcBalance =
    tradeSide === "buy"
      ? parseUsdcBalanceNumber(useProxy && proxyBalance ? proxyBalance : balance)
      : 0;
  const effectiveUsdcReserved =
    tradeSide === "buy" ? (useProxy ? (reservedProxyUsdc ?? 0) : (reservedUsdc ?? 0)) : 0;
  const effectiveUsdcAvailable =
    tradeSide === "buy" ? Math.max(0, effectiveUsdcBalance - effectiveUsdcReserved) : 0;

  const isMarketOrder = orderMode === "best";
  let priceNum = 0;
  let amountNum = 0;
  if (isMarketOrder) {
    if (marketPlanPreview) {
      priceNum = marketPlanPreview.avgPrice || 0;
      amountNum = marketPlanPreview.filledAmount || 0;
    } else {
      const marketPriceSource = tradeSide === "buy" ? bestAsk : bestBid;
      priceNum = Number(formatPrice(marketPriceSource)) || 0;
      amountNum = Number(amountInput) || 0;
    }
  } else {
    priceNum = Number(priceInput) || 0;
    amountNum = Number(amountInput) || 0;
  }
  const requestedAmount = Number(amountInput) || 0;
  const total =
    isMarketOrder && marketPlanPreview ? marketPlanPreview.totalCost || 0 : priceNum * amountNum;
  const potentialReturn = tradeSide === "buy" ? amountNum * 1 : 0;
  const potentialProfit = tradeSide === "buy" ? amountNum - total : 0;
  const profitPercent = total > 0 ? (potentialProfit / total) * 100 : 0;

  const currentOutcomeLabel =
    outcomes[tradeOutcome]?.label || (tradeOutcome === 0 ? tCommon("yes") : tCommon("no"));
  const isMultiOutcome = outcomes.length > 2;
  const marketStatus =
    market && typeof market.status === "string" ? market.status.trim().toLowerCase() : "";
  const isMarketClosed = marketStatus.length > 0 && marketStatus !== "open";

  const canSubmit = (() => {
    if (isMarketClosed) return false;
    const amountText = (amountInput || "").trim();
    const priceText = (priceInput || "").trim();
    const amountVal = parseFloat(amountText);
    const priceVal = parseFloat(priceText);
    if (amountText.length > 0) {
      if (!Number.isFinite(amountVal) || amountVal <= 0) return false;
      const idx = amountText.indexOf(".");
      const decimalsCount = idx < 0 ? 0 : Math.max(0, amountText.length - idx - 1);
      if (decimalsCount > 6) return false;
    }
    if (orderMode === "limit" && priceText.length > 0) {
      if (!Number.isFinite(priceVal) || priceVal <= 0 || priceVal >= 1) return false;
    }
    return true;
  })();

  const disabledReason = (() => {
    if (isMarketClosed) return tTrading("orderFlow.marketClosed");
    const amountText = (amountInput || "").trim();
    const priceText = (priceInput || "").trim();
    if (amountText.length > 0) {
      const amountVal = parseFloat(amountText);
      if (!Number.isFinite(amountVal) || amountVal <= 0) return tTrading("orderFlow.invalidAmount");
      const idx = amountText.indexOf(".");
      const decimalsCount = idx < 0 ? 0 : Math.max(0, amountText.length - idx - 1);
      if (decimalsCount > 6) return tTrading("orderFlow.invalidAmountPrecision");
    }
    if (orderMode === "limit" && priceText.length > 0) {
      const priceVal = parseFloat(priceText);
      if (!Number.isFinite(priceVal) || priceVal <= 0 || priceVal >= 1)
        return tTrading("orderFlow.invalidPrice");
    }

    // Check insufficient funds
    if (tradeSide === "buy") {
      // For market orders, total is estimated cost. For limit, it's price * amount.
      // total is already calculated in component scope
      if (total > effectiveUsdcAvailable) {
        return tTrading("orderFlow.insufficientFunds");
      }
    }

    return null;
  })();

  let feeRate = 0;
  if (market && typeof market.fee_bps === "number" && market.fee_bps >= 0) {
    feeRate = market.fee_bps / 10000;
  } else {
    feeRate = 0.004;
  }

  const [sellToolsOpen, setSellToolsOpen] = useState(false);
  const sellNoBalanceMsg = tTrading("orderFlow.sellNoBalance");
  useEffect(() => {
    if (tradeSide !== "sell") return;
    if (orderMsg && orderMsg.includes(sellNoBalanceMsg)) {
      setSellToolsOpen(true);
    }
  }, [orderMsg, sellNoBalanceMsg, tradeSide]);

  const handleDeposit = () => {
    if (setUseProxy) {
      setUseProxy(true);
    }
    onDeposit?.();
  };

  return (
    <div className="space-y-6">
      <TradeSideToggle tradeSide={tradeSide} setTradeSide={setTradeSide} tTrading={tTrading} />
      {isMultiOutcome ? (
        <MultiOutcomeQuickTable
          tradeOutcome={tradeOutcome}
          setTradeOutcome={setTradeOutcome}
          setTradeSide={setTradeSide}
          outcomes={outcomes}
          prediction={prediction}
          tTrading={tTrading}
          tCommon={tCommon}
        />
      ) : (
        <OutcomeSelector
          tradeOutcome={tradeOutcome}
          setTradeOutcome={setTradeOutcome}
          outcomes={outcomes}
          prediction={prediction}
          tTrading={tTrading}
          tCommon={tCommon}
        />
      )}
      <div className="space-y-4 pt-2">
        <PriceInputSection
          tradeSide={tradeSide}
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
          formatPrice={formatPrice}
          decodePrice={decodePrice}
          fillPrice={fillPrice}
          tTrading={tTrading}
          marketPlanPreview={marketPlanPreview}
          marketPlanLoading={marketPlanLoading}
          useProxy={useProxy}
          proxyBalance={proxyBalance}
          balance={balance}
          usdcAvailable={effectiveUsdcAvailable}
          usdcReserved={effectiveUsdcReserved}
        />
        <AmountInputSection
          amountInput={amountInput}
          setAmountInput={setAmountInput}
          balance={balance}
          tTrading={tTrading}
          tradeSide={tradeSide}
          currentShares={currentShares}
          orderMode={orderMode}
          priceInput={priceInput}
          useProxy={useProxy}
          proxyBalance={proxyBalance}
          usdcAvailable={effectiveUsdcAvailable}
          usdcReserved={effectiveUsdcReserved}
          setUseProxy={setUseProxy}
          onDeposit={handleDeposit}
        />
      </div>
      <TradeSummary
        total={total}
        potentialReturn={potentialReturn}
        profitPercent={profitPercent}
        tradeSide={tradeSide}
        price={priceNum}
        amount={amountNum}
        requestedAmount={requestedAmount}
        outcomeLabel={currentOutcomeLabel}
        tTrading={tTrading}
        orderMode={orderMode}
        marketPlanPreview={marketPlanPreview}
        marketPlanLoading={marketPlanLoading}
        currentShares={currentShares}
        feeRate={feeRate}
        positionStake={positionStake}
        markPrice={markPrice}
        markValue={markValue}
        unrealizedPnl={unrealizedPnl}
        unrealizedPct={unrealizedPct}
      />
      <TradeSubmitSection
        tradeSide={tradeSide}
        submitOrder={() => submitOrder({ useProxy, proxyAddress })}
        isSubmitting={isSubmitting}
        market={market}
        currentOutcomeLabel={currentOutcomeLabel}
        orderMsg={orderMsg}
        canSubmit={canSubmit}
        disabledReason={disabledReason}
        useProxy={useProxy}
        onDeposit={handleDeposit}
        tTrading={tTrading}
        tCommon={tCommon}
        tAuth={tAuth}
        tWallet={tWallet}
      />
      {tradeSide === "sell" && (
        <div className="border-t border-dashed border-gray-200 pt-4 mt-2">
          <button
            type="button"
            onClick={() => setSellToolsOpen((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            <span>{tTrading("hints.sellToolsTitle")}</span>
            <span className="text-gray-400">
              {sellToolsOpen ? tTrading("hints.hide") : tTrading("hints.show")}
            </span>
          </button>
          {sellToolsOpen && (
            <MintRedeemPanel
              mintInput={mintInput}
              setMintInput={setMintInput}
              handleMint={handleMint}
              handleRedeem={handleRedeem}
              tTrading={tTrading}
            />
          )}
        </div>
      )}
    </div>
  );
}

type TradeSideToggleProps = {
  tradeSide: "buy" | "sell";
  setTradeSide: (s: "buy" | "sell") => void;
  tTrading: (key: string) => string;
};

function TradeSideToggle({ tradeSide, setTradeSide, tTrading }: TradeSideToggleProps) {
  return (
    <div className="bg-gray-100 p-1 rounded-xl flex">
      <button
        onClick={() => setTradeSide("buy")}
        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
          tradeSide === "buy"
            ? "bg-white text-emerald-600 shadow-sm ring-1 ring-gray-200"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <ArrowUp className="w-4 h-4" /> {tTrading("buy")}
      </button>
      <button
        onClick={() => setTradeSide("sell")}
        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
          tradeSide === "sell"
            ? "bg-white text-rose-600 shadow-sm ring-1 ring-gray-200"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <ArrowDown className="w-4 h-4" /> {tTrading("sell")}
      </button>
    </div>
  );
}

type OutcomeSelectorProps = {
  tradeOutcome: number;
  setTradeOutcome: (i: number) => void;
  outcomes: any[];
  prediction: any;
  tTrading: (key: string) => string;
  tCommon: (key: string) => string;
};

function OutcomeSelector({
  tradeOutcome,
  setTradeOutcome,
  outcomes,
  prediction,
  tTrading,
  tCommon,
}: OutcomeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        {tTrading("selectOutcome")}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {outcomes.map((o, idx) => {
          const isSelected = tradeOutcome === idx;
          const isYes = idx === 0;
          const probSource =
            prediction?.stats &&
            (isYes ? prediction.stats.yesProbability : prediction.stats.noProbability);
          const chance =
            probSource != null && probSource !== 0 ? formatPercent(probSource * 100) : "-";

          return (
            <button
              key={idx}
              onClick={() => setTradeOutcome(idx)}
              className={`relative flex flex-col items-start p-4 rounded-2xl border-2 transition-all ${
                isSelected
                  ? "border-purple-500 bg-purple-50/50 shadow-md"
                  : "border-gray-100 bg-white hover:border-purple-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span
                  className={`text-lg font-black ${isSelected ? "text-purple-700" : "text-gray-700"}`}
                >
                  {o.label || (isYes ? tCommon("yes") : tCommon("no"))}
                </span>
                {isSelected && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500">
                    <ArrowUp className="h-3 w-3 text-white rotate-45" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                  {chance} {tTrading("hints.chance")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type MultiOutcomeQuickTableProps = {
  tradeOutcome: number;
  setTradeOutcome: (i: number) => void;
  setTradeSide: (s: "buy" | "sell") => void;
  outcomes: any[];
  prediction: any;
  tTrading: (key: string) => string;
  tCommon: (key: string) => string;
};

function MultiOutcomeQuickTable({
  tradeOutcome,
  setTradeOutcome,
  setTradeSide,
  outcomes,
  prediction,
  tTrading,
  tCommon,
}: MultiOutcomeQuickTableProps) {
  const rawOutcomes = outcomes || [];
  const stats = prediction?.stats;
  const items =
    rawOutcomes.length > 0 ? rawOutcomes : [{ label: tCommon("yes") }, { label: tCommon("no") }];

  const displayItems = items.map((outcome: any, idx: number) => {
    let prob = 0;
    if (outcome.probability !== undefined) {
      prob = Number(outcome.probability);
    } else if (items.length === 2 && stats) {
      if (idx === 0) prob = stats.yesProbability || 0;
      else prob = stats.noProbability || 0;
    }
    if (!Number.isFinite(prob)) prob = 0;
    const probPct = Math.max(0, Math.min(100, prob <= 1 ? prob * 100 : prob));
    const buyPrice = probPct;
    const sellPrice = 100 - probPct;
    return { outcome, idx, probPct, buyPrice, sellPrice };
  });

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
        {tTrading("selectOutcome")}
      </label>
      <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 bg-white">
        {displayItems.map(({ outcome, idx, probPct, buyPrice, sellPrice }) => {
          const isSelected = tradeOutcome === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setTradeOutcome(idx)}
              className={`w-full px-3 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition-colors ${
                isSelected ? "bg-purple-50/60" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-2 w-2 rounded-full bg-purple-400" />
                <span className="font-medium text-gray-800 truncate">
                  {outcome.label || (idx === 0 ? tCommon("yes") : tCommon("no"))}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[11px] font-semibold text-purple-600">
                    {formatPercent(probPct)}{" "}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {formatInteger(buyPrice)}¢ / {formatInteger(sellPrice)}¢
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTradeOutcome(idx);
                      setTradeSide("buy");
                    }}
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    {tTrading("buy")}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTradeOutcome(idx);
                      setTradeSide("sell");
                    }}
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  >
                    {tTrading("sell")}
                  </button>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type PriceInputSectionProps = {
  tradeSide: "buy" | "sell";
  orderMode: "limit" | "best";
  setOrderMode: (m: "limit" | "best") => void;
  tif: "GTC" | "IOC" | "FOK";
  setTif: (t: "GTC" | "IOC" | "FOK") => void;
  postOnly: boolean;
  setPostOnly: (v: boolean) => void;
  maxSlippage: number;
  setMaxSlippage: (v: number) => void;
  bestBid: string;
  bestAsk: string;
  priceInput: string;
  setPriceInput: (v: string) => void;
  formatPrice: (p: string, showCents?: boolean) => string;
  decodePrice: (p: string) => number;
  fillPrice: (p: string) => void;
  tTrading: (key: string) => string;
  marketPlanPreview: MarketPlanPreview | null;
  marketPlanLoading: boolean;
  useProxy?: boolean;
  proxyBalance?: string;
  balance?: string;
  usdcAvailable?: number;
  usdcReserved?: number;
};

function PriceInputSection({
  tradeSide,
  orderMode,
  setOrderMode,
  tif,
  setTif,
  postOnly,
  setPostOnly,
  maxSlippage,
  setMaxSlippage,
  bestBid,
  bestAsk,
  priceInput,
  setPriceInput,
  formatPrice,
  decodePrice,
  fillPrice,
  tTrading,
  marketPlanPreview,
  marketPlanLoading,
  useProxy,
  proxyBalance,
  balance,
  usdcAvailable,
  usdcReserved,
}: PriceInputSectionProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const limitPriceValue = parseFloat(priceInput || "0");
  const limitPriceOk =
    Number.isFinite(limitPriceValue) && limitPriceValue > 0 && limitPriceValue < 1;
  let worstPriceLabel = "";
  if (orderMode === "best") {
    const limit =
      marketPlanPreview && marketPlanPreview.worstPrice > 0
        ? marketPlanPreview.worstPrice
        : (() => {
            if (maxSlippage <= 0) return 0;
            const raw = tradeSide === "buy" ? bestAsk : bestBid;
            const best = decodePrice(raw);
            if (best <= 0) return 0;
            return tradeSide === "buy"
              ? Math.min(1, best * (1 + maxSlippage / 100))
              : Math.max(0, best * (1 - maxSlippage / 100));
          })();
    if (limit > 0) {
      if (limit < 1) {
        worstPriceLabel = (limit * 100).toFixed(1) + "¢";
      } else {
        worstPriceLabel = "$" + limit.toFixed(2);
      }
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium text-gray-500">
        <div className="flex items-center gap-2">
          <span>{tTrading("price")}</span>
          {tradeSide === "buy" && (
            <span className="text-[10px] text-gray-400 font-normal">
              {(() => {
                const avail =
                  typeof usdcAvailable === "number" && Number.isFinite(usdcAvailable)
                    ? usdcAvailable.toFixed(2)
                    : null;
                const reserved =
                  typeof usdcReserved === "number" &&
                  Number.isFinite(usdcReserved) &&
                  usdcReserved > 0
                    ? usdcReserved.toFixed(2)
                    : null;
                const label = useProxy && proxyBalance ? "Proxy" : "Wallet";
                if (avail) {
                  return reserved
                    ? `(${label}: Avail ${avail}, Res ${reserved})`
                    : `(${label}: Avail ${avail})`;
                }
                if (useProxy && proxyBalance) return `(Proxy: ${proxyBalance})`;
                const raw = balance?.replace("USDC", "").trim();
                return raw ? `(Bal: ${raw})` : "";
              })()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setOrderMode("best")}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              orderMode === "best"
                ? "bg-purple-100 text-purple-700 font-bold"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {tTrading("marketOrder")}
          </button>
          <button
            onClick={() => setOrderMode("limit")}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              orderMode === "limit"
                ? "bg-purple-100 text-purple-700 font-bold"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {tTrading("limitOrder")}
          </button>
        </div>
      </div>

      {orderMode === "best" ? (
        <div className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-500 font-medium flex justify-between items-center cursor-not-allowed">
          <span>{tTrading("autoMatchBest")}</span>
          <span className="text-gray-900 font-bold">
            {tradeSide === "buy" ? formatPrice(bestAsk, true) : formatPrice(bestBid, true)}
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative group">
            <input
              type="number"
              value={priceInput}
              inputMode="decimal"
              onKeyDown={(e) => {
                if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                  e.preventDefault();
                }
              }}
              onChange={(e) => {
                const next = e.target.value;
                if (/e/i.test(next) || next.startsWith("-")) return;
                setPriceInput(next);
              }}
              placeholder="0.00"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-4 pr-10 text-gray-900 font-medium focus:outline-none focus:border-purple-500 focus:bg-purple-50/30 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder-gray-400"
            />
            <span className="absolute right-4 top-3.5 text-gray-400 font-medium">$</span>
          </div>
          {limitPriceOk && (
            <div className="text-[11px] text-gray-500 text-right">
              {tTrading("hints.impliedProbability")}: {formatPercent(limitPriceValue * 100)}
            </div>
          )}
          <div className="flex justify-end gap-2 text-[10px] text-gray-500">
            <button
              type="button"
              onClick={() => {
                const current = parseFloat(priceInput || "0") || 0;
                const next = Math.max(0.01, current - 0.01);
                setPriceInput(next.toFixed(2));
              }}
              className="px-2 py-0.5 rounded-full border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
            >
              -0.01
            </button>
            <button
              type="button"
              onClick={() => {
                const current = parseFloat(priceInput || "0") || 0;
                const next = Math.min(0.99, current + 0.01);
                setPriceInput(next.toFixed(2));
              }}
              className="px-2 py-0.5 rounded-full border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
            >
              +0.01
            </button>
          </div>
        </div>
      )}

      {orderMode === "best" && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Info className="w-3 h-3" />
              {tTrading("hints.marketOrderOnchain")}
            </span>
          </div>
          <div className="flex gap-2 text-[10px] font-semibold text-gray-500">
            <span>{tTrading("maxSlippage")}</span>
            <button
              onClick={() => setMaxSlippage(1)}
              className={`px-2 py-0.5 rounded-full border ${
                maxSlippage === 1
                  ? "border-purple-400 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              1%
            </button>
            <button
              onClick={() => setMaxSlippage(3)}
              className={`px-2 py-0.5 rounded-full border ${
                maxSlippage === 3
                  ? "border-purple-400 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              3%
            </button>
            <button
              onClick={() => setMaxSlippage(5)}
              className={`px-2 py-0.5 rounded-full border ${
                maxSlippage === 5
                  ? "border-purple-400 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              5%
            </button>
          </div>
          {worstPriceLabel && (
            <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 pt-1">
              <span>{tTrading("worstExecutionPrice")}</span>
              <span className="text-gray-900">{worstPriceLabel}</span>
            </div>
          )}
        </div>
      )}

      {orderMode === "limit" && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Info className="w-3 h-3" />
              {tTrading("hints.limitOrderSigned")}
            </span>
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="text-[11px] font-semibold text-purple-600 hover:text-purple-700"
            >
              {advancedOpen ? tTrading("hints.hideAdvanced") : tTrading("hints.showAdvanced")}
            </button>
          </div>
          {advancedOpen && (
            <div className="flex gap-2 text-[10px] font-semibold text-gray-500">
              <button
                type="button"
                onClick={() => setTif("GTC")}
                className={`px-2 py-0.5 rounded-full border ${
                  tif === "GTC"
                    ? "border-purple-400 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                GTC
              </button>
              <button
                type="button"
                onClick={() => setTif("IOC")}
                className={`px-2 py-0.5 rounded-full border ${
                  tif === "IOC"
                    ? "border-purple-400 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                IOC
              </button>
              <button
                type="button"
                onClick={() => setTif("FOK")}
                className={`px-2 py-0.5 rounded-full border ${
                  tif === "FOK"
                    ? "border-purple-400 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                FOK
              </button>
              <button
                type="button"
                onClick={() => setPostOnly(!postOnly)}
                className={`ml-auto px-2 py-0.5 rounded-full border ${
                  postOnly
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                {tTrading("hints.postOnly")}
              </button>
            </div>
          )}
          <div className="flex gap-3 text-xs font-medium justify-end">
            <button
              onClick={() => fillPrice(formatPrice(bestBid))}
              className="text-emerald-600 hover:text-emerald-700 hover:underline decoration-emerald-600/30"
            >
              {String(tTrading("bestBid") || "").replace("{price}", formatPrice(bestBid, true))}
            </button>
            <button
              onClick={() => fillPrice(formatPrice(bestAsk))}
              className="text-rose-600 hover:text-rose-700 hover:underline decoration-rose-600/30"
            >
              {String(tTrading("bestAsk") || "").replace("{price}", formatPrice(bestAsk, true))}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type AmountInputSectionProps = {
  amountInput: string;
  setAmountInput: (v: string) => void;
  balance: string;
  tTrading: (key: string) => string;
  tradeSide: "buy" | "sell";
  currentShares: number;
  orderMode: "limit" | "best";
  priceInput: string;
  useProxy?: boolean;
  proxyBalance?: string;
  usdcAvailable?: number;
  usdcReserved?: number;
  onDeposit?: () => void;
  setUseProxy?: (v: boolean) => void;
};

function AmountInputSection({
  amountInput,
  setAmountInput,
  balance,
  tTrading,
  tradeSide,
  currentShares,
  orderMode,
  priceInput,
  useProxy,
  proxyBalance,
  usdcAvailable,
  usdcReserved,
  setUseProxy,
  onDeposit,
}: AmountInputSectionProps) {
  const normalizeTo6Decimals = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return trimmed;
    const rounded = Math.round(n * 1_000_000) / 1_000_000;
    const fixed = rounded.toFixed(6);
    return fixed.replace(/\.?0+$/, "");
  };

  const decimalsCount = (() => {
    const v = amountInput || "";
    const idx = v.indexOf(".");
    if (idx < 0) return 0;
    return Math.max(0, v.length - idx - 1);
  })();
  const hasTooManyDecimals = decimalsCount > 6;

  const effectiveUsdcAvailable =
    typeof usdcAvailable === "number" && Number.isFinite(usdcAvailable) ? usdcAvailable : 0;
  const priceValue = parseFloat(priceInput || "0") || 0;
  const showSellButtons = tradeSide === "sell" && currentShares > 0;
  const showBuyMax =
    tradeSide === "buy" && orderMode === "limit" && effectiveUsdcAvailable > 0 && priceValue > 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium text-gray-500">
        <span>
          {tTrading("amount")} ({tTrading("sharesUnit")})
        </span>
        <div className="flex items-center gap-2">
          {setUseProxy && (
            <label className="flex items-center gap-1 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={!!useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-3 h-3 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 group-hover:text-purple-600 transition-colors">
                Proxy Wallet
              </span>
            </label>
          )}
          <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md">
            <Wallet className="w-3 h-3" />
            {tradeSide === "sell"
              ? formatNumber(currentShares, undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })
              : (() => {
                  const avail =
                    effectiveUsdcAvailable > 0 ? effectiveUsdcAvailable.toFixed(2) : "0.00";
                  const reserved =
                    typeof usdcReserved === "number" &&
                    Number.isFinite(usdcReserved) &&
                    usdcReserved > 0
                      ? usdcReserved.toFixed(2)
                      : null;
                  const label = useProxy && proxyBalance ? "Proxy" : "Wallet";
                  return reserved
                    ? `USDC ${avail} (Avail · Res ${reserved} · ${label})`
                    : `USDC ${avail} (Avail · ${label})`;
                })()}
          </span>
          {onDeposit && (useProxy || !!setUseProxy) && (
            <button
              onClick={onDeposit}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
              title="Deposit"
            >
              <span className="text-[10px] font-bold leading-none">Deposit</span>
            </button>
          )}
        </div>
      </div>
      <input
        type="number"
        step="0.000001"
        inputMode="decimal"
        value={amountInput}
        onKeyDown={(e) => {
          if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
            e.preventDefault();
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          if (/e/i.test(next) || next.startsWith("-")) return;
          setAmountInput(next);
        }}
        onBlur={() => {
          if (!amountInput) return;
          const next = normalizeTo6Decimals(amountInput);
          if (next !== amountInput) setAmountInput(next);
        }}
        placeholder="0"
        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4 text-gray-900 font-medium focus:outline-none focus:border-purple-500 focus:bg-purple-50/30 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder-gray-400"
      />
      {hasTooManyDecimals && (
        <div className="text-[11px] text-amber-600">{tTrading("hints.maxSixDecimals")}</div>
      )}
      {(showSellButtons || showBuyMax) && (
        <div className="flex justify-end gap-2 pt-1 text-[11px] text-gray-500">
          {showSellButtons && (
            <>
              <button
                onClick={() => setAmountInput(normalizeTo6Decimals(String(currentShares * 0.25)))}
                className="px-2 py-0.5 rounded-full border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
              >
                25%
              </button>
              <button
                onClick={() => setAmountInput(normalizeTo6Decimals(String(currentShares * 0.5)))}
                className="px-2 py-0.5 rounded-full border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
              >
                50%
              </button>
              <button
                onClick={() => setAmountInput(normalizeTo6Decimals(String(currentShares)))}
                className="px-2 py-0.5 rounded-full border border-purple-400 bg-purple-50 text-purple-700 font-semibold"
              >
                {tTrading("hints.max")}
              </button>
            </>
          )}
          {showBuyMax && (
            <button
              onClick={() => {
                const maxShares = effectiveUsdcAvailable / priceValue;
                if (maxShares > 0) {
                  setAmountInput(normalizeTo6Decimals(String(maxShares)));
                }
              }}
              className="px-2 py-0.5 rounded-full border border-purple-400 bg-purple-50 text-purple-700 font-semibold"
            >
              {tTrading("hints.max")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type TradeSummaryProps = {
  total: number;
  potentialReturn: number;
  profitPercent: number;
  tradeSide: "buy" | "sell";
  price: number;
  amount: number;
  requestedAmount: number;
  outcomeLabel: string;
  tTrading: (key: string) => string;
  orderMode: "limit" | "best";
  marketPlanPreview: MarketPlanPreview | null;
  marketPlanLoading: boolean;
  currentShares: number;
  positionStake?: number;
  markPrice?: number;
  markValue?: number;
  unrealizedPnl?: number;
  unrealizedPct?: number;
  feeRate: number;
};

function TradeSummary({
  total,
  potentialReturn,
  profitPercent,
  tradeSide,
  price,
  amount,
  requestedAmount,
  outcomeLabel,
  tTrading,
  orderMode,
  marketPlanPreview,
  marketPlanLoading,
  currentShares,
  positionStake,
  markPrice,
  markValue,
  unrealizedPnl,
  unrealizedPct,
  feeRate,
}: TradeSummaryProps) {
  const hasInput = price > 0 && amount > 0;
  const estimatedFee = hasInput ? total * feeRate : 0;
  const sideLabel = tradeSide === "buy" ? tTrading("buy") : tTrading("sell");
  const sideColor =
    tradeSide === "buy"
      ? "text-emerald-600 bg-emerald-50 border-emerald-100"
      : "text-rose-600 bg-rose-50 border-rose-100";

  const stakeBefore = positionStake && positionStake > 0 ? positionStake : 0;
  const avgBefore = stakeBefore > 0 && currentShares > 0 ? stakeBefore / currentShares : 0;

  let filledForPosition = amount;
  if (orderMode === "best" && marketPlanPreview && marketPlanPreview.filledAmount > 0) {
    filledForPosition = marketPlanPreview.filledAmount;
  }
  let deltaShares = 0;
  if (filledForPosition > 0) {
    deltaShares = tradeSide === "buy" ? filledForPosition : -filledForPosition;
  }
  const afterSharesRaw = currentShares + deltaShares;
  const afterShares = afterSharesRaw > 0 ? afterSharesRaw : 0;
  const hasPosition = currentShares > 0;
  const deltaPrefix = deltaShares > 0 ? "+" : deltaShares < 0 ? "−" : "";

  let stakeAfter = stakeBefore;
  if (deltaShares !== 0 && total > 0) {
    if (tradeSide === "buy") {
      stakeAfter = stakeBefore + total;
    } else {
      stakeAfter = Math.max(0, stakeBefore - total);
    }
  }
  const avgAfter = stakeAfter > 0 && afterShares > 0 ? stakeAfter / afterShares : 0;
  const showImpact = total > 0 && (hasPosition || deltaShares !== 0);

  let requestedShares = 0;
  if (orderMode === "best" && requestedAmount > 0) {
    requestedShares = requestedAmount;
  }
  let fillPercent = 0;
  if (orderMode === "best" && marketPlanPreview && requestedShares > 0) {
    fillPercent = (marketPlanPreview.filledAmount / requestedShares) * 100;
    if (!Number.isFinite(fillPercent)) fillPercent = 0;
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-4 text-sm border border-gray-100">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">{tTrading("totalInvestment")}</span>
          <span className="text-gray-900 font-bold text-base">{formatCurrency(total)}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500">{tTrading("preview.feeEstimated")}</span>
          <span className="text-gray-700 font-medium">
            {formatCurrency(estimatedFee)}{" "}
            <span className="ml-1 text-[11px] text-gray-400">({formatPercent(feeRate * 100)})</span>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">{tTrading("potentialReturn")}</span>
          <span className="text-emerald-600 font-bold text-base flex items-center gap-1">
            {formatCurrency(potentialReturn)}
            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-medium">
              +{formatPercent(profitPercent)}
            </span>
          </span>
        </div>
      </div>
      <div className="pt-3 border-t border-dashed border-gray-200 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-600">{tTrading("preview.title")}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sideColor}`}
          >
            {sideLabel} {outcomeLabel}
          </span>
        </div>
        {hasInput ? (
          <div className="space-y-1.5 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>{tTrading("preview.priceTimesAmount")}</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(price)} ×{" "}
                {formatNumber(amount, undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                = {formatCurrency(total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>
                {tradeSide === "buy"
                  ? tTrading("preview.thisTradePay")
                  : tTrading("preview.thisTradeReceive")}
              </span>
              <span className="font-medium text-gray-900">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">{tTrading("preview.ifOutcomeHappens")}</span>
              <span className="font-medium text-emerald-600">
                {tTrading("preview.positionValuePrefix")}
                {formatCurrency(potentialReturn)}
                {tTrading("preview.positionValueMiddle")}
                {formatPercent(profitPercent)}
              </span>
            </div>
            {orderMode === "best" && (
              <div className="pt-2 space-y-1.5 border-t border-dashed border-gray-200">
                {marketPlanLoading && (
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>{tTrading("preview.loadingSlippage")}</span>
                    <Loader2 className="w-3 h-3 animate-spin" />
                  </div>
                )}
                {marketPlanPreview && (
                  <>
                    <div className="flex justify-between">
                      <span>{tTrading("preview.avgExecutionPrice")}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(marketPlanPreview.avgPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tTrading("preview.worstExecutionPriceShort")}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(marketPlanPreview.worstPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tTrading("preview.slippage")}</span>
                      <span className="font-medium text-gray-900">
                        {formatPercent(marketPlanPreview.slippagePercent)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{tTrading("preview.estimatedFilledAmount")}</span>
                      <span className="font-medium text-gray-900">
                        {requestedShares > 0
                          ? (() => {
                              const filled = marketPlanPreview.filledAmount;
                              const filledStr = formatNumber(filled, undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });
                              const reqStr = formatNumber(requestedShares, undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });
                              const pctStr = formatPercent(fillPercent);
                              return `${filledStr} / ${reqStr} ${tTrading("sharesUnit")} (${pctStr})`;
                            })()
                          : `${formatNumber(marketPlanPreview.filledAmount, undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} ${tTrading("sharesUnit")}`}
                      </span>
                    </div>
                    {marketPlanPreview.partialFill && (
                      <div className="text-[11px] text-amber-600">
                        {tTrading("preview.partialFillHint")}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-400">{tTrading("preview.empty")}</div>
        )}
      </div>
      {hasPosition && (
        <div className="mt-3 border-t border-dashed border-gray-200 pt-2 space-y-1.5 text-[11px] text-gray-500">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-500">
              {tTrading("preview.positionImpactTitle")}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{tTrading("preview.currentPositionShares")}</span>
            <span className="font-medium text-gray-900">
              {formatNumber(currentShares, undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              {tTrading("sharesUnit")}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{tTrading("preview.currentStake")}</span>
            <span className="font-medium text-gray-900">{formatCurrency(stakeBefore)}</span>
          </div>
          <div className="flex justify-between">
            <span>{tTrading("preview.currentAvgPrice")}</span>
            <span className="font-medium text-gray-900">
              {avgBefore > 0 ? formatCurrency(avgBefore) : "-"}
            </span>
          </div>
          {(() => {
            const priceOk = typeof markPrice === "number" && markPrice > 0;
            const pnlValue = typeof unrealizedPnl === "number" ? unrealizedPnl : 0;
            const pnlPct = typeof unrealizedPct === "number" ? unrealizedPct : 0;
            const hasMarkPnl = priceOk && stakeBefore > 0 && currentShares > 0;
            const pnlPositive = pnlValue > 0;
            const pnlNegative = pnlValue < 0;
            if (!hasMarkPnl) return null;
            return (
              <>
                <div className="flex justify-between">
                  <span>{tTrading("preview.markPrice")}</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(markPrice as number)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{tTrading("preview.markPnl")}</span>
                  <span
                    className={`font-bold ${
                      pnlNegative
                        ? "text-rose-600"
                        : pnlPositive
                          ? "text-emerald-600"
                          : "text-gray-900"
                    }`}
                  >
                    {pnlPositive ? "+" : ""}
                    {formatCurrency(pnlValue)}
                    {stakeBefore > 0 && (
                      <span className="ml-1 text-[10px]">
                        ({pnlPct > 0 ? "+" : ""}
                        {formatPercent(Math.abs(pnlPct))})
                      </span>
                    )}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}
      {showImpact && (
        <div className="mt-2 space-y-1.5 text-[11px] text-gray-500">
          <div className="flex justify-between">
            <span>{tTrading("preview.thisTradeDeltaShares")}</span>
            <span
              className={`font-medium ${
                deltaShares === 0
                  ? "text-gray-900"
                  : tradeSide === "buy"
                    ? "text-emerald-600"
                    : "text-rose-600"
              }`}
            >
              {deltaPrefix}
              {formatNumber(Math.abs(deltaShares), undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              {tTrading("sharesUnit")}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{tTrading("preview.afterTradeShares")}</span>
            <span className="font-bold text-gray-900">
              {formatNumber(afterShares, undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              {tTrading("sharesUnit")}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{tTrading("preview.afterTradeStake")}</span>
            <span className="font-bold text-gray-900">{formatCurrency(stakeAfter)}</span>
          </div>
          <div className="flex justify-between">
            <span>{tTrading("preview.afterTradeAvgPrice")}</span>
            <span className="font-bold text-gray-900">
              {avgAfter > 0 ? formatCurrency(avgAfter) : "-"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

type TradeSubmitSectionProps = {
  tradeSide: "buy" | "sell";
  submitOrder: () => void;
  isSubmitting: boolean;
  market: any;
  currentOutcomeLabel: string;
  orderMsg: string | null;
  canSubmit: boolean;
  disabledReason: string | null;
  useProxy?: boolean;
  onDeposit?: () => void;
  tTrading: (key: string) => string;
  tCommon: (key: string) => string;
  tAuth: (key: string) => string;
  tWallet: (key: string) => string;
};

function TradeSubmitSection({
  tradeSide,
  submitOrder,
  isSubmitting,
  market,
  currentOutcomeLabel,
  orderMsg,
  canSubmit,
  disabledReason,
  useProxy,
  onDeposit,
  tTrading,
  tCommon,
  tAuth,
  tWallet,
}: TradeSubmitSectionProps) {
  const positiveMessages = new Set([
    tTrading("orderFlow.filled"),
    tTrading("orderFlow.partialFilled"),
    tTrading("orderFlow.orderSuccess"),
    tTrading("orderFlow.canceled"),
    tTrading("orderFlow.approving"),
    tTrading("orderFlow.outcomeTokenApproving"),
    tTrading("orderFlow.approveThenPlace"),
    tTrading("orderFlow.matchingInProgress"),
  ]);
  const isPositiveMsg = !!orderMsg && positiveMessages.has(orderMsg);
  const walletRequiredMsg = tTrading("orderFlow.walletRequired");
  const walletNotReadyMsg = tTrading("orderFlow.walletNotReady");
  const sellNoBalanceMsg = tTrading("orderFlow.sellNoBalance");
  const fetchPlanFailedMsg = tTrading("orderFlow.fetchPlanFailed");
  const rpcTimeoutMsg = tTrading("orderFlow.rpcTimeout");
  const tradeFailedMsg = tTrading("orderFlow.tradeFailed");
  const insufficientFundsMsg = tTrading("orderFlow.insufficientFunds");
  const marketClosedMsg = tTrading("orderFlow.marketClosed");
  const invalidAmountMsg = tTrading("orderFlow.invalidAmount");
  const invalidAmountPrecisionMsg = tTrading("orderFlow.invalidAmountPrecision");
  const invalidPriceMsg = tTrading("orderFlow.invalidPrice");
  const slippageTooHighMsg = tTrading("orderFlow.slippageTooHigh");
  const insufficientLiquidityMsg = tTrading("orderFlow.insufficientLiquidity");
  const noFillableOrdersMsg = tTrading("orderFlow.noFillableOrders");
  const canOfferDeposit = !!onDeposit;
  const showDepositForDisabled =
    canOfferDeposit && !!disabledReason && disabledReason === insufficientFundsMsg;
  const showDepositForOrderMsg = canOfferDeposit && !!orderMsg && orderMsg === insufficientFundsMsg;

  const switchNetworkMsg = String(tTrading("orderFlow.switchNetwork") || "").replace(
    "{chainId}",
    String(market?.chain_id ?? "")
  );

  const needsWallet =
    !!orderMsg && (orderMsg === walletRequiredMsg || orderMsg === walletNotReadyMsg);
  const needsSwitchNetwork =
    !!orderMsg &&
    (orderMsg === switchNetworkMsg ||
      (String(market?.chain_id || "") &&
        orderMsg.includes("Chain ID") &&
        orderMsg.includes(String(market?.chain_id || ""))));
  const needsMint = !!orderMsg && orderMsg.includes(sellNoBalanceMsg);
  const nonRetryMessages = new Set([
    walletRequiredMsg,
    walletNotReadyMsg,
    switchNetworkMsg,
    sellNoBalanceMsg,
    insufficientFundsMsg,
    marketClosedMsg,
    invalidAmountMsg,
    invalidAmountPrecisionMsg,
    invalidPriceMsg,
    slippageTooHighMsg,
    insufficientLiquidityMsg,
    noFillableOrdersMsg,
  ]);
  const shouldOfferRetry = !!orderMsg && !isPositiveMsg && !nonRetryMessages.has(orderMsg);

  const openWalletModal = () => {
    window.dispatchEvent(new CustomEvent("fs:open-wallet-modal"));
  };

  const requestSwitchNetwork = () => {
    const chainIdNum = Number(market?.chain_id);
    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) return;
    window.dispatchEvent(new CustomEvent("fs:switch-network", { detail: { chainId: chainIdNum } }));
  };

  const scrollToMint = () => {
    const el = document.getElementById("mint-redeem-panel");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-3">
      <button
        onClick={submitOrder}
        disabled={isSubmitting || !market || !canSubmit}
        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 ${
          isSubmitting || !market || !canSubmit
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
      {!orderMsg && disabledReason && (
        <div className="space-y-2">
          <div className="text-center text-xs font-medium p-2.5 rounded-lg flex items-center justify-center gap-2 bg-amber-50 text-amber-700 border border-amber-100">
            <Info className="w-3.5 h-3.5" />
            {disabledReason}
          </div>
          {showDepositForDisabled && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => onDeposit?.()}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
              >
                <Wallet className="w-3.5 h-3.5" />
                {tWallet("deposit")}
              </button>
            </div>
          )}
        </div>
      )}
      {orderMsg && (
        <div className="space-y-2">
          <div
            className={`text-center text-xs font-medium p-2.5 rounded-lg flex items-center justify-center gap-2 ${
              isPositiveMsg
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-rose-50 text-rose-600 border border-rose-100"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            {orderMsg}
          </div>

          {!isPositiveMsg &&
            (needsWallet || needsSwitchNetwork || needsMint || shouldOfferRetry) && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {needsWallet && (
                  <button
                    type="button"
                    onClick={openWalletModal}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    {tAuth("connectWallet")}
                  </button>
                )}
                {needsSwitchNetwork && (
                  <button
                    type="button"
                    onClick={requestSwitchNetwork}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    {tWallet("switchNetwork")}
                  </button>
                )}
                {needsMint && (
                  <button
                    type="button"
                    onClick={scrollToMint}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    {tTrading("mintPanel.mint")}
                  </button>
                )}
                {shouldOfferRetry && (
                  <button
                    type="button"
                    onClick={submitOrder}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                  >
                    {tCommon("retry")}
                  </button>
                )}
                {showDepositForOrderMsg && (
                  <button
                    type="button"
                    onClick={() => onDeposit?.()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-purple-300 hover:text-purple-700"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    {tWallet("deposit")}
                  </button>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

type MintRedeemPanelProps = {
  mintInput: string;
  setMintInput: (v: string) => void;
  handleMint: (amount: string) => void;
  handleRedeem: (amount: string) => void;
  tTrading: (key: string) => string;
};

function MintRedeemPanel({
  mintInput,
  setMintInput,
  handleMint,
  handleRedeem,
  tTrading,
}: MintRedeemPanelProps) {
  return (
    <div id="mint-redeem-panel" className="border-t border-dashed border-gray-200 pt-4 mt-2">
      <div className="bg-purple-50/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
            {tTrading("mintPanel.title")}
          </span>
          <span className="text-[10px] text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
            {tTrading("mintPanel.subtitle")}
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            value={mintInput}
            onChange={(e) => setMintInput(e.target.value)}
            placeholder={tTrading("mintPanel.amountPlaceholder")}
            className="flex-1 bg-white border border-purple-100 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-purple-500"
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={() => mintInput && handleMint(mintInput)}
              disabled={!mintInput}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 shadow-sm hover:from-purple-400 hover:to-pink-400 hover:text-white transition-all disabled:opacity-50"
            >
              {tTrading("mintPanel.mint")}
            </button>
            <button
              onClick={() => mintInput && handleRedeem(mintInput)}
              disabled={!mintInput}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 disabled:opacity-50"
            >
              {tTrading("mintPanel.redeem")}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-purple-500/80 leading-relaxed">
          {tTrading("mintPanel.description")}
        </p>
      </div>
    </div>
  );
}
