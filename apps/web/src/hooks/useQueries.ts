import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@/types/api";
import type { Prediction as TrendingPrediction } from "@/app/trending/trendingModel";

/**
 * Query Keys 常量
 */
export const QueryKeys = {
  predictions: ["predictions"] as const,
  prediction: (id: number) => ["prediction", id] as const,
  predictionOutcomes: (id: number) => ["prediction", id, "outcomes"] as const,

  categories: ["categories"] as const,

  userProfile: (address: string) => ["userProfile", address] as const,
  userPortfolio: (address: string) => ["userPortfolio", address] as const,
  userFollows: (address: string) => ["userFollows", address] as const,

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

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
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
    const message = (parsed as any).error?.message || (parsed as any).message || "Request failed";

    throw new Error(message);
  }

  const data: ApiResponse<T> = parsed;

  if (!data.success) {
    throw new Error(data.error?.message || "Request failed");
  }

  return data.data;
}

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

/**
 * 获取用户投资组合
 */
export function useUserPortfolio(address?: string) {
  return useQuery({
    queryKey: QueryKeys.userPortfolio(address || ""),
    queryFn: () => fetcher<any>(`/api/user-portfolio?address=${address}`),
    enabled: !!address,
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
