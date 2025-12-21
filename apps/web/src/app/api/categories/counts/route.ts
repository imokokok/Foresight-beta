// 分类热点数量API路由 - 获取每个分类的预测事件数量
import { NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";

// 分类统计数据可以短暂缓存
export const revalidate = 60; // 1分钟缓存

export async function GET() {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase is not configured" },
        { status: 500 }
      );
    }
    const { data: rawCategories, error: categoriesError } = await client
      .from("categories")
      .select("name");

    const categories = rawCategories as Array<{ name: string }> | null;

    if (categoriesError) {
      throw new Error(`Failed to fetch category list: ${categoriesError.message}`);
    }

    const categoryCounts = [];

    const { data: rawPredictions, error: predictionsError } = await client
      .from("predictions")
      .select("id, category")
      .eq("status", "active");

    if (predictionsError) {
      console.error("Failed to query category event counts:", predictionsError);
    }

    const predictions = rawPredictions as Array<{ id: number; category: string }> | null;

    const countMap = new Map<string, number>();
    if (predictions) {
      for (const row of predictions) {
        const key = row.category;
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }

    if (categories) {
      for (const category of categories) {
        categoryCounts.push({
          category: category.name,
          count: countMap.get(category.name) || 0,
        });
      }
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
  } catch (error) {
    console.error("Failed to fetch category counts:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch category counts" },
      { status: 500 }
    );
  }
}
