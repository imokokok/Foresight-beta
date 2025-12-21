import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";

/**
 * 全局搜索 API
 *
 * GET /api/search?q=关键词
 *
 * 搜索范围：
 * - 预测标题和描述
 * - 用户名
 * - 分类标签
 *
 * 返回格式：
 * {
 *   results: [
 *     {
 *       id: number,
 *       title: string,
 *       description: string,
 *       category: string,
 *       type: "prediction" | "user" | "topic"
 *     }
 *   ],
 *   total: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        {
          error: "Search keyword must be at least 2 characters",
          results: [],
          total: 0,
        },
        { status: 400 }
      );
    }

    const supabase = getClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: "Database connection failed",
          results: [],
          total: 0,
        },
        { status: 500 }
      );
    }

    const searchTerm = `%${query.trim()}%`;
    const { data: predictions, error: predictionsError } = await supabase
      .from("predictions")
      .select("id, title, description, category, status")
      .or(`title.ilike.${searchTerm},description.ilike.${searchTerm},category.ilike.${searchTerm}`)
      .eq("status", "active")
      .limit(20)
      .order("created_at", { ascending: false });

    if (predictionsError) {
      console.error("Search predictions error:", predictionsError);
    }

    const predictionResults = (predictions || []).map((p: any) => ({
      id: p.id,
      title: p.title || "Untitled",
      description: p.description || "No description",
      category: p.category || "Uncategorized",
      type: "prediction" as const,
    }));

    // TODO: 搜索用户（需要 user_profiles 表）
    // const { data: users } = await supabase
    //   .from("user_profiles")
    //   .select("id, username, avatar")
    //   .ilike("username", searchTerm)
    //   .limit(10);

    // 合并所有结果
    const allResults = [...predictionResults];

    // 按相关性排序（简单实现：标题匹配优先）
    allResults.sort((a, b) => {
      const aScore = a.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
      const bScore = b.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
      return bScore - aScore;
    });

    return NextResponse.json(
      {
        results: allResults,
        total: allResults.length,
        query: query.trim(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        results: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * 搜索建议 API
 *
 * GET /api/search/suggestions?q=关键词
 *
 * 返回快速自动完成建议（更快，数据更少）
 */
export async function POST(request: NextRequest) {
  try {
    const { query, filters } = await request.json();

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const supabase = getClient();
    if (!supabase) {
      return NextResponse.json({ suggestions: [] });
    }

    // 只返回标题作为建议
    const searchTerm = `%${query.trim()}%`;
    const { data } = await supabase
      .from("predictions")
      .select("title")
      .ilike("title", searchTerm)
      .eq("status", "active")
      .limit(5);

    const suggestions = (data || []).map((p: any) => p.title);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Search suggestions error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
