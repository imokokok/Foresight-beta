import React from "react";
import { ListFilter } from "lucide-react";

export type OrdersTabContentProps = {
  userOrders: any[];
  outcomes: any[];
  tTrading: (key: string) => string;
  tCommon: (key: string) => string;
  cancelOrder: (salt: string) => void;
  formatPrice: (p: string, showCents?: boolean) => string;
  formatAmount: (raw: string) => string;
};

export function OrdersTabContent({
  userOrders,
  outcomes,
  tTrading,
  tCommon,
  cancelOrder,
  formatPrice,
  formatAmount,
}: OrdersTabContentProps) {
  if (userOrders.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <ListFilter className="w-10 h-10 mb-3 opacity-20" />
          <span className="text-sm font-medium">{tTrading("emptyOrders")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {userOrders.map((o) => (
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
      ))}
    </div>
  );
}

export type HistoryTabContentProps = {
  trades: any[];
  outcomes: any[];
  tTrading: (key: string) => string;
  tCommon: (key: string) => string;
  formatPrice: (p: string, showCents?: boolean) => string;
  formatAmount: (raw: string) => string;
};

export function HistoryTabContent({
  trades,
  outcomes,
  tTrading,
  tCommon,
  formatPrice,
  formatAmount,
}: HistoryTabContentProps) {
  if (trades.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <ListFilter className="w-10 h-10 mb-3 opacity-20" />
          <span className="text-sm font-medium">暂无成交记录</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trades.map((t, i) => (
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
      ))}
    </div>
  );
}
