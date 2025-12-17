// API 响应类型定义

export interface ApiError {
  message: string;
  code: string;
  details?: any;
  timestamp: string;
}

export interface ApiSuccessResponse<T = any> {
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

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// 错误代码
export enum ApiErrorCode {
  // 认证相关
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // 验证相关
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  
  // 资源相关
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // 权限相关
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // 业务逻辑
  ORDER_EXPIRED = 'ORDER_EXPIRED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  MARKET_CLOSED = 'MARKET_CLOSED',
  
  // 系统相关
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
}

