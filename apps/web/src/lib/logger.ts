/**
 * 统一日志工具
 * 在生产环境自动禁用 debug 和 info 日志
 * 集成 Sentry 错误上报
 */

import * as Sentry from "@sentry/nextjs";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    const env = process.env.NODE_ENV || "development";
    this.isDevelopment = env === "development" || env === "test";
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  /**
   * 调试日志 - 仅开发环境
   */
  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  }

  /**
   * 信息日志 - 仅开发环境
   */
  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.log(`ℹ️ [INFO] ${message}`, ...args);
    }
  }

  /**
   * 警告日志 - 开发和生产环境
   */
  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`⚠️ [WARN] ${message}`, ...args);
    }

    // 生产环境发送到 Sentry
    if (!this.isDevelopment) {
      Sentry.captureMessage(message, {
        level: "warning",
        extra: { args },
      });
    }
  }

  /**
   * 错误日志 - 开发和生产环境
   */
  error(message: string, error?: Error | unknown, ...args: any[]) {
    console.error(`❌ [ERROR] ${message}`, error, ...args);

    // 发送到 Sentry
    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: { message },
        extra: { args },
      });
    } else {
      Sentry.captureMessage(message, {
        level: "error",
        extra: { error, args },
      });
    }
  }

  /**
   * API 请求日志
   */
  api(method: string, url: string, status?: number, duration?: number) {
    if (this.isDevelopment) {
      const statusEmoji = status && status >= 200 && status < 300 ? "✅" : "❌";
      const durationStr = duration ? `(${duration}ms)` : "";
      console.log(`${statusEmoji} [API] ${method} ${url} ${status || ""} ${durationStr}`);
    }
  }

  /**
   * 性能日志
   */
  perf(label: string, duration: number) {
    if (this.isDevelopment && duration > 100) {
      // 只记录超过 100ms 的操作
      console.log(`⏱️ [PERF] ${label}: ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * 用户行为日志（用于分析）
   */
  track(event: string, properties?: Record<string, any>) {
    if (this.isDevelopment) {
      console.log(`📊 [TRACK] ${event}`, properties);
    }

    // 这里可以集成 Google Analytics, Mixpanel 等
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, properties);
    }
  }
}

// 导出单例
export const logger = new Logger();

// 便捷方法
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  api: logger.api.bind(logger),
  perf: logger.perf.bind(logger),
  track: logger.track.bind(logger),
};

// 性能测量工具
export function measurePerformance<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
  const start = performance.now();

  const result = fn();

  if (result instanceof Promise) {
    return result.then((value) => {
      const duration = performance.now() - start;
      logger.perf(label, duration);
      return value;
    });
  } else {
    const duration = performance.now() - start;
    logger.perf(label, duration);
    return result;
  }
}

// API 请求包装器
export async function loggedFetch(url: string, options?: RequestInit): Promise<Response> {
  const start = performance.now();
  const method = options?.method || "GET";

  try {
    const response = await fetch(url, options);
    const duration = performance.now() - start;
    logger.api(method, url, response.status, duration);
    return response;
  } catch (error) {
    const duration = performance.now() - start;
    logger.api(method, url, 0, duration);
    logger.error(`API request failed: ${method} ${url}`, error);
    throw error;
  }
}
