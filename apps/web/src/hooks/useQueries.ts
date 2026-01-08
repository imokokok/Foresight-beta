import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeAddress } from "@/lib/cn";
import type { ApiResponse } from "@/types/api";
import type { Prediction as TrendingPrediction } from "@/features/trending/trendingModel";
import type { UserProfile } from "@/lib/supabase";
import type {
  PortfolioStats,
  ProfileHistoryItem,
  ProfilePosition,
  ProfileUserSummary,
} from "@/app/profile/types";

/**
 * Query Keys 常量
 */
export const QueryKeys = {
  predictions: ["predictions"] as const,
  prediction: (id: number) => ["prediction", id] as const,
  predictionOutcomes: (id: number) => ["prediction", id, "outcomes"] as const,

  categories: ["categories"] as const,

  userProfile: (address: string) => ["userProfile", address] as const,
  userHistory: (address: string) => ["userHistory", address] as const,
  userPortfolio: (address: string) => ["userPortfolio", address] as const,
  userFollows: (address: string) => ["userFollows", address] as const,
  userFollowCounts: (address: string) => ["profile", "follows", "counts", address] as const,
  userFollowStatus: (target: string, follower: string | null | undefined) =>
    ["profile", "follows", "status", target, follower] as const,
  profileFollowersUsers: (address: string) => ["profile", "followers", address] as const,
  profileFollowingUsers: (address: string) => ["profile", "following", "users", address] as const,

  orders: (params: {
    chainId?: number;
    contract?: string;
    maker?: string;
    status?: string;
    marketKey?: string;
  }) => ["orders", params] as const,
  orderDepth: (contract: string, chainId: number, outcomeIndex: number) =>
    ["orderDepth", contract, chainId, outcomeIndex] as const,

  flags: (userId?: string) => ["flags", userId] as const,
  flag: (id: number) => ["flag", id] as const,

  forumThreads: (eventId: number) => ["forumThreads", eventId] as const,

  market: (contract: string, chainId: number) => ["market", contract, chainId] as const,
} as const;

export type UserFollowToggleResult = {
  followed: boolean;
};

export async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");

    if (text && text.trim().startsWith("<!DOCTYPE html")) {
      throw new Error("Server returned an HTML error page");
    }

    throw new Error("Unexpected response format");
  }

  let parsed: ApiResponse<T>;

  try {
    parsed = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error("Invalid JSON response");
  }

  if (!response.ok) {
    const raw: any = parsed || {};
    const message = raw.error?.message || raw.message || "Request failed";
    const error = new Error(message);
    (error as any).status = response.status;
    if (raw && typeof raw === "object") {
      if ("error" in raw) {
        (error as any).error = raw.error;
      } else {
        (error as any).error = raw;
      }
      const code =
        typeof raw.code === "string"
          ? raw.code
          : raw.error && typeof raw.error.code === "string"
            ? raw.error.code
            : undefined;
      if (code) {
        (error as any).code = code;
      }
    }
    throw error;
  }

  const data: ApiResponse<T> = parsed;

  if (!data.success) {
    const message = data.error?.message || "Request failed";
    const error = new Error(message);
    (error as any).status = response.status;
    (error as any).error = data.error;
    if (data.error && typeof data.error.code === "string") {
      (error as any).code = data.error.code;
    }
    throw error;
  }

  return data.data;
}

export type EmailOtpRequestResult = {
  expiresInSec: number;
  codePreview?: string;
};

export type EmailOtpVerifyResult = {
  ok: boolean;
};

