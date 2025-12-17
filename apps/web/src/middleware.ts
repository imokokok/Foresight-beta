import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getIP, RateLimits } from "./lib/rateLimit";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 仅对 API 路由应用限流
  if (pathname.startsWith("/api")) {
    const ip = getIP(request);

    // 根据不同的 API 路由应用不同的限流策略
    let rateLimitConfig = RateLimits.moderate;

    if (
      pathname.includes("/auth/") ||
      pathname.includes("/siwe/") ||
      pathname.includes("/email-otp/")
    ) {
      rateLimitConfig = RateLimits.strict; // 认证相关 - 严格限制
    } else if (
      pathname.includes("/orderbook/orders") ||
      (pathname.includes("/predictions") && request.method === "POST")
    ) {
      rateLimitConfig = RateLimits.moderate; // 写操作 - 中等限制
    } else if (pathname === "/api/health") {
      rateLimitConfig = RateLimits.lenient; // 健康检查 - 极宽松
    } else {
      rateLimitConfig = RateLimits.relaxed; // 读操作 - 宽松限制
    }

    const result = checkRateLimit(ip, rateLimitConfig);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "请求过于频繁，请稍后重试",
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
