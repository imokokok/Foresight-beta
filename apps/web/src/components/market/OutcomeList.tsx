import { useTranslations } from "@/lib/i18n";
import { formatInteger, formatPercent } from "@/lib/format";

interface PredictionDetail {
  id: number;
  title: string;
  description: string;
  category: string;
  deadline: string;
  minStake: number;
  criteria: string;
  referenceUrl: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  stats: {
    yesAmount: number;
    noAmount: number;
    totalAmount: number;
    participantCount: number;
    yesProbability: number;
    noProbability: number;
    betCount: number;
  };
  timeInfo: {
    createdAgo: string;
    deadlineIn: string;
    isExpired: boolean;
  };
  type?: string;
  outcome_count?: number;
  outcomes?: Array<any>;
}

interface OutcomeListProps {
  prediction: PredictionDetail;
  selectedOutcome: number;
  onSelectOutcome: (index: number) => void;
  onTrade: (side: "buy" | "sell", outcomeIndex: number) => void;
}

export function OutcomeList({
  prediction,
  selectedOutcome,
  onSelectOutcome,
  onTrade,
}: OutcomeListProps) {
  const tCommon = useTranslations("common");
  const tTrading = useTranslations("trading");
  const tMarket = useTranslations("market");
  const outcomes = prediction.outcomes || [];
  const stats = prediction.stats;

  const items =
    outcomes.length > 0
      ? outcomes
      : [
          { label: tCommon("yes"), color: "#10b981" },
          { label: tCommon("no"), color: "#ef4444" },
        ];

  const displayItems = items.map((outcome: any, idx: number) => {
    let prob = 0;

    if (outcome.probability !== undefined) {
      prob = Number(outcome.probability);
    } else if (outcomes.length === 0 || outcomes.length === 2) {
      if (idx === 0) prob = stats?.yesProbability || 0;
      else prob = stats?.noProbability || 0;
    }

    if (isNaN(prob)) prob = 0;

    const buyPrice = prob;
    const sellPrice = 100 - prob;

    return {
      outcome,
      idx,
      prob,
      buyPrice,
      sellPrice,
    };
  });

  const isMultiOutcome = displayItems.length > 2;

  return (
    <div className="bg-white border-y border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h3 className="font-bold text-gray-900">Outcomes</h3>
        <span className="text-xs text-gray-500 font-medium tracking-wider uppercase">% Chance</span>
      </div>
      {isMultiOutcome && (
        <div className="px-6 pt-4 pb-3 border-b border-gray-100 space-y-2 bg-white">
          <div className="flex justify-between items-center text-[11px] text-gray-500">
            <span className="font-semibold text-gray-700">
              {tMarket("outcomes.multiDistribution")}
            </span>
            <span className="text-gray-400">{tMarket("outcomes.realTimeUpdate")}</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
            {displayItems.map(({ outcome, idx, prob }) => {
              const width = prob > 0 ? prob : 0.0001;
              const isSelected = selectedOutcome === idx;
              const color = outcome.color || (idx === 0 ? "#10b981" : "#ef4444");

              return (
                <div
                  key={idx}
                  style={{
                    width: `${width}%`,
                    backgroundColor: color,
                    opacity: isSelected ? 0.95 : 0.7,
                  }}
                  className="h-full transition-opacity"
                />
              );
            })}
          </div>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {displayItems.map(({ outcome, idx, prob, buyPrice, sellPrice }) => {
          return (
            <div
              key={idx}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors gap-4 ${
                selectedOutcome === idx ? "bg-purple-50/30" : ""
              }`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Color Bar */}
                <div
                  className="w-1.5 h-12 rounded-full flex-shrink-0"
                  style={{ backgroundColor: outcome.color || (idx === 0 ? "#10b981" : "#ef4444") }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1.5">
                    <span className="font-bold text-gray-900 truncate pr-4" title={outcome.label}>
                      {outcome.label}
                    </span>
                    <span className="font-bold text-purple-600 flex-shrink-0">
                      {formatPercent(prob)}%
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${prob}%` }} />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 sm:ml-6 flex-shrink-0">
                <button
                  onClick={() => {
                    onSelectOutcome(idx);
                    onTrade("buy", idx);
                  }}
                  className="flex flex-col items-center justify-center px-4 py-2 rounded-xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all active:scale-95 min-w-[100px] shadow-sm hover:shadow"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {tTrading("buy")}
                  </span>
                  <span className="text-xs opacity-70 mt-0.5">{formatInteger(buyPrice)}¢</span>
                </button>
                <button
                  onClick={() => {
                    onSelectOutcome(idx);
                    onTrade("sell", idx);
                  }}
                  className="flex flex-col items-center justify-center px-4 py-2 rounded-xl border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all active:scale-95 min-w-[100px] shadow-sm hover:shadow"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {tTrading("sell")}
                  </span>
                  <span className="text-xs opacity-70 mt-0.5">{formatInteger(sellPrice)}¢</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
