import { normalizeAddress } from "@/lib/cn";

export interface FollowStatus {
  following: boolean;
  followersCount: number;
}

interface ApiErrorBody {
  message?: string;
  detail?: string;
  setupRequired?: boolean;
  sql?: string;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  });
  return qs.toString();
}

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return await res.json();
  } catch {
    // 非 JSON 返回
    return {} as T;
  }
}

export async function getFollowStatus(
  predictionId: number,
  walletAddress?: string
): Promise<FollowStatus> {
  const addr = walletAddress ? normalizeAddress(walletAddress) : undefined;
  const qs = buildQuery({ predictionId, walletAddress: addr });
  const res = await fetch(`/api/follows?${qs}`, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const errBody = await parseJson<ApiErrorBody>(res);
    throw new Error(errBody?.message || `获取关注状态失败: ${res.status}`);
  }
  const data = await parseJson<FollowStatus & ApiErrorBody>(res);
  return { following: !!data.following, followersCount: Number(data.followersCount ?? 0) };
}

export async function followPrediction(predictionId: number, walletAddress: string): Promise<void> {
  const params = new URLSearchParams({
    predictionId: String(predictionId),
    walletAddress: normalizeAddress(walletAddress),
  });
  const res = await fetch("/api/follows", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const errBody = await parseJson<ApiErrorBody>(res);
    throw new Error(errBody?.message || `关注失败: ${res.status}`);
  }
}

export async function unfollowPrediction(
  predictionId: number,
  walletAddress: string
): Promise<void> {
  const params = new URLSearchParams({
    predictionId: String(predictionId),
    walletAddress: normalizeAddress(walletAddress),
  });
  const res = await fetch("/api/follows", {
    method: "DELETE",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const errBody = await parseJson<ApiErrorBody>(res);
    throw new Error(errBody?.message || `取消关注失败: ${res.status}`);
  }
}

export async function toggleFollowPrediction(
  following: boolean,
  predictionId: number,
  walletAddress: string
): Promise<boolean> {
  if (following) {
    await unfollowPrediction(predictionId, walletAddress);
    return false;
  }
  await followPrediction(predictionId, walletAddress);
  return true;
}

import { normalizeId } from "@/lib/ids";

export async function getFollowersCountsBatch(eventIds: number[]): Promise<Record<number, number>> {
  const res = await fetch("/api/follows/counts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventIds }),
  });
  if (!res.ok) {
    const errBody = await parseJson<ApiErrorBody>(res);
    throw new Error(errBody?.message || `批量计数查询失败: ${res.status}`);
  }
  const data = await parseJson<{ counts?: Record<string, number> } & ApiErrorBody>(res);
  const counts: Record<number, number> = {};
  Object.entries(data.counts || {}).forEach(([k, v]) => {
    const id = normalizeId(k);
    if (id != null) counts[id] = Number(v || 0);
  });
  return counts;
}
