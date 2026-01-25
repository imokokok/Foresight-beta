/**
 * 性能监控仪表板 API
 * 提供性能数据查询接口（仅管理员）/ 上报接口（客户端）
 */

import type { NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/apiResponse";
import { handleAdminPerformanceGet, handleAdminPerformancePost } from "./_lib/handlers";

export const GET = withErrorHandler(async (req: NextRequest) => {
  return handleAdminPerformanceGet(req);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  return handleAdminPerformancePost(req);
});
