/**
 * 重试机制
 * 支持指数退避、抖动、条件重试
 */

import { logger } from "../monitoring/logger.js";
import { Counter, Histogram } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";

// ============================================================
// 指标定义
// ============================================================

const retryAttemptsTotal = new Counter({
  name: "foresight_retry_attempts_total",
  help: "Total retry attempts",
  labelNames: ["operation", "result"] as const,
  registers: [metricsRegistry],
});

const retryDuration = new Histogram({
  name: "foresight_retry_duration_ms",
  help: "Total retry duration including all attempts",
  labelNames: ["operation"] as const,
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000],
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 初始延迟 (毫秒) */
  initialDelay: number;
  /** 最大延迟 (毫秒) */
  maxDelay: number;
  /** 退避倍数 */
  backoffMultiplier: number;
  /** 是否添加抖动 */
  jitter: boolean;
  /** 抖动范围 (0-1) */
  jitterFactor: number;
  /** 重试条件 */
  retryCondition?: (error: Error, attempt: number) => boolean;
  /** 重试前回调 */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

// ============================================================
// 默认配置
// ============================================================

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  jitterFactor: 0.2,
};

// ============================================================
// 重试函数
// ============================================================

export async function retry<T>(
  operation: string,
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= fullConfig.maxRetries) {
    try {
      const result = await fn();

      retryAttemptsTotal.inc({ operation, result: "success" });

      if (attempt > 0) {
        retryDuration.observe({ operation }, Date.now() - startTime);
      }

      return {
        success: true,
        result,
        attempts: attempt + 1,
        totalDuration: Date.now() - startTime,
      };
    } catch (error: any) {
      lastError = error;
      attempt++;

      // 检查是否应该重试
      if (attempt > fullConfig.maxRetries) {
        break;
      }

      if (fullConfig.retryCondition && !fullConfig.retryCondition(error, attempt)) {
        break;
      }

      // 计算延迟
      const delay = calculateDelay(attempt, fullConfig);

      // 回调
      if (fullConfig.onRetry) {
        fullConfig.onRetry(error, attempt, delay);
      }

      logger.warn("Operation failed, retrying", {
        operation,
        attempt,
        maxRetries: fullConfig.maxRetries,
        delay,
        error: error.message,
      });

      retryAttemptsTotal.inc({ operation, result: "retry" });

      // 等待
      await sleep(delay);
    }
  }

  retryAttemptsTotal.inc({ operation, result: "failed" });
  retryDuration.observe({ operation }, Date.now() - startTime);

  return {
    success: false,
    error: lastError!,
    attempts: attempt,
    totalDuration: Date.now() - startTime,
  };
}

/**
 * 计算延迟时间
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // 指数退避
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);

  // 限制最大延迟
  delay = Math.min(delay, config.maxDelay);

  // 添加抖动
  if (config.jitter) {
    const jitterRange = delay * config.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    delay = delay + jitter;
  }

  return Math.round(delay);
}

/**
 * 延时
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 特定错误重试条件
// ============================================================

/**
 * 网络错误重试条件
 */
export function isNetworkError(error: Error): boolean {
  const networkErrors = [
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ENETUNREACH",
    "EAI_AGAIN",
    "EHOSTUNREACH",
    "EPIPE",
    "ECONNABORTED",
  ];

  const message = error.message || "";
  const code = (error as any).code || "";

  return networkErrors.some((e) => message.includes(e) || code === e);
}

/**
 * 可重试的 HTTP 状态码
 */
export function isRetryableHttpError(error: Error): boolean {
  const status = (error as any).status || (error as any).statusCode;

  if (!status) {
    return isNetworkError(error);
  }

  // 5xx 服务器错误和部分 4xx 错误可重试
  return status >= 500 || status === 429 || status === 408;
}

/**
 * 区块链交易重试条件
 */
export function isRetryableBlockchainError(error: Error): boolean {
  const message = error.message.toLowerCase();

  const retryableErrors = [
    "nonce too low",
    "replacement transaction underpriced",
    "transaction underpriced",
    "already known",
    "network",
    "timeout",
    "rate limit",
  ];

  return retryableErrors.some((e) => message.includes(e));
}

// ============================================================
// 便捷装饰器
// ============================================================

/**
 * 重试装饰器
 */
export function withRetry(operation: string, config?: Partial<RetryConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await retry(
        operation || `${target.constructor.name}.${propertyKey}`,
        () => originalMethod.apply(this, args),
        config
      );

      if (!result.success) {
        throw result.error;
      }

      return result.result;
    };

    return descriptor;
  };
}

// ============================================================
// 重试策略预设
// ============================================================

export const RETRY_STRATEGIES = {
  /** 快速重试 (适用于幂等操作) */
  fast: {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 1000,
    backoffMultiplier: 2,
    jitter: true,
  } as Partial<RetryConfig>,

  /** 标准重试 */
  standard: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  } as Partial<RetryConfig>,

  /** 慢速重试 (适用于外部服务) */
  slow: {
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitter: true,
  } as Partial<RetryConfig>,

  /** 区块链操作 */
  blockchain: {
    maxRetries: 5,
    initialDelay: 3000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    jitter: true,
    retryCondition: isRetryableBlockchainError,
  } as Partial<RetryConfig>,
};
