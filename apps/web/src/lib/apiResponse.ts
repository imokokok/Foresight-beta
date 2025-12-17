import { NextResponse } from 'next/server';
import { ApiErrorCode, type ApiSuccessResponse, type ApiErrorResponse } from '@/types/api';

/**
 * 创建成功响应
 */
export function successResponse<T>(
  data: T,
  message?: string,
  meta?: { page?: number; limit?: number; total?: number }
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    meta,
  });
}

/**
 * 创建错误响应
 */
export function errorResponse(
  message: string,
  code: ApiErrorCode = ApiErrorCode.INTERNAL_ERROR,
  status: number = 500,
  details?: any
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
        details,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * 常用错误响应快捷方法
 */
export const ApiResponses = {
  // 400 错误
  badRequest: (message: string, details?: any) =>
    errorResponse(message, ApiErrorCode.VALIDATION_ERROR, 400, details),

  invalidParameters: (message: string = '参数无效') =>
    errorResponse(message, ApiErrorCode.INVALID_PARAMETERS, 400),

  // 401 错误
  unauthorized: (message: string = '未授权访问') =>
    errorResponse(message, ApiErrorCode.UNAUTHORIZED, 401),

  invalidSignature: (message: string = '签名验证失败') =>
    errorResponse(message, ApiErrorCode.INVALID_SIGNATURE, 401),

  sessionExpired: (message: string = '会话已过期') =>
    errorResponse(message, ApiErrorCode.SESSION_EXPIRED, 401),

  // 403 错误
  forbidden: (message: string = '禁止访问') =>
    errorResponse(message, ApiErrorCode.FORBIDDEN, 403),

  insufficientPermissions: (message: string = '权限不足') =>
    errorResponse(message, ApiErrorCode.INSUFFICIENT_PERMISSIONS, 403),

  // 404 错误
  notFound: (message: string = '资源不存在') =>
    errorResponse(message, ApiErrorCode.NOT_FOUND, 404),

  // 409 错误
  conflict: (message: string = '资源已存在') =>
    errorResponse(message, ApiErrorCode.ALREADY_EXISTS, 409),

  // 429 错误
  rateLimit: (message: string = '请求过于频繁，请稍后重试') =>
    errorResponse(message, ApiErrorCode.RATE_LIMIT, 429),

  // 500 错误
  internalError: (message: string = '服务器内部错误', details?: any) =>
    errorResponse(message, ApiErrorCode.INTERNAL_ERROR, 500, details),

  databaseError: (message: string = '数据库错误', details?: any) =>
    errorResponse(message, ApiErrorCode.DATABASE_ERROR, 500, details),

  // 业务逻辑错误
  orderExpired: (message: string = '订单已过期') =>
    errorResponse(message, ApiErrorCode.ORDER_EXPIRED, 400),

  insufficientBalance: (message: string = '余额不足') =>
    errorResponse(message, ApiErrorCode.INSUFFICIENT_BALANCE, 400),

  marketClosed: (message: string = '市场已关闭') =>
    errorResponse(message, ApiErrorCode.MARKET_CLOSED, 400),
};

/**
 * 包装异步 API 处理器，统一错误处理
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error: any) {
      console.error('API Error:', error);
      
      // 处理已知错误类型
      if (error.code === 'PGRST116') {
        return ApiResponses.notFound('资源不存在');
      }
      
      if (error.code === '23505') {
        return ApiResponses.conflict('资源已存在');
      }
      
      // 处理其他错误
      return ApiResponses.internalError(
        error.message || '未知错误',
        process.env.NODE_ENV === 'development' ? error.stack : undefined
      );
    }
  };
}

