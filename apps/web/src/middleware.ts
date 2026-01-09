import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getIP, RateLimits } from "./lib/rateLimit";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 仅对 API 路由应用限流
  if (pathname.startsWith("/api")) {
    const ip = getIP(request);

    // 根据不同的 API 路由应用不同的限流策略
    let rateLimitConfig = RateLimits.moderate;
    let rateLimitNamespace = "api";

    if (pathname === "/api/siwe/nonce") {
      rateLimitConfig = RateLimits.relaxed;
      rateLimitNamespace = "siwe_nonce";
    } else if (
      pathname.includes("/auth/") ||
      pathname.includes("/siwe/") ||
      pathname.includes("/email-otp/")
    ) {
      rateLimitConfig = RateLimits.strict; // 认证相关 - 严格限制
      rateLimitNamespace = "auth";
    } else if (
      pathname.includes("/orderbook/orders") ||
      (pathname.includes("/predictions") && request.method === "POST")
    ) {
      rateLimitConfig = RateLimits.moderate; // 写操作 - 中等限制
      rateLimitNamespace = "write";
    } else if (pathname.startsWith("/api/flags")) {
      rateLimitConfig = request.method === "GET" ? RateLimits.lenient : RateLimits.moderate;
      rateLimitNamespace = "flags";
    } else if (pathname === "/api/health") {
      rateLimitConfig = RateLimits.lenient; // 健康检查 - 极宽松
      rateLimitNamespace = "health";
    } else {
      rateLimitConfig = RateLimits.relaxed; // 读操作 - 宽松限制
      rateLimitNamespace = "read";
    }

    const result = await checkRateLimit(ip, rateLimitConfig, rateLimitNamespace);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Too many requests, please try again later",
            code: "RATE_LIMIT_EXCEEDED",
            resetAt: result.resetAt,
          },
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitConfig.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
            "Retry-After": Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 添加限流头部到响应
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", rateLimitConfig.limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", new Date(result.resetAt).toISOString());

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有 API 路由
     * 不匹配:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico, sitemap.xml, robots.txt (SEO文件)
     */
    "/api/:path*",
  ],
};
