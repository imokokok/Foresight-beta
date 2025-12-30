// 预测事件API路由 - 处理GET和POST请求
import { NextRequest, NextResponse } from "next/server";
import { getClient, supabase } from "@/lib/supabase";
import { getPredictionsList } from "./_lib/getPredictionsList";
import { buildPaginationMeta, buildCursorPaginationMeta, parsePagination } from "./_lib/pagination";
import { createPredictionFromRequest } from "./_lib/createPrediction";
import { ApiResponses } from "@/lib/apiResponse";
import { logApiError } from "@/lib/serverUtils";

// 预测列表可以短暂缓存
export const revalidate = 30; // 30秒缓存

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const limit = searchParams.get("limit");
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");
    const cursor = searchParams.get("cursor");
    const search = searchParams.get("search");
    const includeOutcomes = (searchParams.get("includeOutcomes") || "0") !== "0";

    // 在缺少服务密钥时使用匿名客户端降级读取
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase client is not configured");
    }

    const paging = parsePagination({ limit, page, pageSize, cursor });
    
    // 游标分页模式
    if (paging.mode === "cursor") {
      const { items, total } = await getPredictionsList(client as any, {
        category,
        status,
        search: search || undefined,
        includeOutcomes,
        limit: paging.limit,
        cursor: paging.cursor,
      });

      const cursorMeta = buildCursorPaginationMeta(items, paging.pageSize, total);

      return NextResponse.json(
        {
          success: true,
          data: items,
          message: "获取预测事件列表成功",
          cursor: cursorMeta,
          total,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
          },
        }
      );
    }

    // 传统分页模式
    const { items, total } = await getPredictionsList(client as any, {
      category,
      status,
      search: search || undefined,
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
            ? buildPaginationMeta(total, paging.currentPage, paging.pageSize)
            : undefined,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: any) {
    logApiError("GET /api/predictions", error);
    const detail = error?.message || String(error);
    return ApiResponses.internalError("Failed to fetch prediction list", detail);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 选择客户端：优先使用服务端密钥，缺失则回退匿名（需有RLS读取策略）
    const client = getClient() || supabase;
    if (!client) {
      return ApiResponses.internalError("Supabase client is not configured");
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
  } catch (error: any) {
    logApiError("POST /api/predictions", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error?.message || "Failed to create prediction";
    const details = {
      error: error instanceof Error ? error.message : String(error),
      missingFields: (error as any)?.missingFields,
      duplicateEvents: (error as any)?.duplicateEvents,
    };
    if (status === 400) {
      return ApiResponses.invalidParameters(message);
    }
    return ApiResponses.internalError(message, details);
  }
}
