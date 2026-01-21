"use client";

import { useEffect } from "react";
import { initWebVitals } from "@/lib/webVitals";

/**
 * Web Vitals 报告组件
 *
 * 自动初始化性能监控
 */
export default function WebVitalsReporter() {
  useEffect(() => {
    initWebVitals();
  }, []);

  return null;
}
