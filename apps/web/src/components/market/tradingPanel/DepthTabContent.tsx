import { formatCurrency, formatNumber } from "@/lib/format";

export type DepthTabContentProps = {
  depthBuy: Array<{ price: string; qty: string }>;
  depthSell: Array<{ price: string; qty: string }>;
  bestBid: string;
  bestAsk: string;
  formatPrice: (p: string, showCents?: boolean) => string;
  formatAmount: (raw: string) => string;
  fillPrice: (p: string) => void;
};

export function DepthTabContent({
  depthBuy,
  depthSell,
  bestBid,
  bestAsk,
  formatPrice,
  formatAmount,
  fillPrice,
}: DepthTabContentProps) {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden border border-gray-100">
      <div className="grid grid-cols-3 px-4 py-2 text-xs font-bold text-gray-500 border-b border-gray-100 bg-gray-50/50">
        <span>Price (USDC)</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[400px] scrollbar-beauty">
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
                className="grid grid-cols-3 px-4 py-1.5 text-xs cursor-pointer hover:bg-rose-50 relative group"
              >
                <div
                  className="absolute top-0 right-0 h-full bg-rose-500/10 transition-all duration-300"
                  style={{ width: `${width}%` }}
                />
                <span className="text-rose-600 font-medium relative z-10">
                  {formatPrice(row.price)}
                </span>
                <span className="text-right text-gray-600 relative z-10">
                  {formatAmount(row.qty)}
                </span>
                <span className="text-right text-gray-400 relative z-10">
                  {Number.isFinite(total) ? formatCurrency(total) : "-"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="py-2 bg-gray-50 text-center text-xs text-gray-400 font-medium border-y border-gray-100 my-1">
          Spread:{" "}
          {bestAsk && bestBid
            ? (() => {
                const spread = Number(formatPrice(bestAsk)) - Number(formatPrice(bestBid));
                return Number.isFinite(spread)
                  ? formatNumber(spread, undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "-";
              })()
            : "-"}
        </div>

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
                className="grid grid-cols-3 px-4 py-1.5 text-xs cursor-pointer hover:bg-emerald-50 relative group"
              >
                <div
                  className="absolute top-0 right-0 h-full bg-emerald-500/10 transition-all duration-300"
                  style={{ width: `${width}%` }}
                />
                <span className="text-emerald-600 font-medium relative z-10">
                  {formatPrice(row.price)}
                </span>
                <span className="text-right text-gray-600 relative z-10">
                  {formatAmount(row.qty)}
                </span>
                <span className="text-right text-gray-400 relative z-10">
                  {Number.isFinite(total) ? formatCurrency(total) : "-"}
                </span>
              </div>
            );
          })}
        </div>

        {depthBuy.length === 0 && depthSell.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-xs">No orders yet</div>
        )}
      </div>
    </div>
  );
}
