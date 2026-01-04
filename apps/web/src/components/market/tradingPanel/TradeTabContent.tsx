import { ArrowDown, ArrowUp, Info, Loader2, Wallet } from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
export type TradeTabContentProps = {
  tradeSide: "buy" | "sell";
  setTradeSide: (s: "buy" | "sell") => void;
  tradeOutcome: number;
  setTradeOutcome: (i: number) => void;
  outcomes: any[];
  prediction: any;
  tTrading: (key: string) => string;
  tCommon: (key: string) => string;
  orderMode: "limit" | "best";
  setOrderMode: (m: "limit" | "best") => void;
  bestBid: string;
  bestAsk: string;
  priceInput: string;
  setPriceInput: (v: string) => void;
  amountInput: string;
  setAmountInput: (v: string) => void;
  balance: string;
  submitOrder: () => void;
  isSubmitting: boolean;
  market: any;
  orderMsg: string | null;
  mintInput: string;
  setMintInput: (v: string) => void;
  handleMint: (amount: string) => void;
  handleRedeem: (amount: string) => void;
  formatPrice: (p: string, showCents?: boolean) => string;
  fillPrice: (p: string) => void;
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
  orderMode,
  setOrderMode,
  bestBid,
  bestAsk,
  priceInput,
  setPriceInput,
  amountInput,
  setAmountInput,
  balance,
  submitOrder,
  isSubmitting,
  market,
  orderMsg,
  mintInput,
  setMintInput,
  handleMint,
  handleRedeem,
  formatPrice,
  fillPrice,
}: TradeTabContentProps) {
  const priceNum = Number(priceInput) || 0;
  const amountNum = Number(amountInput) || 0;
  const total = priceNum * amountNum;
  const potentialReturn = tradeSide === "buy" ? amountNum * 1 : 0;
  const potentialProfit = tradeSide === "buy" ? amountNum - total : 0;
  const profitPercent = total > 0 ? (potentialProfit / total) * 100 : 0;

  const currentOutcomeLabel =
    outcomes[tradeOutcome]?.label || (tradeOutcome === 0 ? tCommon("yes") : tCommon("no"));

  return (
    <div className="space-y-6">
      <TradeSideToggle tradeSide={tradeSide} setTradeSide={setTradeSide} tTrading={tTrading} />
      <OutcomeSelector
        tradeOutcome={tradeOutcome}
        setTradeOutcome={setTradeOutcome}
        outcomes={outcomes}
        prediction={prediction}
        tTrading={tTrading}
        tCommon={tCommon}
      />
      <div className="space-y-4 pt-2">
        <PriceInputSection
          tradeSide={tradeSide}
          orderMode={orderMode}
          setOrderMode={setOrderMode}
          bestBid={bestBid}
          bestAsk={bestAsk}
          priceInput={priceInput}
          setPriceInput={setPriceInput}
          formatPrice={formatPrice}
          fillPrice={fillPrice}
          tTrading={tTrading}
        />
        <AmountInputSection
          amountInput={amountInput}
          setAmountInput={setAmountInput}
          balance={balance}
          tTrading={tTrading}
        />
      </div>
      <TradeSummary
        total={total}
        potentialReturn={potentialReturn}
        profitPercent={profitPercent}
        tradeSide={tradeSide}
        price={priceNum}
        amount={amountNum}
        outcomeLabel={currentOutcomeLabel}
        tTrading={tTrading}
      />
      <TradeSubmitSection
        tradeSide={tradeSide}
        submitOrder={submitOrder}
        isSubmitting={isSubmitting}
        market={market}
        currentOutcomeLabel={currentOutcomeLabel}
        orderMsg={orderMsg}
        tTrading={tTrading}
      />
      {tradeSide === "sell" && (
        <MintRedeemPanel
          mintInput={mintInput}
          setMintInput={setMintInput}
          handleMint={handleMint}
          handleRedeem={handleRedeem}
          tTrading={tTrading}
        />
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
                  {chance} Chance
                </span>
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
  bestBid: string;
  bestAsk: string;
  priceInput: string;
  setPriceInput: (v: string) => void;
  formatPrice: (p: string, showCents?: boolean) => string;
  fillPrice: (p: string) => void;
  tTrading: (key: string) => string;
};

function PriceInputSection({
  tradeSide,
  orderMode,
  setOrderMode,
  bestBid,
  bestAsk,
  priceInput,
  setPriceInput,
  formatPrice,
  fillPrice,
  tTrading,
}: PriceInputSectionProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium text-gray-500">
        <span>{tTrading("price")}</span>
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
        <div className="relative group">
          <input
            type="number"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="0.00"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-4 pr-10 text-gray-900 font-medium focus:outline-none focus:border-purple-500 focus:bg-purple-50/30 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder-gray-400"
          />
          <span className="absolute right-4 top-3.5 text-gray-400 font-medium">$</span>
        </div>
      )}

      {orderMode === "limit" && (
        <div className="flex gap-3 text-xs font-medium pt-1 justify-end">
          <button
            onClick={() => fillPrice(formatPrice(bestBid))}
            className="text-emerald-600 hover:text-emerald-700 hover:underline decoration-emerald-600/30"
          >
            Bid: {formatPrice(bestBid, true)}
          </button>
          <button
            onClick={() => fillPrice(formatPrice(bestAsk))}
            className="text-rose-600 hover:text-rose-700 hover:underline decoration-rose-600/30"
          >
            Ask: {formatPrice(bestAsk, true)}
          </button>
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
};

function AmountInputSection({
  amountInput,
  setAmountInput,
  balance,
  tTrading,
}: AmountInputSectionProps) {
  return (
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
  );
}

type TradeSummaryProps = {
  total: number;
  potentialReturn: number;
  profitPercent: number;
  tradeSide: "buy" | "sell";
  price: number;
  amount: number;
  outcomeLabel: string;
  tTrading: (key: string) => string;
};

function TradeSummary({
  total,
  potentialReturn,
  profitPercent,
  tradeSide,
  price,
  amount,
  outcomeLabel,
  tTrading,
}: TradeSummaryProps) {
  const hasInput = price > 0 && amount > 0;
  const sideLabel = tradeSide === "buy" ? tTrading("buy") : tTrading("sell");
  const sideColor =
    tradeSide === "buy"
      ? "text-emerald-600 bg-emerald-50 border-emerald-100"
      : "text-rose-600 bg-rose-50 border-rose-100";

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-4 text-sm border border-gray-100">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-500">{tTrading("totalInvestment")}</span>
          <span className="text-gray-900 font-bold text-base">{formatCurrency(total)}</span>
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
          </div>
        ) : (
          <div className="text-xs text-gray-400">{tTrading("preview.empty")}</div>
        )}
      </div>
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
  tTrading: (key: string) => string;
};

function TradeSubmitSection({
  tradeSide,
  submitOrder,
  isSubmitting,
  market,
  currentOutcomeLabel,
  orderMsg,
  tTrading,
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

  return (
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
            isPositiveMsg
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
              : "bg-rose-50 text-rose-600 border border-rose-100"
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          {orderMsg}
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
    <div className="border-t border-dashed border-gray-200 pt-4 mt-2">
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
