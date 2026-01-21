/**
 * ErrorBoundary 组件测试
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { createContext } from "react";

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="alert-triangle-icon" />,
  RefreshCw: () => <svg data-testid="refresh-cw-icon" />,
  Home: () => <svg data-testid="home-icon" />,
}));

vi.mock("@/lib/i18n", () => ({
  LocaleContext: createContext({
    locale: "en",
    setLocale: () => {},
  }),
  t: (key: string) => {
    const map: Record<string, string> = {
      "errors.somethingWrong": "出错了",
      "common.retry": "重试",
      "errors.refreshPage": "刷新页面",
      "errors.goHome": "返回首页",
      "errors.componentLoadFailed": "组件加载失败",
    };
    return map[key] ?? key;
  },
}));

let ErrorBoundary: typeof import("../ErrorBoundary").ErrorBoundary;

// 会抛出错误的组件
function ThrowError({ shouldThrow }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>正常内容</div>;
}

describe("ErrorBoundary", () => {
  // 抑制错误输出到控制台
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  beforeAll(async () => {
    ErrorBoundary = (await import("../ErrorBoundary")).ErrorBoundary;
  }, 20000);

  describe("正常渲染", () => {
    it("子组件正常时应该渲染子组件", () => {
      render(
        <ErrorBoundary>
          <div>测试内容</div>
        </ErrorBoundary>
      );

      expect(screen.getByText("测试内容")).toBeInTheDocument();
    });
  });

  describe("错误捕获", () => {
    it("应该捕获子组件的错误", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // 应该显示错误 UI
      expect(screen.getByText("出错了")).toBeInTheDocument();
    });

    it("应该显示错误消息", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Test error")).toBeInTheDocument();
    });

    it("应该显示重试按钮", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("重试")).toBeInTheDocument();
    });
  });

  describe("错误级别", () => {
    it("页面级错误应该显示更多选项", () => {
      render(
        <ErrorBoundary level="page">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("刷新页面")).toBeInTheDocument();
      expect(screen.getByText("返回首页")).toBeInTheDocument();
    });

    it("组件级错误应该显示简单提示", () => {
      render(
        <ErrorBoundary level="component">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("组件加载失败")).toBeInTheDocument();
    });
  });

  describe("自定义 fallback", () => {
    it("应该使用自定义 fallback", () => {
      const customFallback = <div>自定义错误界面</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("自定义错误界面")).toBeInTheDocument();
    });
  });

  describe("Sentry 集成", () => {
    it("应该上报错误到 Sentry", async () => {
      const Sentry = await import("@sentry/nextjs");
      const captureExceptionSpy = vi.spyOn(Sentry, "captureException");

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(captureExceptionSpy).toHaveBeenCalled();
    });
  });
});
