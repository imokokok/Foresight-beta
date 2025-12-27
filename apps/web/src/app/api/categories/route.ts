// 分类API路由 - 处理GET请求（仅使用 Supabase）
import { NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { logApiError } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

// 分类数据很少变化，可以缓存较长时间
export const revalidate = 3600; // 1小时缓存

export async function GET() {
  try {
    // 选择客户端：优先使用服务端密钥，缺失则回退匿名（需有RLS读取策略）
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }
    // 使用Supabase查询分类列表
    const { data: categories, error } = await client
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      logApiError("GET /api/categories query failed", error);
      return ApiResponses.databaseError("获取分类列表失败", error.message);
    }

    // 返回分类列表
    return NextResponse.json(
      {
        success: true,
        data: categories || [],
        message: "获取分类列表成功",
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          // 添加 HTTP 缓存头
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error: any) {
    logApiError("GET /api/categories unhandled error", error);
    const detail = error?.message || String(error);
    return ApiResponses.internalError("获取分类列表失败", detail);
  }
}
