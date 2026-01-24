"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, TrendingUp, Clock, Zap, BarChart3, RefreshCw } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import GradientPage from "@/components/ui/GradientPage";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";

interface PerformanceStats {
  [key: string]: {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p75: number;
    p95: number;
    good: number;
    needsImprovement: number;
    poor: number;
  };
}

export default function PerformanceDashboard() {
  return (
    <Suspense
      fallback={
        <GradientPage className="min-h-screen relative overflow-hidden flex items-center justify-center">
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
            <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
          </div>
          <div className="relative z-10">Loading...</div>
        </GradientPage>
      }
    >
      <PerformanceDashboardContent />
    </Suspense>
  );
}

/**
 * 性能监控仪表板页面
 *
 * 展示 Web Vitals 和性能指标统计
 */
function PerformanceDashboardContent() {
  const tPerf = useTranslations("adminPerformance");
  const router = useRouter();
  const { address: account } = useWallet();
  const profileCtx = useUserProfileOptional();
  const [stats, setStats] = useState<PerformanceStats>({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!account) return;
    if (!profileCtx?.isAdmin) {
      router.replace("/trending");
    }
  }, [account, profileCtx?.isAdmin, router]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/vitals?days=${days}`);
      if (response.status === 401 || response.status === 403) {
        router.replace("/trending");
        return;
      }
      const data = await response.json();
      if (data.success) {
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error("Failed to fetch performance stats:", error);
    } finally {
      setLoading(false);
    }
  }, [days, router]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const metrics = [
    {
      name: "LCP",
      label: tPerf("metrics.LCP"),
      icon: Activity,
      color: "purple",
      unit: "ms",
      goodThreshold: 2500,
    },
    {
      name: "INP",
      label: tPerf("metrics.INP"),
      icon: Zap,
      color: "blue",
      unit: "ms",
      goodThreshold: 200,
    },
    {
      name: "CLS",
      label: tPerf("metrics.CLS"),
      icon: TrendingUp,
      color: "green",
      unit: "",
      goodThreshold: 0.1,
    },
    {
      name: "FCP",
      label: tPerf("metrics.FCP"),
      icon: Clock,
      color: "orange",
      unit: "ms",
      goodThreshold: 1800,
    },
    {
      name: "TTFB",
      label: tPerf("metrics.TTFB"),
      icon: BarChart3,
      color: "pink",
      unit: "ms",
      goodThreshold: 800,
    },
  ];

  const metricColorClasses = {
    purple: { bg: "bg-purple-50", text: "text-purple-600" },
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    green: { bg: "bg-green-50", text: "text-green-600" },
    orange: { bg: "bg-orange-50", text: "text-orange-600" },
    pink: { bg: "bg-pink-50", text: "text-pink-600" },
  } as const;

  return (
    <GradientPage className="min-h-screen relative overflow-hidden p-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-b from-violet-300/40 to-fuchsia-300/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-gradient-to-t from-rose-300/40 to-orange-200/40 rounded-full blur-[100px]" />
        <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-cyan-200/30 rounded-full blur-[80px]" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tPerf("title")}</h1>
            <p className="text-gray-600 mt-2">{tPerf("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value={1}>{tPerf("period.day1")}</option>
              <option value={7}>{tPerf("period.day7")}</option>
              <option value={30}>{tPerf("period.day30")}</option>
            </select>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-200 to-pink-300 text-purple-800 border border-purple-200 shadow-md shadow-purple-200/50 hover:from-purple-400 hover:to-pink-400 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {tPerf("refresh")}
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">{tPerf("loading") || "Loading..."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metrics.map((metric, index) => {
              const stat = stats[metric.name];
              const Icon = metric.icon;
              const metricColor =
                metricColorClasses[metric.color as keyof typeof metricColorClasses] ||
                metricColorClasses.purple;

              if (!stat) return null;

              const score = (stat.good / stat.count) * 100;
              const isGood = score >= 75;
              const isOk = score >= 50;

              return (
                <motion.div
                  key={metric.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                >
                  {/* 头部 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${metricColor.bg}`}>
                      <Icon className={`w-6 h-6 ${metricColor.text}`} />
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isGood
                          ? "bg-green-50 text-green-700"
                          : isOk
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {tPerf("percentGood").replace("{percent}", score.toFixed(0))}
                    </div>
                  </div>

                  {/* 标题 */}
                  <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.label}</h3>
                  <p className="text-3xl font-bold text-gray-900 mb-4">
                    {stat.avg.toFixed(metric.name === "CLS" ? 3 : 0)}
                    <span className="text-base font-normal text-gray-500 ml-1">{metric.unit}</span>
                  </p>

                  {/* 统计信息 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">P50</span>
                      <span className="font-medium text-gray-900">
                        {stat.p50.toFixed(metric.name === "CLS" ? 3 : 0)} {metric.unit}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">P75</span>
                      <span className="font-medium text-gray-900">
                        {stat.p75.toFixed(metric.name === "CLS" ? 3 : 0)} {metric.unit}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">P95</span>
                      <span className="font-medium text-gray-900">
                        {stat.p95.toFixed(metric.name === "CLS" ? 3 : 0)} {metric.unit}
                      </span>
                    </div>
                  </div>

                  {/* Rating distribution */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-green-600">{tPerf("rating.good")}</span>
                          <span className="font-semibold">{stat.good}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(stat.good / stat.count) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-yellow-600">
                            {tPerf("rating.needsImprovement")}
                          </span>
                          <span className="font-semibold">{stat.needsImprovement}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 rounded-full"
                            style={{ width: `${(stat.needsImprovement / stat.count) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-red-600">{tPerf("rating.poor")}</span>
                          <span className="font-semibold">{stat.poor}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${(stat.poor / stat.count) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sample count */}
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    {tPerf("sampleCount").replace("{count}", String(stat.count))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Hint */}
        {!loading && Object.keys(stats).length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">{tPerf("noData")}</p>
            <p className="text-sm text-gray-500 mt-2">{tPerf("noDataHint")}</p>
          </div>
        )}
      </div>
    </GradientPage>
  );
}
