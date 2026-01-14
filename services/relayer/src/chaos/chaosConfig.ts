import { ChaosConfig } from "./chaosCore.js";

/**
 * 混沌工程配置
 * 定义了各种混沌场景的概率和参数
 */
export const chaosConfig: ChaosConfig = {
  // 全局配置
  enabled: process.env.CHAOS_ENABLED === "true",
  probability: 0.3, // 30% 的概率触发混沌场景

  // 具体混沌场景配置
  scenarios: {
    // 网络延迟场景
    latency: {
      enabled: true,
      minDelay: 100, // 最小延迟 100ms
      maxDelay: 2000, // 最大延迟 2000ms
    },

    // 随机错误场景
    error: {
      enabled: true,
      errorTypes: [
        { type: "ECONNRESET", message: "Connection reset by peer", probability: 0.2 },
        { type: "ETIMEDOUT", message: "Connection timed out", probability: 0.3 },
        { type: "ECONNREFUSED", message: "Connection refused", probability: 0.2 },
        { type: "InternalServerError", message: "Internal server error", probability: 0.3 },
      ],
    },

    // CPU峰值场景
    cpuSpike: {
      enabled: true,
      duration: 1000, // CPU 峰值持续时间 1000ms
      intensity: 0.8, // CPU 峰值强度 80%
    },

    // 内存泄漏场景
    memoryLeak: {
      enabled: true,
      leakRate: 5120, // 内存泄漏速率 5KB per operation
    },
  },
};
