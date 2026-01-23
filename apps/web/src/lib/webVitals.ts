import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from "web-vitals";

export type PerformanceMetric = {
  id: string;
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  navigationType: string;
  url: string;
  userAgent: string;
  deviceType: "mobile" | "tablet" | "desktop";
  timestamp: number;
};

/**
 * Web Vitals 性能监控
 *
 * 指标说明：
 * - LCP (Largest Contentful Paint): 最大内容绘制
 * - INP (Interaction to Next Paint): 交互到下一次绘制 (替代 FID)
 * - CLS (Cumulative Layout Shift): 累积布局偏移
 * - FCP (First Contentful Paint): 首次内容绘制
 * - TTFB (Time to First Byte): 首字节时间
 */

function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";

  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  // 根据 Google 标准评级
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    INP: [200, 500], // 替代 FID
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  };

  const [good, poor] = thresholds[name] || [1000, 3000];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

export function reportWebVitals(onReport: (metric: PerformanceMetric) => void) {
  const reportMetric = (metric: Metric) => {
    const performanceMetric: PerformanceMetric = {
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating as "good" | "needs-improvement" | "poor",
      delta: metric.delta,
      navigationType: metric.navigationType,
      url: window.location.href,
      userAgent: navigator.userAgent,
      deviceType: getDeviceType(),
      timestamp: Date.now(),
    };

    onReport(performanceMetric);
  };

  onCLS(reportMetric);
  onINP(reportMetric);
  onFCP(reportMetric);
  onLCP(reportMetric);
  onTTFB(reportMetric);
}

export function sendToAnalytics(metric: PerformanceMetric) {
  // 发送到后端 API
  if (typeof window !== "undefined" && navigator.sendBeacon) {
    const body = JSON.stringify(metric);
    navigator.sendBeacon("/api/analytics/vitals", body);
  } else {
    // 回退方案
    fetch("/api/analytics/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metric),
      keepalive: true,
    }).catch((err) => console.error("Failed to send analytics:", err));
  }
}

/**
 * 初始化 Web Vitals 监控
 */
export function initWebVitals() {
  if (typeof window === "undefined") return;

  // 仅在生产环境收集数据（可选）
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // 生产环境发送到服务器
  reportWebVitals(sendToAnalytics);
}
