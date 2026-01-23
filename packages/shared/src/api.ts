import { z } from "zod";

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export enum ApiErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_ADDRESS = "INVALID_ADDRESS",
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  FORBIDDEN = "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ORDER_EXPIRED = "ORDER_EXPIRED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  MARKET_CLOSED = "MARKET_CLOSED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  RATE_LIMIT = "RATE_LIMIT",
}

export const apiResponseSchema = {
  success: <T extends z.ZodType>(dataSchema: T) =>
    z.object({
      success: z.literal(true),
      data: dataSchema,
      message: z.string().optional(),
      meta: z
        .object({
          page: z.number().optional(),
          limit: z.number().optional(),
          total: z.number().optional(),
        })
        .optional(),
    }),

  error: z.object({
    success: z.literal(false),
    error: z.object({
      message: z.string(),
      code: z.string(),
      details: z.record(z.unknown()).optional(),
      timestamp: z.string(),
    }),
  }),
};

export function createApiSuccessResponse<T>(
  data: T,
  options?: { message?: string; meta?: ApiSuccessResponse["meta"] }
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(options?.message && { message: options.message }),
    ...(options?.meta && { meta: options.meta }),
  };
}

export function createApiErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

export function isApiErrorResponse(response: ApiResponse): response is ApiErrorResponse {
  return !response.success;
}

export function isApiSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success;
}
