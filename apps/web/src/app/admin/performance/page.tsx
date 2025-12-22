"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, TrendingUp, Clock, Zap, BarChart3, RefreshCw } from "lucide-react";

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
      fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}
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
  const [stats, setStats] = useState<PerformanceStats>({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/vitals?days=${days}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error("Failed to fetch performance stats:", error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const metrics = [
    {
      name: "LCP",
      label: "最大内容绘制",
      icon: Activity,
      color: "purple",
      unit: "ms",
      goodThreshold: 2500,
    },
    {
      name: "INP",
      label: "交互到下一次绘制",
      icon: Zap,
      color: "blue",
      unit: "ms",
      goodThreshold: 200,
    },
    {
      name: "CLS",
      label: "累积布局偏移",
      icon: TrendingUp,
      color: "green",
      unit: "",
      goodThreshold: 0.1,
    },
    {
      name: "FCP",
      label: "首次内容绘制",
      icon: Clock,
      color: "orange",
      unit: "ms",
      goodThreshold: 1800,
    },
    {
      name: "TTFB",
      label: "首字节时间",
      icon: BarChart3,
      color: "pink",
      unit: "ms",
      goodThreshold: 800,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50/20 to-fuchsia-50/30 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">性能监控仪表板</h1>
            <p className="text-gray-600 mt-2">实时 Web Vitals 和性能指标</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value={1}>过去 1 天</option>
              <option value={7}>过去 7 天</option>
              <option value={30}>过去 30 天</option>
            </select>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>
        </div>

        {/* 指标卡片 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metrics.map((metric, index) => {
              const stat = stats[metric.name];
              const Icon = metric.icon;

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
                    <div className={`p-3 rounded-xl bg-${metric.color}-50`}>
                      <Icon className={`w-6 h-6 text-${metric.color}-600`} />
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
                      {score.toFixed(0)}% 良好
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

                  {/* 评分分布 */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-green-600">良好</span>
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
                          <span className="text-yellow-600">一般</span>
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
                          <span className="text-red-600">差</span>
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

                  {/* 样本数量 */}
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    基于 {stat.count} 个样本
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* 提示 */}
        {!loading && Object.keys(stats).length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">暂无数据</p>
            <p className="text-sm text-gray-500 mt-2">请稍后再试或确保前端已正确集成 Web Vitals</p>
          </div>
        )}
      </div>
    </div>
  );
}
