// 分类API路由 - 处理GET请求（仅使用 Supabase）
import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAnon } from "@/lib/supabase.server";
import { getErrorMessage, logApiError } from "@/lib/serverUtils";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

// 分类数据很少变化，可以缓存较长时间
export const revalidate = 3600; // 1小时缓存

export async function GET() {
  try {
    const client = supabaseAdmin || supabaseAnon;
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }
    const { data: categories, error } = await client
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      logApiError("GET /api/categories query failed", error);
      return ApiResponses.databaseError("获取分类列表失败", error.message);
    }

    return successResponse(categories || [], "获取分类列表成功");
  } catch (error) {
    const err = error as Error;
    logApiError("GET /api/categories unhandled error", err);
    return ApiResponses.internalError("获取分类列表失败", getErrorMessage(err));
  }
}
