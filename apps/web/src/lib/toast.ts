import { toast as sonnerToast } from "sonner";
import { t } from "./i18n";

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

type ApiErrorPayload = {
  status?: number;
  code?: string;
  message?: string;
  error?: {
    status?: number;
    code?: string;
    message?: string;
  };
};

function extractApiErrorPayload(error: unknown): ApiErrorPayload | null {
  if (typeof error !== "object" || error === null) return null;

  const anyError = error as any;
  const payload: ApiErrorPayload = {};

  if (typeof anyError.status === "number") {
    payload.status = anyError.status;
  }

  if (typeof anyError.code === "string") {
    payload.code = anyError.code;
  }

  if (typeof anyError.message === "string") {
    payload.message = anyError.message;
  }

  if (typeof anyError.error === "object" && anyError.error !== null) {
    const inner = anyError.error as any;
    if (typeof inner.status === "number" && payload.status === undefined) {
      payload.status = inner.status;
    }
    if (typeof inner.code === "string" && !payload.code) {
      payload.code = inner.code;
    }
    if (typeof inner.message === "string" && !payload.message) {
      payload.message = inner.message;
    }
  }

  if (
    payload.status === undefined &&
    !payload.code &&
    (payload.message === undefined || payload.message === null)
  ) {
    return null;
  }

  return payload;
}

function getStatusErrorText(status: number, defaultMessageKey: string) {
  const statusKey = String(status);
  const titleKey = `errors.api.${statusKey}.title`;
  const descriptionKey = `errors.api.${statusKey}.description`;

  let title = t(titleKey);
  let description = t(descriptionKey);

  if (title === titleKey) {
    title = t(defaultMessageKey);
  }

  if (description === descriptionKey) {
    description = t("errors.tryAgain");
  }

  return { title, description };
}

function getCodeErrorText(code: string, defaultMessageKey: string) {
  const normalized = code.toUpperCase();
  const titleKey = `errors.business.${normalized}.title`;
  const descriptionKey = `errors.business.${normalized}.description`;

  let title = t(titleKey);
  let description = t(descriptionKey);

  if (title === titleKey) {
    title = t(defaultMessageKey);
  }

  if (description === descriptionKey) {
    description = t("errors.tryAgain");
  }

  return { title, description };
}

export function handleApiError(error: unknown, defaultMessage = "errors.somethingWrong") {
  // 直接使用 console 记录，避免与 logger 的循环依赖
  if (process.env.NODE_ENV === "development") {
    console.error("❌ [API Error]", error);
  }

  const payload = extractApiErrorPayload(error);

  if (payload && typeof payload.status === "number" && Number.isFinite(payload.status)) {
    const { title, description } = getStatusErrorText(payload.status, defaultMessage);
    toast.error(title, description);
    return;
  }

  if (payload && payload.code) {
    const { title, description } = getCodeErrorText(payload.code, defaultMessage);
    toast.error(title, description);
    return;
  }

  const message =
    error instanceof Error
      ? error.message
      : payload && typeof payload.message === "string"
        ? payload.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as any).message)
          : "";

  if (message.toLowerCase().includes("network")) {
    const title = t("errors.network.title");
    const description = t("errors.network.description");

    toast.error(title, description, {
      action: {
        label: t("common.retry"),
        onClick: () => window.location.reload(),
      },
    });
    return;
  }

  if (message) {
    toast.error(t(defaultMessage), message);
  } else {
    toast.error(t(defaultMessage), t("errors.tryAgain"));
  }
}
