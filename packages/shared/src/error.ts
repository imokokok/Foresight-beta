import { z } from "zod";

export enum AppErrorCode {
  UNKNOWN = "UNKNOWN",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  CONFLICT = "CONFLICT",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  TIMEOUT = "TIMEOUT",
}

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface AppError {
  code: AppErrorCode | string;
  message: string;
  details?: Record<string, unknown>;
  severity?: ErrorSeverity;
  cause?: Error;
  timestamp: string;
  requestId?: string;
}

export interface AppErrorResponse {
  success: false;
  error: AppError;
}

export const appErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  severity: z.enum(["info", "warning", "error", "critical"]).optional(),
  cause: z.any().optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

export function createAppError(
  code: AppErrorCode | string,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    severity?: ErrorSeverity;
    cause?: Error;
    requestId?: string;
  }
): AppError {
  return {
    code,
    message,
    ...(options?.details && { details: options.details }),
    ...(options?.severity && { severity: options.severity }),
    ...(options?.cause && { cause: options.cause }),
    requestId: options?.requestId,
    timestamp: new Date().toISOString(),
  };
}

export function createAppErrorResponse(error: AppError): AppErrorResponse {
  return {
    success: false,
    error,
  };
}

export function isRecoverableError(error: AppError): boolean {
  const nonRecoverableCodes = [
    AppErrorCode.INVALID_INPUT,
    AppErrorCode.RESOURCE_NOT_FOUND,
    AppErrorCode.FORBIDDEN,
  ];
  return !nonRecoverableCodes.includes(error.code as AppErrorCode);
}

export class DomainError extends Error {
  public readonly code: AppErrorCode | string;
  public readonly details?: Record<string, unknown>;
  public readonly severity: ErrorSeverity;

  constructor(
    code: AppErrorCode | string,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      severity?: ErrorSeverity;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "DomainError";
    this.code = code;
    this.details = options?.details;
    this.severity = options?.severity || "error";
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    options?: {
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(AppErrorCode.VALIDATION_ERROR, message, {
      ...options,
      severity: "warning",
    });
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(
    resource: string,
    id: string,
    options?: {
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(
      AppErrorCode.RESOURCE_NOT_FOUND,
      `${resource} not found: ${id}`,
      options
    );
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends DomainError {
  constructor(
    message: string = "Unauthorized",
    options?: {
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(AppErrorCode.UNAUTHORIZED, message, {
      ...options,
      severity: "warning",
    });
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends DomainError {
  constructor(
    message: string,
    options?: {
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(AppErrorCode.CONFLICT, message, options);
    this.name = "ConflictError";
  }
}
