import { createAppError, AppError, AppErrorCode, type ErrorSeverity } from "@foresight/shared/error";

let globalErrorHandler: ((error: AppError) => void) | null = null;
let globalRequestIdCounter = 0;

export function generateRequestId(): string {
  globalRequestIdCounter++;
  const timestamp = Date.now().toString(36);
  const counter = globalRequestIdCounter.toString(36).padStart(4, "0");
  return `req_${timestamp}_${counter}`;
}

export function setGlobalErrorHandler(handler: (error: AppError) => void): void {
  globalErrorHandler = handler;
}

export function handleError(
  error: unknown,
  options?: {
    code?: AppErrorCode | string;
    severity?: ErrorSeverity;
    context?: Record<string, unknown>;
    requestId?: string;
  }
): AppError {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = options?.context
      ? {
          ...error,
          details: { ...error.details, ...options.context },
        }
      : error;
  } else if (error instanceof Error) {
    appError = createAppError(
      options?.code || AppErrorCode.UNKNOWN,
      error.message,
      {
        details: options?.context,
        severity: options?.severity,
        cause: error,
        requestId: options?.requestId,
      }
    );
  } else {
    appError = createAppError(
      options?.code || AppErrorCode.UNKNOWN,
      String(error),
      {
        details: options?.context,
        severity: options?.severity,
        requestId: options?.requestId,
      }
    );
  }

  if (globalErrorHandler) {
    globalErrorHandler(appError);
  }

  console.error("[Error]", JSON.stringify(appError, null, 2));

  return appError;
}

export function createValidationError(
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  return createAppError(AppErrorCode.VALIDATION_ERROR, message, {
    details,
    severity: "warning",
    requestId,
  });
}

export function createNotFoundError(
  resource: string,
  id: string,
  requestId?: string
): AppError {
  return createAppError(AppErrorCode.RESOURCE_NOT_FOUND, `${resource} not found: ${id}`, {
    requestId,
  });
}

export function createUnauthorizedError(
  message: string = "Unauthorized",
  requestId?: string
): AppError {
  return createAppError(AppErrorCode.UNAUTHORIZED, message, {
    severity: "warning",
    requestId,
  });
}

export function createInternalError(
  message: string = "Internal server error",
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  return createAppError(AppErrorCode.INTERNAL_ERROR, message, {
    details,
    severity: "critical",
    requestId,
  });
}

export function isRecoverable(error: AppError): boolean {
  const nonRecoverableCodes = [
    AppErrorCode.VALIDATION_ERROR,
    AppErrorCode.INVALID_INPUT,
    AppErrorCode.RESOURCE_NOT_FOUND,
    AppErrorCode.FORBIDDEN,
  ];
  return !nonRecoverableCodes.includes(error.code as AppErrorCode);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return AppErrorCode.UNKNOWN;
}
