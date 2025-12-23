import { toast as sonnerToast } from "sonner";

/**
 * 安全的日志记录函数
 * 防止 console 调用时的错误传播
 */
function safeLog(
  level: "log" | "error" | "warn",
  prefix: string,
  message: string,
  description?: string
) {
  // 开发环境才记录日志
  if (typeof process === "undefined" || process.env.NODE_ENV !== "development") return;

  try {
    // 安全转换 description
    let desc = "";
    if (description != null) {
      try {
        desc = ` - ${String(description)}`;
      } catch {
        desc = " - [无法转换的内容]";
      }
    }

    // 使用固定的 console 方法，避免动态访问
    const logMessage = `${prefix} ${message}${desc}`;
    if (level === "error") {
      console.error(logMessage);
    } else if (level === "warn") {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  } catch (e) {
    // 完全忽略日志错误，确保不影响 Toast 显示
    // 连这个 catch 都不要记录，避免递归
  }
}

/**
 * 统一的 Toast 通知工具
 * 替代所有 alert() 调用，提供更好的用户体验
 */
export const toast = {
  /**
   * 成功提示
   */
  success: (message: string, description?: string) => {
    safeLog("log", "✅ [Toast Success]", message, description);
    return sonnerToast.success(message, {
      description,
    });
  },

  /**
   * 错误提示
   */
  error: (
    message: string,
    description?: string,
    options?: { action?: { label: string; onClick: () => void } }
  ) => {
    safeLog("error", "❌ [Toast Error]", message, description);
    return sonnerToast.error(message, {
      description,
      ...options,
    });
  },

  /**
   * 警告提示
   */
  warning: (message: string, description?: string) => {
    safeLog("warn", "⚠️ [Toast Warning]", message, description);
    return sonnerToast.warning(message, {
      description,
    });
  },

  /**
   * 信息提示
   */
  info: (message: string, description?: string) => {
    safeLog("log", "ℹ️ [Toast Info]", message, description);
    return sonnerToast.info(message, {
      description,
    });
  },

  /**
   * 加载中提示
   */
  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, {
      description,
    });
  },

  /**
   * 异步操作 Promise 提示
   */
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => {
    return sonnerToast.promise(promise, options);
  },

  /**
   * 关闭指定 Toast
   */
  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },
};

/**
 * API 错误处理器
 * 根据 HTTP 状态码返回友好的中文错误信息
 */
export function handleApiError(error: unknown, defaultMessage = "操作失败") {
  // 直接使用 console 记录，避免与 logger 的循环依赖
  if (process.env.NODE_ENV === "development") {
    console.error("❌ [API Error]", error);
  }

  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    const errorMessages: Record<number, { title: string; description: string }> = {
      400: { title: "请求错误", description: "提交的数据格式不正确" },
      401: { title: "未授权", description: "请先连接钱包并登录" },
      403: { title: "权限不足", description: "您没有权限执行此操作" },
      404: { title: "未找到", description: "请求的内容未找到" },
      409: { title: "数据冲突", description: "操作与现有数据冲突" },
      429: { title: "请求过于频繁", description: "请稍后再试" },
      500: { title: "服务器错误", description: "服务器遇到问题，请稍后重试" },
      503: { title: "服务不可用", description: "服务器维护中，请稍后再试" },
    };

    const errorInfo = errorMessages[status] || {
      title: defaultMessage,
      description: "请检查后重试",
    };

    toast.error(errorInfo.title, errorInfo.description);
    return;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as any).message)
        : "";

  if (message.toLowerCase().includes("network")) {
    toast.error("网络错误", "请检查网络连接后重试", {
      action: {
        label: "重试",
        onClick: () => window.location.reload(),
      },
    });
    return;
  }

  if (message) {
    toast.error(defaultMessage, message);
  } else {
    toast.error(defaultMessage, "请稍后重试");
  }
}
