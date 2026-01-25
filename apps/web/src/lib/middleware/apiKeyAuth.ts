import { NextRequest } from "next/server";
import { ApiResponses } from "@/lib/apiResponse";

const API_KEYS_ENABLED = process.env.API_KEYS_ENABLED === "true";

/**
 * API密钥认证中间件
 *
 * 注意：API Keys 功能当前处于开发阶段。
 * 要启用此功能，请设置环境变量 API_KEYS_ENABLED=true，
 * 并实现 compareApiKey 和 validateApiKeyScopes 函数。
 *
 * @param req - Next.js请求对象
 * @param allowedScopes - 允许的作用域列表
 * @returns 认证成功返回API密钥信息，失败返回错误响应
 */
export async function apiKeyAuth(req: NextRequest, allowedScopes: string[]) {
  if (!API_KEYS_ENABLED) {
    return ApiResponses.unauthorized(
      "API Keys feature is not enabled. Set API_KEYS_ENABLED=true environment variable to enable."
    );
  }
  return ApiResponses.unauthorized("API Key authentication not implemented");
}

/**
 * API密钥认证装饰器，用于保护API路由
 *
 * 注意：此装饰器当前返回 401 错误。
 * 要启用 API Key 认证，请设置 API_KEYS_ENABLED=true 并实现认证逻辑。
 *
 * @param allowedScopes - 允许的作用域列表
 */
export function withApiKeyAuth(allowedScopes: string[]) {
  return function (handler: (req: NextRequest, apiKey: any) => Promise<Response>) {
    return async (req: NextRequest) => {
      return ApiResponses.unauthorized(
        "API Keys feature is not enabled. Set API_KEYS_ENABLED=true environment variable to enable."
      );
    };
  };
}