export function useCategories() {
  return useQuery({
    queryKey: QueryKeys.categories,
    queryFn: () => fetcher<any[]>("/api/categories"),
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * 获取预测列表
 */
export function usePredictions(
  params?: { category?: string; status?: string; limit?: number },
  options?: { initialData?: TrendingPrediction[] }
) {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", params.limit.toString());

  return useQuery({
    queryKey: [...QueryKeys.predictions, params],
    queryFn: () => fetcher<TrendingPrediction[]>(`/api/predictions?${query.toString()}`),
    staleTime: 3 * 60 * 1000, // 3分钟
    initialData: options?.initialData,
  });
}

/**
 * 获取单个预测详情
 */
export function usePrediction(id: number, options?: { includeOutcomes?: boolean }) {
  const query = new URLSearchParams();
  if (options?.includeOutcomes) query.set("includeOutcomes", "1");

  return useQuery({
    queryKey: QueryKeys.prediction(id),
    queryFn: () => fetcher<any>(`/api/predictions/${id}?${query.toString()}`),
    staleTime: 5 * 60 * 1000, // 5分钟
    enabled: id > 0,
  });
}

export type UserProfileInfoResponse = {
  profile: UserProfile | null;
  profiles: UserProfile[];
};

export function useUserProfileInfo(address?: string | null) {
  const norm = address ? normalizeAddress(address) : null;
  return useQuery<UserProfileInfoResponse | null>({
    queryKey: QueryKeys.userProfile(norm || ""),
    queryFn: () =>
      norm
        ? fetcher<UserProfileInfoResponse>(`/api/user-profiles?address=${encodeURIComponent(norm)}`)
        : Promise.resolve(null),
    enabled: !!norm,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserHistory(address?: string | null) {
  const norm = address ? normalizeAddress(address) : null;
  return useQuery<ProfileHistoryItem[]>({
    queryKey: QueryKeys.userHistory(norm || ""),
    queryFn: () =>
      norm
        ? fetcher<ProfileHistoryItem[]>(`/api/history?address=${encodeURIComponent(norm)}`)
        : Promise.resolve([]),
    enabled: !!norm,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUserFollowCounts(address?: string | null) {
  const norm = address ? normalizeAddress(address) : null;
  return useQuery({
    queryKey: QueryKeys.userFollowCounts(norm || ""),
    queryFn: () =>
      norm
        ? fetcher<{
            followersCount: number;
            followingCount: number;
          }>(`/api/user-follows/counts?address=${encodeURIComponent(norm)}`)
        : Promise.resolve({
            followersCount: 0,
            followingCount: 0,
          }),
    enabled: !!norm,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUserFollowStatus(target?: string | null, follower?: string | null) {
  const targetNorm = target ? normalizeAddress(target) : null;
  const followerNorm = follower ? normalizeAddress(follower) : null;
  return useQuery({
    queryKey: QueryKeys.userFollowStatus(targetNorm || "", followerNorm || ""),
    queryFn: () =>
      targetNorm && followerNorm && targetNorm !== followerNorm
        ? fetcher<{ followed: boolean }>(
            `/api/user-follows/user?targetAddress=${encodeURIComponent(
              targetNorm
            )}&followerAddress=${encodeURIComponent(followerNorm)}`
          ).then((res) => Boolean(res.followed))
        : Promise.resolve(false),
    enabled: !!targetNorm && !!followerNorm && targetNorm !== followerNorm,
    staleTime: 30 * 1000,
  });
}

export function useFollowersUsers(address?: string | null) {
  const norm = address ? normalizeAddress(address) : null;
  return useQuery<ProfileUserSummary[]>({
    queryKey: QueryKeys.profileFollowersUsers(norm || ""),
    queryFn: () =>
      norm
        ? fetcher<{ users: ProfileUserSummary[] }>(
            `/api/user-follows/followers-users?address=${encodeURIComponent(norm)}`
          ).then((res) => (Array.isArray(res.users) ? res.users : []))
        : Promise.resolve([]),
    enabled: !!norm,
    staleTime: 2 * 60 * 1000,
  });
}

export function useFollowingUsers(address?: string | null) {
  const norm = address ? normalizeAddress(address) : null;
  return useQuery<ProfileUserSummary[]>({
    queryKey: QueryKeys.profileFollowingUsers(norm || ""),
    queryFn: () =>
      norm
        ? fetcher<{ users: ProfileUserSummary[] }>(
            `/api/user-follows/following-users?address=${encodeURIComponent(norm)}`
          ).then((res) => (Array.isArray(res.users) ? res.users : []))
        : Promise.resolve([]),
    enabled: !!norm,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * 获取用户投资组合
 */
export function useUserPortfolio(address?: string | null) {
  const norm = address ? normalizeAddress(address) : null;
  return useQuery<{
    positions?: ProfilePosition[];
    stats?: {
      total_invested?: number;
      active_count?: number;
      win_rate?: string;
      realized_pnl?: number;
    };
  }>({
    queryKey: QueryKeys.userPortfolio(norm || ""),
    queryFn: () =>
      norm
        ? fetcher<{
            positions?: ProfilePosition[];
            stats?: {
              total_invested?: number;
              active_count?: number;
              win_rate?: string;
              realized_pnl?: number;
            };
          }>(`/api/user-portfolio?address=${encodeURIComponent(norm)}`)
        : Promise.resolve({
            positions: [],
            stats: {
              total_invested: 0,
              active_count: 0,
              win_rate: "0%",
              realized_pnl: 0,
            },
          }),
    enabled: !!norm,
    staleTime: 2 * 60 * 1000, // 2分钟
  });
}

/**
 * 获取订单列表
 */
export function useOrders(params: {
  chainId?: number;
  contract?: string;
  maker?: string;
  status?: string;
  marketKey?: string;
}) {
  const query = new URLSearchParams();
  if (params.chainId) query.set("chainId", params.chainId.toString());
  if (params.contract) query.set("contract", params.contract);
  if (params.maker) query.set("maker", params.maker);
  if (params.status) query.set("status", params.status);
  if (params.marketKey) query.set("marketKey", params.marketKey);

  return useQuery({
    queryKey: QueryKeys.orders(params),
    queryFn: () => fetcher<any[]>(`/api/orderbook/orders?${query.toString()}`),
    staleTime: 30 * 1000, // 30秒（订单数据更新频繁）
    refetchInterval: 60 * 1000, // 每分钟自动刷新
  });
}

/**
 * 创建订单 Mutation
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: any) => {
      return fetcher<any>("/api/orderbook/orders", {
        method: "POST",
        body: JSON.stringify(orderData),
      });
    },
    onSuccess: (data, variables) => {
      // 刷新相关订单列表
      queryClient.invalidateQueries({
        queryKey: ["orders"],
      });

      // 刷新订单深度
      if (variables.verifyingContract && variables.chainId) {
        queryClient.invalidateQueries({
          queryKey: ["orderDepth", variables.verifyingContract, variables.chainId],
        });
      }
    },
  });
}

/**
 * 关注事件 Mutation
 */
export function useFollowEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: number; userId: string }) => {
      return fetcher<any>("/api/follows", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId, user_id: userId }),
      });
    },
    onSuccess: (data, variables) => {
      // 刷新用户关注列表
      queryClient.invalidateQueries({
        queryKey: QueryKeys.userFollows(variables.userId),
      });

      // 刷新事件详情（关注数变化）
      queryClient.invalidateQueries({
        queryKey: QueryKeys.prediction(variables.eventId),
      });

      // 刷新预测列表
      queryClient.invalidateQueries({
        queryKey: QueryKeys.predictions,
      });
    },
  });
}

/**
 * 取消关注事件 Mutation
 */
export function useUnfollowEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: number; userId: string }) => {
      return fetcher<any>("/api/follows", {
        method: "DELETE",
        body: JSON.stringify({ event_id: eventId, user_id: userId }),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.userFollows(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.prediction(variables.eventId),
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.predictions,
      });
    },
  });
}
