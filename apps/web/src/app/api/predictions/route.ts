// 预测事件API路由 - 处理GET和POST请求
import { NextRequest, NextResponse } from "next/server";
import { getClient, supabase } from "@/lib/supabase";
import { getPredictionsList } from "./_lib/getPredictionsList";
import { buildPaginationMeta, parsePagination } from "./_lib/pagination";
import { createPredictionFromRequest } from "./_lib/createPrediction";

// 预测列表可以短暂缓存
export const revalidate = 30; // 30秒缓存

export async function GET(request: NextRequest) {
  try {
    // 对于获取预测事件列表，允许匿名访问（不需要登录）
    // 只有创建预测事件等敏感操作才需要登录验证

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const limit = searchParams.get("limit");
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");
    const includeOutcomes = (searchParams.get("includeOutcomes") || "0") !== "0";

    // 在缺少服务密钥时使用匿名客户端降级读取
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase client is not configured" },
        { status: 500 }
      );
    }

    const paging = parsePagination({ limit, page, pageSize });
    const { items, total } = await getPredictionsList(client as any, {
      category,
      status,
      includeOutcomes,
      range: paging.mode === "paged" ? paging.range : undefined,
      limit: paging.mode === "limit" ? paging.limit : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: items,
        message: "获取预测事件列表成功",
        pagination:
          page && pageSize
            ? {
                ...buildPaginationMeta(total, paging.currentPage, paging.pageSize),
              }
            : undefined,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=5, stale-while-revalidate=20",
        },
      }
    );
  } catch (error) {
    console.error("Unexpected error while fetching prediction list:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch prediction list" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 选择客户端：优先使用服务端密钥，缺失则回退匿名（需有RLS读取策略）
    const client = getClient() || supabase;
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase client is not configured" },
        { status: 500 }
      );
    }

    const { newPrediction } = await createPredictionFromRequest(request, client as any);

    return NextResponse.json(
      {
        success: true,
        data: newPrediction,
        message: "Prediction created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error while creating prediction:", error);
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    return NextResponse.json(
      {
        success: false,
        message: (error as any)?.message || "Failed to create prediction",
        error: error instanceof Error ? error.message : String(error),
        missingFields: (error as any)?.missingFields,
        duplicateEvents: (error as any)?.duplicateEvents,
      },
      { status }
    );
  }
}
