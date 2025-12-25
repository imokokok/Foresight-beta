/**
 * 性能监控仪表板 API
 * 提供性能数据查询接口（仅管理员）/ 上报接口（客户端）
 */

import type { NextRequest } from "next/server";
import { handleAdminPerformanceGet, handleAdminPerformancePost } from "./_lib/handlers";

export async function GET(req: NextRequest) {
  return handleAdminPerformanceGet(req);
}

export async function POST(req: NextRequest) {
  return handleAdminPerformancePost(req);
}
