import React, { useState } from "react";
import dynamic from "next/dynamic";
import { PredictionDetail } from "@/app/prediction/[id]/PredictionDetailClient";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

// 动态导入 KlineChart，禁用 SSR
const KlineChart = dynamic(() => import("@/components/KlineChart"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-900/50 rounded-lg">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
    </div>
  ),
});

interface MarketChartProps {
  market: {
    market: string;
    chain_id: number;
  } | null;
  prediction: PredictionDetail;
  tradeOutcome: number;
  outcomes: any[];
  setTradeOutcome: (idx: number) => void;
}

export function MarketChart({
  market,
  prediction,
  tradeOutcome,
  outcomes,
  setTradeOutcome,
}: MarketChartProps) {
  const [expanded, setExpanded] = useState(false);
  const tMarket = useTranslations("market");
  const tCommon = useTranslations("common");

  // 如果没有市场合约信息，展示占位
  if (!market) {
    return (
      <div className="h-[400px] w-full bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-gray-400 gap-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-blue-50/50 opacity-50"></div>
        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center z-10">
          <Maximize2 className="w-5 h-5 opacity-50 text-purple-400" />
        </div>
        <span className="z-10 font-medium text-gray-500">{tMarket("chart.loading")}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden transition-all duration-300 ${
        expanded ? "fixed inset-4 z-50 bg-white border-gray-200 shadow-2xl" : "h-[450px]"
      }`}
    >
      {/* Chart Header Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50/30 via-white to-blue-50/30">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {outcomes.length > 0 ? (
            outcomes.map((outcome: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setTradeOutcome(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  tradeOutcome === idx
                    ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-200"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-purple-200 hover:text-purple-600"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${tradeOutcome === idx ? "bg-white shadow-sm" : ""}`}
                  style={{
                    backgroundColor:
                      tradeOutcome === idx
                        ? undefined
                        : outcome.color || (idx === 0 ? "#10b981" : "#ef4444"),
                  }}
                />
                {outcome.label ||
                  tMarket("chart.outcomeFallback").replace("{index}", String(idx + 1))}
              </button>
            ))
          ) : (
            // Binary Fallback
            <>
              <button
                onClick={() => setTradeOutcome(0)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  tradeOutcome === 0
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-200"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-emerald-200 hover:text-emerald-600"
                }`}
              >
                {tCommon("yes")}
              </button>
              <button
                onClick={() => setTradeOutcome(1)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  tradeOutcome === 1
                    ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-200"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-rose-200 hover:text-rose-600"
                }`}
              >
                {tCommon("no")}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Chart Body */}
      <div className="flex-1 w-full h-full min-h-0 bg-white">
        <KlineChart market={market.market} chainId={market.chain_id} outcomeIndex={tradeOutcome} />
      </div>
    </div>
  );
}
