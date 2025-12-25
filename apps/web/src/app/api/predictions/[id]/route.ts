// 预测事件详情API路由 - 处理单个预测事件的请求
import { NextRequest } from "next/server";
import {
  handleDeletePrediction,
  handleGetPredictionDetail,
  handlePatchPrediction,
} from "./_lib/handlers";

// 预测详情可以短暂缓存
export const revalidate = 30; // 30秒缓存

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await Promise.resolve(params);
  return handleGetPredictionDetail(request, id);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await Promise.resolve(params);
  return handlePatchPrediction(request, id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(params);
  return handleDeletePrediction(request, id);
}
