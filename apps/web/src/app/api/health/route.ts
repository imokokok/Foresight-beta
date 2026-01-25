import { NextRequest, NextResponse } from "next/server";
import { getServerClient as getClient } from "@/lib/supabase.server";
import {
  getErrorMessage,
  getGaslessConfig,
  getProxyWalletConfig,
  logApiError,
} from "@/lib/serverUtils";

// 健康检查结果接口
interface HealthCheck {
  ok: boolean;
  message?: string;
  latency?: number;
  timestamp?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  environment: {
    node: string;
    nextjs: string;
  };
  checks: Record<string, HealthCheck>;
  config: Record<string, boolean>;
}

const startTime = Date.now();

export async function GET(_req: NextRequest) {
  try {
    const timestamp = new Date().toISOString();

    // 环境变量检查
    const proxyWallet = getProxyWalletConfig();
    const gasless = getGaslessConfig();
    const config = {
      NEXT_PUBLIC_SUPABASE_URL: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").length > 0,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").length > 0,
      NEXT_PUBLIC_RELAYER_URL: (process.env.NEXT_PUBLIC_RELAYER_URL || "").length > 0,
      SUPABASE_SERVICE_ROLE_KEY: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").length > 0,
      JWT_SECRET: (process.env.JWT_SECRET || "").length > 0,
      PROXY_WALLET_CONFIG_OK: proxyWallet.ok,
      GASLESS_CONFIG_OK: gasless.ok,
    };

    // 基础连通性与表存在检查
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        {
          status: "unhealthy",
          message: "Supabase 未配置",
          timestamp,
        },
        { status: 503 }
      );
    }

    const checks: Record<string, HealthCheck> = {};

    // 1. 数据库连接检查
    const dbStart = Date.now();
    try {
      const { error: pingError } = await client.from("predictions").select("id").limit(1);

      checks.database = {
        ok: !pingError,
        latency: Date.now() - dbStart,
        timestamp,
      };
      if (pingError) checks.database.message = pingError.message;
    } catch (e) {
      const error = e as Error;
      checks.database = {
        ok: false,
        message: getErrorMessage(error),
        latency: Date.now() - dbStart,
        timestamp,
      };
    }

    // 2. Relayer 服务检查
    const relayerStart = Date.now();
    try {
      const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_URL;
      if (relayerUrl) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

        const resp = await fetch(relayerUrl, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        checks.relayer = {
          ok: resp.ok,
          latency: Date.now() - relayerStart,
          message: resp.ok ? undefined : resp.statusText,
          timestamp,
        };
      } else {
        checks.relayer = {
          ok: false,
          message: "Relayer URL 未配置",
          timestamp,
        };
      }
    } catch (e) {
      const error = e as Error;
      checks.relayer = {
        ok: false,
        message: error?.name === "AbortError" ? "Timeout" : getErrorMessage(error),
        latency: Date.now() - relayerStart,
        timestamp,
      };
    }

    // 3. 关键表检查
    const tables = ["predictions", "event_follows", "orders", "user_profiles"];
    for (const table of tables) {
      try {
        const { error } = await client
          .from(table)
          .select("*", { head: true, count: "exact" })
          .limit(0);
        checks[`table_${table}`] = { ok: !error, timestamp };
        if (error) checks[`table_${table}`].message = error.message;
      } catch (e) {
        const error = e as Error;
        checks[`table_${table}`] = {
          ok: false,
          message: getErrorMessage(error),
          timestamp,
        };
      }
    }

    // 4. 物化视图检查（如果存在）
    try {
      const { error } = await client
        .from("event_followers_count")
        .select("*", { head: true })
        .limit(0);
      checks.materialized_views = {
        ok: !error,
        message: error ? "Materialized views not created" : "OK",
        timestamp,
      };
    } catch (e) {
      const error = e as Error;
      checks.materialized_views = {
        ok: false,
        message: "Materialized views not created or not accessible",
        timestamp,
      };
    }

    // 5. 内存使用检查
    if (typeof process !== "undefined" && process.memoryUsage) {
      const mem = process.memoryUsage();
      const memMB = Math.round(mem.heapUsed / 1024 / 1024);
      const maxMemMB = Math.round(mem.heapTotal / 1024 / 1024);

      checks.memory = {
        ok: memMB < maxMemMB * 0.9, // 90% 以下正常
        message: `${memMB}MB / ${maxMemMB}MB`,
        timestamp,
      };
    }

    // 计算整体状态
    const allChecks = Object.values(checks);
    const failedChecks = allChecks.filter((c) => !c.ok);
    const criticalFailed = !checks.database?.ok;

    let overallStatus: "healthy" | "degraded" | "unhealthy";
    if (criticalFailed) {
      overallStatus = "unhealthy";
    } else if (failedChecks.length > 0) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || "0.1.0",
      environment: {
        node: process.version,
        nextjs: "15.5.4",
      },
      checks,
      config,
    };

    // 根据状态返回不同的 HTTP 状态码
    const httpStatus = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error: any) {
    logApiError("GET /api/health", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
