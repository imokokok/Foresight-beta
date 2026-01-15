import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses } from "@/lib/apiResponse";
import { getSessionAddress, isAdminAddress, normalizeAddress } from "@/lib/serverUtils";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Web Vitals 数据收集 API
 *
 * 接收前端发送的性能指标并存储到数据库
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getIP(request);
    const rl = await checkRateLimit(
      ip || "unknown",
      RateLimits.lenient,
      "analytics_vitals_post_ip"
    );
    if (!rl.success) {
      return ApiResponses.rateLimit("Too many vitals events");
    }
    const metric = await request.json();

    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Database not configured");
    }

    // 存储到性能监控表
    const { error } = await (client as any).from("performance_metrics").insert({
      metric_id: metric.id,
      metric_name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      navigation_type: metric.navigationType,
      url: metric.url,
      user_agent: metric.userAgent,
      device_type: metric.deviceType,
      created_at: new Date(metric.timestamp).toISOString(),
    });

    if (error) {
      console.error("Failed to store performance metric:", error);
      return ApiResponses.databaseError("Failed to store metric", error.message);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Analytics vitals error:", error);
    return ApiResponses.internalError("Internal server error");
  }
}

/**
 * 获取性能统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysRaw = Number(searchParams.get("days") || 7);
    const days = Math.max(1, Math.min(30, Number.isFinite(daysRaw) ? Math.floor(daysRaw) : 7));
    const metricNameRaw = String(searchParams.get("metric") || "").trim();
    const metricName =
      metricNameRaw && /^[a-zA-Z0-9._:-]{1,64}$/.test(metricNameRaw) ? metricNameRaw : "";

    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Database not configured");
    }

    const viewer = normalizeAddress(await getSessionAddress(request));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized();
    const { data: prof, error: profErr } = await (client as any)
      .from("user_profiles")
      .select("is_admin")
      .eq("wallet_address", viewer)
      .maybeSingle();
    if (profErr) return ApiResponses.databaseError("Query failed", profErr.message);
    const viewerIsAdmin = !!prof?.is_admin || isAdminAddress(viewer);
    if (!viewerIsAdmin) return ApiResponses.forbidden("无权限");

    // 计算时间范围
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = (client as any)
      .from("performance_metrics")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });

    if (metricName) {
      query = query.eq("metric_name", metricName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch performance metrics:", error);
      return ApiResponses.databaseError("Failed to fetch metrics", error.message);
    }

    // 计算统计数据
    const stats = calculateStats(data || []);

    return NextResponse.json(
      {
        success: true,
        data,
        stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Analytics vitals GET error:", error);
    return ApiResponses.internalError("Internal server error");
  }
}

function calculateStats(metrics: any[]) {
  if (metrics.length === 0) {
    return {};
  }

  const grouped: Record<string, any[]> = {};
  metrics.forEach((m) => {
    if (!grouped[m.metric_name]) {
      grouped[m.metric_name] = [];
    }
    grouped[m.metric_name].push(m);
  });

  const stats: Record<string, any> = {};
  Object.keys(grouped).forEach((name) => {
    const values = grouped[name].map((m) => m.value);
    const ratings = grouped[name].map((m) => m.rating);

    stats[name] = {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      p50: percentile(values, 0.5),
      p75: percentile(values, 0.75),
      p95: percentile(values, 0.95),
      good: ratings.filter((r) => r === "good").length,
      needsImprovement: ratings.filter((r) => r === "needs-improvement").length,
      poor: ratings.filter((r) => r === "poor").length,
    };
  });

  return stats;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}
