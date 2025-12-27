/**
 * 错误边界组件
 * 捕获组件树中的 JavaScript 错误，防止整个应用崩溃
 */

"use client";

import { Component, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  level?: "page" | "section" | "component";
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误信息
    this.setState({ errorInfo });

    // 上报到 Sentry
    Sentry.captureException(error, {
      tags: {
        errorBoundary: true,
        level: this.props.level || "component",
      },
      extra: {
        componentStack: errorInfo.componentStack,
        errorBoundaryLevel: this.props.level,
      },
      level: "error",
    });

    // 调用外部错误处理器（如果提供）
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 开发环境输出详细信息
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error);
      console.error("Component stack:", errorInfo.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 根据错误边界级别决定 UI
      const isPageLevel = this.props.level === "page";
      const isComponentLevel = this.props.level === "component";

      // 组件级别：简单的错误提示
      if (isComponentLevel) {
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">
                  {t("errors.componentLoadFailed")}
                </h3>
                <p className="text-sm text-red-600">
                  {this.state.error?.message || t("errors.errorOccurred")}
                </p>
                <button
                  onClick={this.handleReset}
                  className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
                >
                  {t("common.retry")}
                </button>
              </div>
            </div>
          </div>
        );
      }

      // 页面/区块级别：完整的错误 UI
      return (
        <div
          className={`flex flex-col items-center justify-center p-8 ${
            isPageLevel ? "min-h-screen" : "min-h-[400px]"
          }`}
        >
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            {/* 错误图标 */}
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
            </div>

            {/* 标题 */}
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("errors.somethingWrong")}</h2>

            {/* 错误描述 */}
            <p className="text-gray-600 mb-6">
              {this.state.error?.message || t("errors.unknownError")}
            </p>

            {/* 开发环境显示详细错误信息 */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  {t("errors.viewDetails")}
                </summary>
                <div className="mt-3 space-y-2">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-700 mb-1">
                      {t("errors.errorMessage")}:
                    </p>
                    <pre className="text-xs text-red-600 whitespace-pre-wrap break-words">
                      {this.state.error.message}
                    </pre>
                  </div>
                  {this.state.error.stack && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {t("errors.stackTrace")}:
                      </p>
                      <pre className="text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {t("errors.componentStack")}:
                      </p>
                      <pre className="text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-col gap-3">
              {/* 重试按钮 */}
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                {t("common.retry")}
              </button>

              {/* 页面级别显示更多选项 */}
              {isPageLevel && (
                <>
                  <button
                    onClick={this.handleReload}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {t("errors.refreshPage")}
                  </button>

                  <button
                    onClick={this.handleGoHome}
                    className="flex items-center justify-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    {t("errors.goHome")}
                  </button>
                </>
              )}
            </div>

            {/* 提示信息 */}
            <p className="mt-6 text-xs text-gray-500">{t("errors.autoReported")}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 简单的错误边界 Fallback 组件
 */
export function SimpleErrorFallback({
  error,
  resetError,
}: {
  error?: Error;
  resetError?: () => void;
}) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
      <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-red-800 mb-2">{t("errors.loadFailed")}</h3>
      <p className="text-sm text-red-600 mb-4">
        {error?.message || t("errors.contentUnavailable")}
      </p>
      {resetError && (
        <button
          onClick={resetError}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
        >
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
