/**
 * 增强的错误追踪工具
 * 提供更精细化的错误分类和上报
 */

import * as Sentry from "@sentry/nextjs";
import { formatAddress } from "./cn";

/**
 * 错误类型
 */
export enum ErrorType {
  // 业务错误
  BUSINESS = "business",

  // API 错误
  API = "api",

  // 用户操作错误
  USER_ACTION = "user_action",

  // 钱包相关错误
  WALLET = "wallet",

  // 订单相关错误
  ORDER = "order",

  // 认证错误
  AUTH = "auth",

  // 网络错误
  NETWORK = "network",

  // 未知错误
  UNKNOWN = "unknown",
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  FATAL = "fatal",
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
  DEBUG = "debug",
}

/**
 * 错误追踪器类
 */
export class ErrorTracker {
  /**
   * 追踪业务错误
   */
  static trackBusinessError(code: string, message: string, context?: Record<string, any>) {
    Sentry.captureMessage(`Business Error: ${code} - ${message}`, {
      level: "warning",
      tags: {
        type: ErrorType.BUSINESS,
        code,
      },
      extra: context,
    });
  }

  /**
   * 追踪 API 错误
   */
  static trackApiError(
    endpoint: string,
    method: string,
    status: number,
    error: any,
    context?: Record<string, any>
  ) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    Sentry.captureException(error, {
      tags: {
        type: ErrorType.API,
        endpoint,
        method,
        status: status.toString(),
      },
      extra: {
        ...context,
        endpoint,
        method,
        statusCode: status,
      },
      level: status >= 500 ? "error" : "warning",
    });
  }

  /**
   * 追踪用户操作错误
   */
  static trackUserActionError(action: string, error: any, context?: Record<string, any>) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    Sentry.captureException(error, {
      tags: {
        type: ErrorType.USER_ACTION,
        action,
      },
      extra: {
        ...context,
        action,
        errorMessage,
      },
      level: "info",
    });
  }

  /**
   * 追踪钱包错误
   */
  static trackWalletError(
    operation: string,
    error: any,
    walletType?: string,
    context?: Record<string, any>
  ) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    Sentry.captureException(error, {
      tags: {
        type: ErrorType.WALLET,
        operation,
        walletType: walletType || "unknown",
      },
      extra: {
        ...context,
        operation,
        walletType,
        errorMessage,
      },
      level: "warning",
    });
  }

  /**
   * 追踪订单错误
   */
  static trackOrderError(
    operation: string,
    orderId: string | null,
    error: any,
    context?: Record<string, any>
  ) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    Sentry.captureException(error, {
      tags: {
        type: ErrorType.ORDER,
        operation,
        hasOrderId: !!orderId,
      },
      extra: {
        ...context,
        operation,
        orderId: orderId || "unknown",
        errorMessage,
      },
      level: "error",
    });
  }

  /**
   * 追踪认证错误
   */
  static trackAuthError(operation: string, error: any, context?: Record<string, any>) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    Sentry.captureException(error, {
      tags: {
        type: ErrorType.AUTH,
        operation,
      },
      extra: {
        ...context,
        operation,
        errorMessage,
      },
      level: "warning",
    });
  }

  /**
   * 追踪网络错误
   */
  static trackNetworkError(url: string, error: any, context?: Record<string, any>) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    Sentry.captureException(error, {
      tags: {
        type: ErrorType.NETWORK,
        url,
      },
      extra: {
        ...context,
        url,
        errorMessage,
      },
      level: "warning",
    });
  }

  /**
   * 追踪性能问题
   */
  static trackPerformanceIssue(
    operation: string,
    duration: number,
    threshold: number,
    context?: Record<string, any>
  ) {
    if (duration > threshold) {
      Sentry.captureMessage(
        `Performance Issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
        {
          level: "warning",
          tags: {
            type: "performance",
            operation,
          },
          extra: {
            ...context,
            duration,
            threshold,
            exceededBy: duration - threshold,
          },
        }
      );
    }
  }

  /**
   * 设置用户上下文
   */
  static setUser(user: { id: string; username?: string; email?: string; walletAddress?: string }) {
    Sentry.setUser({
      id: user.id,
      username: user.username,
      email: user.email,
      // 不要发送完整的钱包地址
      wallet: user.walletAddress ? formatAddress(user.walletAddress) : undefined,
    });
  }

  /**
   * 清除用户上下文
   */
  static clearUser() {
    Sentry.setUser(null);
  }

  /**
   * 添加面包屑（用于追踪用户操作路径）
   */
  static addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, any>,
    level: Sentry.SeverityLevel = "info"
  ) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * 开始性能追踪
   */
  static startTransaction(name: string, op: string) {
    // Sentry v8 has removed startTransaction. Returning a dummy object to satisfy the interface.
    return {
      finish: () => {},
      setTag: (key: string, value: string) => {},
      setData: (key: string, value: any) => {},
    } as any;
  }

  /**
   * 手动捕获异常（带自定义上下文）
   */
  static captureException(
    error: any,
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, any>;
      level?: Sentry.SeverityLevel;
      fingerprint?: string[];
    }
  ) {
    Sentry.captureException(error, context);
  }

  /**
   * 捕获消息
   */
  static captureMessage(
    message: string,
    level: Sentry.SeverityLevel = "info",
    context?: {
      tags?: Record<string, string>;
      extra?: Record<string, any>;
    }
  ) {
    Sentry.captureMessage(message, {
      level,
      ...context,
    });
  }
}

/**
 * 全局错误处理器
 */
export function setupGlobalErrorHandler() {
  if (typeof window === "undefined") return;

  // 捕获未处理的 Promise 错误
  window.addEventListener("unhandledrejection", (event) => {
    ErrorTracker.captureException(event.reason, {
      tags: {
        type: "unhandledrejection",
      },
      extra: {
        promise: event.promise,
      },
      level: "error",
    });
  });

  // 捕获全局错误
  window.addEventListener("error", (event) => {
    ErrorTracker.captureException(event.error, {
      tags: {
        type: "global_error",
      },
      extra: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      level: "error",
    });
  });
}

/**
 * 错误边界助手
 */
export function logErrorBoundary(error: Error, errorInfo: any) {
  ErrorTracker.captureException(error, {
    tags: {
      type: "react_error_boundary",
    },
    extra: {
      componentStack: errorInfo.componentStack,
    },
    level: "error",
  });
}

/**
 * API 请求包装器（自动追踪错误）
 */
export async function trackApiRequest<T>(
  name: string,
  request: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const transaction = ErrorTracker.startTransaction(name, "api.request");

  try {
    const result = await request();
    transaction.setStatus("ok");
    return result;
  } catch (error: any) {
    transaction.setStatus("internal_error");

    ErrorTracker.trackApiError(name, "unknown", error.status || 500, error, context);

    throw error;
  } finally {
    transaction.finish();
  }
}

/**
 * 用户操作包装器（自动追踪错误）
 */
export async function trackUserAction<T>(
  actionName: string,
  action: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  ErrorTracker.addBreadcrumb(`User action: ${actionName}`, "user_action", context);

  try {
    return await action();
  } catch (error) {
    ErrorTracker.trackUserActionError(actionName, error, context);
    throw error;
  }
}

/**
 * 测量函数执行时间并追踪性能问题
 */
export async function measurePerformance<T>(
  operationName: string,
  fn: () => Promise<T>,
  thresholdMs: number = 1000,
  context?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    ErrorTracker.trackPerformanceIssue(operationName, duration, thresholdMs, context);

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    ErrorTracker.captureException(error, {
      tags: {
        type: "performance",
        operation: operationName,
      },
      extra: {
        ...context,
        duration,
        failed: true,
      },
    });

    throw error;
  }
}

export default ErrorTracker;
