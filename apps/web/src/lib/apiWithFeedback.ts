import { toast } from "./toast";
import { t, formatTranslation } from "./i18n";
import { progress } from "@/components/ProgressBar";

/**
 * API 请求包装器 - 自动显示加载反馈
 *
 * 特性：
 * - 自动显示进度条
 * - 自动显示 Toast 加载提示
 * - 成功/失败自动反馈
 * - 错误处理
 *
 * @example
 * ```tsx
 * const data = await apiWithFeedback(
 *   () => fetch('/api/data').then(res => res.json()),
 *   {
 *     loadingMessage: '加载中...',
 *     successMessage: '加载成功',
 *     errorMessage: '加载失败'
 *   }
 * );
 * ```
 */
export async function apiWithFeedback<T>(
  apiFn: () => Promise<T>,
  options?: {
    loadingMessage?: string;
    successMessage?: string | ((data: T) => string);
    errorMessage?: string | ((error: Error) => string);
    showProgress?: boolean;
    showToast?: boolean;
  }
): Promise<T> {
  const {
    loadingMessage = t("common.loading"),
    successMessage,
    errorMessage = t("errors.somethingWrong"),
    showProgress = true,
    showToast = true,
  } = options || {};

  let toastId: string | number | undefined;

  try {
    // 显示加载反馈
    if (showProgress) progress.start();
    if (showToast) toastId = toast.loading(loadingMessage);

    // 执行 API 请求
    const result = await apiFn();

    // 显示成功反馈
    if (showProgress) progress.done();
    if (showToast && toastId) {
      toast.dismiss(toastId);
      if (successMessage) {
        const message =
          typeof successMessage === "function" ? successMessage(result) : successMessage;
        toast.success(message);
      }
    }

    return result;
  } catch (error) {
    // 显示失败反馈
    if (showProgress) progress.done();
    if (showToast && toastId) {
      toast.dismiss(toastId);
      const message =
        typeof errorMessage === "function"
          ? errorMessage(error as Error)
          : typeof errorMessage === "string"
            ? errorMessage
            : t("errors.somethingWrong");
      toast.error(message, error instanceof Error ? error.message : undefined);
    }

    throw error;
  }
}

/**
 * 静默 API 请求 - 只显示进度条，不显示 Toast
 */
export async function apiWithProgress<T>(apiFn: () => Promise<T>): Promise<T> {
  return apiWithFeedback(apiFn, {
    showProgress: true,
    showToast: false,
  });
}

/**
 * 简单 API 请求 - 只在失败时显示 Toast
 */
export async function apiWithErrorToast<T>(
  apiFn: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    progress.start();
    const result = await apiFn();
    progress.done();
    return result;
  } catch (error) {
    progress.done();
    const message =
      errorMessage && errorMessage.length > 0 ? errorMessage : t("errors.somethingWrong");
    toast.error(message, error instanceof Error ? error.message : undefined);
    throw error;
  }
}

/**
 * React Query 集成 - 用于 mutation
 *
 * @example
 * ```tsx
 * const mutation = useMutation({
 *   mutationFn: (data) => fetch('/api/update', {
 *     method: 'POST',
 *     body: JSON.stringify(data)
 *   }),
 *   ...reactQueryFeedback({
 *     loadingMessage: '保存中...',
 *     successMessage: '保存成功',
 *     errorMessage: '保存失败'
 *   })
 * });
 * ```
 */
export function reactQueryFeedback(options: {
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
}) {
  const {
    loadingMessage = t("common.loading"),
    successMessage = t("common.success"),
    errorMessage = t("errors.somethingWrong"),
  } = options;

  let toastId: string | number | undefined;

  return {
    onMutate: () => {
      progress.start();
      toastId = toast.loading(loadingMessage);
    },
    onSuccess: () => {
      progress.done();
      if (toastId) toast.dismiss(toastId);
      toast.success(successMessage);
    },
    onError: (error: Error) => {
      progress.done();
      if (toastId) toast.dismiss(toastId);
      toast.error(errorMessage, error.message);
    },
  };
}

/**
 * 批量操作反馈
 *
 * @example
 * ```tsx
 * await batchApiWithFeedback(
 *   items.map(item => () => deleteItem(item.id)),
 *   {
 *     loadingMessage: (current, total) => `删除中 (${current}/${total})`,
 *     successMessage: (count) => `成功删除 ${count} 项`,
 *     errorMessage: (failedCount) => `${failedCount} 项删除失败`
 *   }
 * );
 * ```
 */
export async function batchApiWithFeedback<T>(
  apiFns: (() => Promise<T>)[],
  options?: {
    loadingMessage?: (current: number, total: number) => string;
    successMessage?: (count: number) => string;
    errorMessage?: (failedCount: number) => string;
  }
): Promise<{ successes: T[]; failures: Error[] }> {
  const {
    loadingMessage = (current: number, total: number) =>
      formatTranslation(t("common.batch.loading"), { current, total }),
    successMessage = (count: number) => formatTranslation(t("common.batch.success"), { count }),
    errorMessage = (failedCount: number) =>
      formatTranslation(t("common.batch.error"), { count: failedCount }),
  } = options || {};

  const total = apiFns.length;
  let current = 0;
  const successes: T[] = [];
  const failures: Error[] = [];

  const toastId = toast.loading(loadingMessage(0, total));
  progress.start();

  for (const apiFn of apiFns) {
    try {
      const result = await apiFn();
      successes.push(result);
    } catch (error) {
      failures.push(error as Error);
    }

    current++;
    toast.dismiss(toastId);
    toast.loading(loadingMessage(current, total));
    progress.set(current / total);
  }

  progress.done();
  toast.dismiss(toastId);

  if (failures.length === 0) {
    toast.success(successMessage(successes.length));
  } else if (successes.length === 0) {
    toast.error(errorMessage(failures.length));
  } else {
    const title = t("common.batch.partialTitle");
    const description = formatTranslation(t("common.batch.partialDescription"), {
      successCount: successes.length,
      failureCount: failures.length,
    });
    toast.warning(title, description);
  }

  return { successes, failures };
}
