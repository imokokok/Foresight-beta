import { NextRequest, NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { getClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

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

    const trimmed = String(query || "").trim();
    if (!trimmed || trimmed.length < 2) {
      return NextResponse.json(
        {
          error: "Search keyword must be at least 2 characters",
          results: [],
          total: 0,
        },
        { status: 400 }
      );
    }
    if (trimmed.length > 64) {
      return NextResponse.json(
        {
          error: "Search keyword is too long",
          results: [],
          total: 0,
        },
        { status: 400 }
      );
    }
    if (/[(),]/.test(trimmed)) {
      return NextResponse.json(
        {
          error: "Search keyword contains invalid characters",
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

    const searchTerm = `%${trimmed}%`;

    const [predictionsRes, proposalsRes, usersRes] = await Promise.all([
      supabase
        .from("predictions")
        .select("id, title, description, category, status")
        .or(
          `title.ilike.${searchTerm},description.ilike.${searchTerm},category.ilike.${searchTerm}`
        )
        .eq("status", "active")
        .limit(20)
        .order("created_at", { ascending: false }),
      supabase
        .from("forum_threads")
        .select("id, event_id, title, content, category")
        .eq("event_id", 0)
        .or(`title.ilike.${searchTerm},content.ilike.${searchTerm}`)
        .limit(20)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_profiles")
        .select("wallet_address, username")
        .or(`username.ilike.${searchTerm},wallet_address.ilike.${searchTerm}`)
        .limit(10),
    ]);

    type PredictionRow = Pick<
      Database["public"]["Tables"]["predictions"]["Row"],
      "id" | "title" | "description" | "category" | "status"
    >;
    type ProposalRow = Pick<
      Database["public"]["Tables"]["forum_threads"]["Row"],
      "id" | "event_id" | "title" | "content"
    > & {
      category?: string | null;
    };
    type UserRow = Pick<
      Database["public"]["Tables"]["user_profiles"]["Row"],
      "wallet_address" | "username"
    >;

    const { data: predictions, error: predictionsError } = predictionsRes as {
      data: PredictionRow[] | null;
      error: PostgrestError | null;
    };
    const { data: proposals, error: proposalsError } = proposalsRes as {
      data: ProposalRow[] | null;
      error: PostgrestError | null;
    };
    const { data: users, error: usersError } = usersRes as {
      data: UserRow[] | null;
      error: PostgrestError | null;
    };

    if (predictionsError) {
      console.error("Search predictions error:", predictionsError);
    }

    if (proposalsError) {
      console.error("Search proposals error:", proposalsError);
    }

    if (usersError) {
      console.error("Search users error:", usersError);
    }

    const predictionResults = (predictions || []).map((p) => ({
      id: p.id,
      title: p.title || "Untitled",
      description: p.description || "No description",
      category: p.category || "Uncategorized",
      type: "prediction" as const,
    }));

    const proposalResults = (proposals || []).map((p) => ({
      id: p.id,
      title: p.title || "未命名提案",
      description: p.content || "来自 Foresight 提案广场的社区提案讨论。",
      category: p.category || "Proposal",
      type: "proposal" as const,
    }));

    const userResults = (users || []).map((u) => ({
      id: u.wallet_address,
      title: u.username || u.wallet_address,
      description: u.wallet_address,
      category: "User",
      type: "user" as const,
    }));

    const allResults = [...predictionResults, ...proposalResults, ...userResults];

    allResults.sort((a, b) => {
      const q = trimmed.toLowerCase();
      const aTitle = String(a.title || "").toLowerCase();
      const bTitle = String(b.title || "").toLowerCase();
      const aScore = aTitle.includes(q) ? 2 : 1;
      const bScore = bTitle.includes(q) ? 2 : 1;
      return bScore - aScore;
    });

    return NextResponse.json(
      {
        results: allResults,
        total: allResults.length,
        query: trimmed,
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
    const { query } = (await request.json().catch(() => ({}))) as {
      query?: string;
    };

    const trimmed = String(query || "").trim();
    if (!trimmed || trimmed.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }
    if (trimmed.length > 64) {
      return NextResponse.json({ suggestions: [] });
    }
    if (/[(),]/.test(trimmed)) {
      return NextResponse.json({ suggestions: [] });
    }

    const supabase = getClient();
    if (!supabase) {
      return NextResponse.json({ suggestions: [] });
    }

    // 只返回标题作为建议
    const searchTerm = `%${trimmed}%`;
    type TitleOnly = Pick<Database["public"]["Tables"]["predictions"]["Row"], "title">;

    const { data } = (await supabase
      .from("predictions")
      .select("title")
      .ilike("title", searchTerm)
      .eq("status", "active")
      .limit(5)) as { data: TitleOnly[] | null };

    const suggestions = (data || []).map((p) => p.title);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Search suggestions error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
