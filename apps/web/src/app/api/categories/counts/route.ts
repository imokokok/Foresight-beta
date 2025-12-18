// 分类热点数量API路由 - 获取每个分类的预测事件数量
import { NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";

// 分类统计数据可以短暂缓存
export const revalidate = 60; // 1分钟缓存

export async function GET() {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json({ success: false, message: "Supabase 未配置" }, { status: 500 });
    }
    const { data: rawCategories, error: categoriesError } = await client
      .from("categories")
      .select("name");

    const categories = rawCategories as Array<{ name: string }> | null;

    if (categoriesError) {
      throw new Error(`获取分类列表失败: ${categoriesError.message}`);
    }

    const categoryCounts = [];

    const { data: rawPredictions, error: predictionsError } = await client
      .from("predictions")
      .select("id, category")
      .eq("status", "active");

    if (predictionsError) {
      console.error("查询分类事件数量失败:", predictionsError);
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
        message: "获取分类热点数量成功",
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("获取分类热点数量失败:", error);
    return NextResponse.json({ success: false, message: "获取分类热点数量失败" }, { status: 500 });
  }
}
