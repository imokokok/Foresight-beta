import React from "react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type PositionCardProps = {
  tTrading: (key: string) => string;
  currentShares: number;
  positionStake?: number;
  markPrice: number;
  markValue: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  onSellMax: () => void;
};

export const PositionCard: React.FC<PositionCardProps> = ({
  tTrading,
  currentShares,
  positionStake,
  markPrice,
  markValue,
  unrealizedPnl,
  unrealizedPct,
  onSellMax,
}) => {
  let stakeBefore = typeof positionStake === "number" && positionStake > 0 ? positionStake : 0;

  return (
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
            onClick={onSellMax}
            className="px-2 py-1 rounded-full border border-rose-100 bg-rose-50 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-200 transition-colors"
          >
            {tTrading("sell")} {tTrading("hints.max")}
          </button>
        </div>
      </div>
    </div>
  );
};
