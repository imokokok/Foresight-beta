"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Users } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslations, formatTranslation } from "@/lib/i18n";
import { CenteredSpinner } from "./ProfileUI";

export function PredictionsTab() {
  const { account } = useWallet();
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tEvents = useTranslations();
  const tProfile = useTranslations("profile");

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }

    const fetchPortfolio = async () => {
      try {
        const res = await fetch(`/api/user-portfolio?address=${account}`);
        if (!res.ok) throw new Error("Failed to fetch portfolio");
        const data = await res.json();
        setPredictions(data.positions || []);
      } catch (err) {
        setError(tProfile("predictions.errors.loadFailed"));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [account, tProfile]);

  if (loading) return <CenteredSpinner />;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;

  if (predictions.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title={tProfile("predictions.empty.title")}
        description={tProfile("predictions.empty.description")}
      />
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-purple-500" />
        {tProfile("predictions.header")}
      </h3>
      <div className="grid gap-4">
        {predictions.map((pred) => {
          const yesProb =
            typeof pred.stats?.yesProbability === "number" ? pred.stats.yesProbability : 0.5;
          const noProb =
            typeof pred.stats?.noProbability === "number" ? pred.stats.noProbability : 1 - yesProb;

          const isYes = String(pred.outcome || "").toLowerCase() === "yes";
          const sideProb = isYes ? yesProb : noProb;
          const probPercent = Math.max(0, Math.min(100, Number((sideProb * 100).toFixed(1)) || 0));

          return (
            <Link href={`/prediction/${pred.id}`} key={pred.id}>
              <div className="bg-white rounded-[1.5rem] p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                <img
                  src={pred.image_url}
                  alt={pred.title || tProfile("predictions.alt.cover")}
                  className="w-12 h-12 rounded-xl bg-gray-100 object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">
                    {tEvents(pred.title)}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold ${isYes ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {pred.outcome}
                    </span>
                    <span>
                      {tProfile("predictions.labels.stake")} ${pred.stake}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-purple-500" />
                      <span>成交 ${Number(pred.stats?.totalAmount || 0).toFixed(2)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-400" />
                      <span>
                        {formatTranslation(tProfile("predictions.labels.participants"), {
                          count: Number(pred.stats?.participantCount || 0),
                        })}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                    <span>{tProfile("predictions.labels.yourSideProbability")}</span>
                    <span className="font-bold text-gray-700">{probPercent.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-bold ${String(pred.pnl || "").startsWith("+") ? "text-green-600" : "text-red-600"}`}
                  >
                    {pred.pnl}
                  </div>
                  <div className="text-xs text-gray-400 uppercase">{pred.status}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
