// 分类热点数量API路由 - 获取每个分类的预测事件数量
import { NextResponse } from "next/server";
import { getServerClient as getClient } from "@/lib/supabase.server";
import { ApiResponses } from "@/lib/apiResponse";
import { getErrorMessage, logApiError } from "@/lib/serverUtils";
import { CATEGORY_MAPPING, ID_TO_CATEGORY_NAME } from "@/lib/categories";

// 分类统计数据可以短暂缓存
export const revalidate = 60; // 1分钟缓存

export async function GET() {
  try {
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase is not configured");
    }

    const categoryCounts = [];

    const { data: rawPredictions, error: predictionsError } = await client
      .from("predictions")
      .select("id, category")
      .eq("status", "active");

    if (predictionsError) {
      logApiError("GET /api/categories/counts fetch predictions failed", predictionsError);
    }

    const predictions = rawPredictions as Array<{ id: number; category: string }> | null;

    const countMap = new Map<string, number>();
    if (predictions) {
      for (const row of predictions) {
        const key = row.category;
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }

    // 使用预定义的分类映射，确保所有分类都被包含
    const categoryIds = Object.keys(ID_TO_CATEGORY_NAME);
    for (const categoryId of categoryIds) {
      categoryCounts.push({
        category: categoryId,
        count: countMap.get(categoryId) || 0,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: categoryCounts,
        message: "Fetched category counts successfully",
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: any) {
    logApiError("GET /api/categories/counts unhandled error", error);
    return ApiResponses.internalError("Failed to fetch category counts", getErrorMessage(error));
  }
}
