import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getIP, RateLimits } from "./lib/rateLimit";
import { createRefreshToken, createToken, verifyToken } from "./lib/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 仅对 API 路由应用限流
  if (pathname.startsWith("/api")) {
    const ip = getIP(request);
    const sessionCookie = request.cookies.get("fs_session")?.value || "";
    const sessionPayload = sessionCookie ? await verifyToken(sessionCookie) : null;
    const identifier = sessionPayload?.address ? `addr:${sessionPayload.address}` : `ip:${ip}`;

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

    const result = await checkRateLimit(identifier, rateLimitConfig, rateLimitNamespace);

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

    const refreshCookie = request.cookies.get("fs_refresh")?.value || "";

    let refreshedSession: string | null = null;
    let refreshedRefresh: string | null = null;

    if (refreshCookie) {
      if (!sessionPayload) {
        const refreshPayload = await verifyToken(refreshCookie);
        if (refreshPayload?.address) {
          refreshedSession = await createToken(refreshPayload.address, refreshPayload.chainId);
          refreshedRefresh = await createRefreshToken(
            refreshPayload.address,
            refreshPayload.chainId
          );
        }
      }
    }

    const response =
      refreshedSession && refreshedRefresh
        ? (() => {
            const requestHeaders = new Headers(request.headers);
            const cookieHeader = requestHeaders.get("cookie") || "";
            const parts = cookieHeader
              .split(";")
              .map((p) => p.trim())
              .filter((p) => p.length > 0)
              .filter((p) => !p.startsWith("fs_session=") && !p.startsWith("fs_refresh="));

            parts.push(`fs_session=${refreshedSession}`, `fs_refresh=${refreshedRefresh}`);
            requestHeaders.set("cookie", parts.join("; "));

            const res = NextResponse.next({ request: { headers: requestHeaders } });
            res.cookies.set("fs_session", refreshedSession, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
              maxAge: 7 * 24 * 60 * 60,
            });
            res.cookies.set("fs_refresh", refreshedRefresh, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
              maxAge: 30 * 24 * 60 * 60,
            });
            return res;
          })()
        : NextResponse.next();

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
