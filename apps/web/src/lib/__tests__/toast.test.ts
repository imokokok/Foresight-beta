/**
 * Toast 工具函数单元测试
 */

import { describe, it, expect, vi } from "vitest";

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    promise: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import { toast, handleApiError } from "../toast";
import { toast as sonnerToast } from "sonner";

describe("Toast Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined" && "localStorage" in window) {
      window.localStorage.setItem("preferred-language", "zh-CN");
    }
  });

  describe("toast.success", () => {
    it("应该调用 sonner toast.success", () => {
      toast.success("成功标题", "成功描述");

      expect(sonnerToast.success).toHaveBeenCalledWith(
        "成功标题",
        expect.objectContaining({
          description: "成功描述",
        })
      );
    });

    it("应该支持只传标题", () => {
      toast.success("成功");

      expect(sonnerToast.success).toHaveBeenCalledWith("成功", expect.any(Object));
    });
  });

  describe("toast.error", () => {
    it("应该调用 sonner toast.error", () => {
      toast.error("错误标题", "错误描述");

      expect(sonnerToast.error).toHaveBeenCalledWith(
        "错误标题",
        expect.objectContaining({
          description: "错误描述",
        })
      );
    });

    it("应该支持重试按钮", () => {
      const retryFn = vi.fn();

      toast.error("错误", "描述", {
        action: {
          label: "重试",
          onClick: retryFn,
        },
      });

      expect(sonnerToast.error).toHaveBeenCalledWith(
        "错误",
        expect.objectContaining({
          action: expect.objectContaining({
            label: "重试",
          }),
        })
      );
    });
  });

  describe("toast.warning", () => {
    it("应该调用 sonner toast.warning", () => {
      toast.warning("警告");

      expect(sonnerToast.warning).toHaveBeenCalled();
    });
  });

  describe("toast.info", () => {
    it("应该调用 sonner toast.info", () => {
      toast.info("信息");

      expect(sonnerToast.info).toHaveBeenCalled();
    });
  });

  describe("toast.promise", () => {
    it("应该处理 Promise", async () => {
      const promise = Promise.resolve("success");

      toast.promise(promise, {
        loading: "加载中...",
        success: "成功",
        error: "失败",
      });

      expect(sonnerToast.promise).toHaveBeenCalledWith(promise, {
        loading: "加载中...",
        success: "成功",
        error: "失败",
      });
    });
  });

  describe("handleApiError", () => {
    it("应该处理 400 错误", () => {
      const error = { status: 400, message: "请求参数错误" };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalledWith(
        expect.stringContaining("请求错误"),
        expect.any(Object)
      );
    });

    it("应该处理 401 错误", () => {
      const error = { status: 401, message: "未授权" };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalledWith(
        expect.stringContaining("未授权"),
        expect.any(Object)
      );
    });

    it("应该处理 403 错误", () => {
      const error = { status: 403, message: "禁止访问" };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalledWith(
        expect.stringContaining("权限不足"),
        expect.any(Object)
      );
    });

    it("应该处理 404 错误", () => {
      const error = { status: 404, message: "未找到" };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalledWith(
        expect.stringContaining("未找到"),
        expect.any(Object)
      );
    });

    it("应该处理 429 错误", () => {
      const error = { status: 429, message: "请求过于频繁" };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalledWith(
        expect.stringContaining("请求过于频繁"),
        expect.any(Object)
      );
    });

    it("应该处理 500 错误", () => {
      const error = { status: 500, message: "服务器错误" };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalledWith(
        expect.stringContaining("服务器错误"),
        expect.any(Object)
      );
    });

    it("应该处理网络错误", () => {
      const error = { message: "Network error" };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalledWith(
        expect.stringContaining("网络错误"),
        expect.any(Object)
      );
    });

    it("应该提供默认错误消息", () => {
      const error = {};

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalled();
    });

    it("应该处理嵌套 error 对象中的状态码", () => {
      const error = { error: { status: 400, message: "参数错误" } };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalled();
    });

    it("应该根据业务错误码显示对应文案", () => {
      const error = { error: { code: "ORDER_EXPIRED", message: "Order expired" } };

      handleApiError(error);

      expect(sonnerToast.error).toHaveBeenCalledWith(
        expect.stringContaining("订单已过期"),
        expect.any(Object)
      );
    });
  });

  describe("错误消息映射", () => {
    it("应该根据状态码返回友好的错误消息", () => {
      const testCases = [
        { status: 400, expected: "请求错误" },
        { status: 401, expected: "未授权" },
        { status: 403, expected: "权限不足" },
        { status: 404, expected: "未找到" },
        { status: 429, expected: "请求过于频繁" },
        { status: 500, expected: "服务器错误" },
        { status: 503, expected: "服务不可用" },
      ];

      testCases.forEach(({ status, expected }) => {
        vi.clearAllMocks();
        handleApiError({ status, message: "Test" });

        expect(sonnerToast.error).toHaveBeenCalledWith(
          expect.stringContaining(expected),
          expect.any(Object)
        );
      });
    });
  });
});
