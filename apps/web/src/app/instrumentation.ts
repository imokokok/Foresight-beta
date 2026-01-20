/**
 * Next.js Instrumentation File
 * 用于初始化 Sentry 和其他监控工具
 * 参考: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from "@sentry/nextjs";

// 初始化 Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 仅在生产环境启用
  enabled: process.env.NODE_ENV === "production",

  // 性能监控采样率
  tracesSampleRate: 0.1,

  // 环境标识
  environment: process.env.NODE_ENV,

  // 发布版本
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "development",

  // 过滤敏感信息
  beforeSend(event, hint) {
    // 移除敏感信息
    if (event.request) {
      delete event.request.cookies;

      if (event.request.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }
    }

    // 移除环境变量中的敏感信息
    if (event.contexts?.runtime?.name === "node") {
      if (event.extra) {
        delete event.extra.SUPABASE_SERVICE_KEY;
        delete event.extra.JWT_SECRET;
        delete event.extra.SMTP_PASS;
      }
    }

    // 过滤掉开发环境的某些错误
    if (process.env.NODE_ENV === "development") {
      return null;
    }

    return event;
  },

  // 忽略某些错误
  ignoreErrors: [
    // 网络错误
    "Network request failed",
    "Failed to fetch",
    "NetworkError",
    "fetch failed",

    // 浏览器扩展错误
    "Extension context invalidated",
    "chrome-extension://",

    // 取消的请求
    "AbortError",
    "The user aborted a request",

    // MetaMask 用户取消
    "User rejected",
    "User denied",

    // 服务器端忽略的错误
    "ECONNRESET",
    "EPIPE",
    "ETIMEDOUT",
  ],
});

// 导出 register 函数，Next.js 会在适当的时机调用它
export function register() {
  // Sentry 初始化已经在文件顶部完成
  // 这里可以添加其他工具的初始化代码
}

export const onRequestError = Sentry.captureRequestError;
