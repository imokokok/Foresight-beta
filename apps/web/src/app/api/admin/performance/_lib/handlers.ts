import { getClient } from "@/lib/supabase";
import { errorResponse, successResponse } from "@/lib/apiResponse";
import { ApiErrorCode } from "@/types/api";
import type { NextRequest } from "next/server";
import { isAdminSession } from "./auth";
import { calculateDeviceStats, calculatePageStats, calculateStats } from "./aggregate";

export async function handleAdminPerformanceGet(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "7d";
    const metric = searchParams.get("metric");

    const client = getClient();
    if (!client) {
      return errorResponse("数据库连接失败", ApiErrorCode.DATABASE_ERROR, 500);
    }

    const admin = await isAdminSession(client as any, req);
    if (!admin.ok) {
      if (admin.reason === "unauthorized")
        return errorResponse("未授权", ApiErrorCode.UNAUTHORIZED, 401);
      return errorResponse("权限不足", ApiErrorCode.FORBIDDEN, 403);
    }

    const periodDays = period === "90d" ? 90 : period === "30d" ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const webVitalsQuery = (client as any)
      .from("web_vitals")
      .select("*")
      .gte("created_at", startDate.toISOString());
    if (metric) webVitalsQuery.eq("metric_name", metric);
    const { data: webVitals, error: webVitalsError } = await webVitalsQuery;
    if (webVitalsError) throw webVitalsError;

    const { data: trends } = await (client as any)
      .from("performance_trends_daily")
      .select("*")
      .gte("day", startDate.toISOString())
      .order("day", { ascending: false })
      .limit(periodDays);

    const { data: apiStats } = await (client as any)
      .from("api_stats_hourly")
      .select("*")
      .gte("hour", startDate.toISOString())
      .order("hour", { ascending: false })
      .limit(100);

    const { data: slowApis } = await (client as any).from("slow_apis").select("*").limit(20);

    const stats = calculateStats(webVitals || []);
    const pageStats = calculatePageStats(webVitals || []);
    const deviceStats = calculateDeviceStats(webVitals || []);

    return successResponse({
      period,
      startDate: startDate.toISOString(),
      summary: stats,
      trends: trends || [],
      pageStats,
      deviceStats,
      apiStats: apiStats || [],
      slowApis: slowApis || [],
      sampleCount: (webVitals as any[])?.length || 0,
    });
  } catch (error: any) {
    console.error("[Performance API Error]:", error);
    return errorResponse(
      error.message || "服务器错误",
      ApiErrorCode.INTERNAL_ERROR,
      500,
      process.env.NODE_ENV === "development" ? error : undefined
    );
  }
}

export async function handleAdminPerformancePost(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    const client = getClient();
    if (!client) {
      return errorResponse("数据库连接失败", ApiErrorCode.DATABASE_ERROR, 500);
    }

    if (type === "web_vitals") {
      const { error } = await (client as any).from("web_vitals").insert(data);
      if (error) throw error;
    } else if (type === "custom_metrics") {
      const { error } = await (client as any).from("custom_metrics").insert(data);
      if (error) throw error;
    } else if (type === "api_performance") {
      const { error } = await (client as any).from("api_performance").insert(data);
      if (error) throw error;
    } else {
      return errorResponse("无效的数据类型", ApiErrorCode.INVALID_PARAMETERS, 400);
    }

    return successResponse({ success: true });
  } catch (error: any) {
    console.error("[Performance POST Error]:", error);
    return errorResponse(
      error.message || "服务器错误",
      ApiErrorCode.INTERNAL_ERROR,
      500,
      process.env.NODE_ENV === "development" ? error : undefined
    );
  }
}
