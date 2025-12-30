import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

export type PredictionItem = {
  id: number;
  title: string;
  description?: string;
  category?: string;
  created_at?: string;
  followers_count?: number;
};

type CursorMeta = {
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
};

type PredictionsResponse = {
  success: boolean;
  data: PredictionItem[];
  cursor: CursorMeta;
  total: number;
};

type UseInfinitePredictionsParams = {
  category?: string;
  search?: string;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;

// 预取下一页的函数
async function fetchPredictionsPage(
  params: UseInfinitePredictionsParams,
  cursor?: string
): Promise<PredictionsResponse> {
  const { category, search, pageSize = DEFAULT_PAGE_SIZE } = params;
  const query = new URLSearchParams();
  query.set("limit", String(pageSize));

  if (category && category !== "all") {
    query.set("category", category);
  }
  if (search) {
    query.set("search", search);
  }
  if (cursor) {
    query.set("cursor", cursor);
  }

  const res = await fetch(`/api/predictions?${query.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to fetch predictions");
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || "Failed to fetch predictions");
  }

  return json as PredictionsResponse;
}

/**
 * 无限滚动预测列表 Hook
 * 使用游标分页实现高效加载
 * 支持预取下一页提升体验
 */
export function useInfinitePredictions(params: UseInfinitePredictionsParams = {}) {
  const { category, search, pageSize = DEFAULT_PAGE_SIZE } = params;
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const queryResult = useInfiniteQuery({
    queryKey: ["predictions", "infinite", { category, search, pageSize }],
    queryFn: async ({ pageParam }): Promise<PredictionsResponse> => {
      return fetchPredictionsPage(params, pageParam);
    },
    getNextPageParam: (lastPage) => {
      return lastPage.cursor?.hasMore ? lastPage.cursor.nextCursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: 30 * 1000, // 30秒内不重新请求
    gcTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 预取下一页
  const prefetchNextPage = useCallback(async () => {
    const lastPage = queryResult.data?.pages[queryResult.data.pages.length - 1];
    const nextCursor = lastPage?.cursor?.nextCursor;
    
    if (!nextCursor || prefetchedRef.current.has(nextCursor)) {
      return;
    }

    prefetchedRef.current.add(nextCursor);

    try {
      // 预取数据并添加到缓存
      await queryClient.prefetchInfiniteQuery({
        queryKey: ["predictions", "infinite", { category, search, pageSize }],
        queryFn: async ({ pageParam }) => fetchPredictionsPage(params, pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: PredictionsResponse) => {
          return lastPage.cursor?.hasMore ? lastPage.cursor.nextCursor : undefined;
        },
        pages: 1,
      });
    } catch {
      // 预取失败静默处理
      prefetchedRef.current.delete(nextCursor);
    }
  }, [queryClient, queryResult.data, category, search, pageSize, params]);

  // 当滚动接近底部时自动预取
  useEffect(() => {
    if (queryResult.hasNextPage && !queryResult.isFetchingNextPage) {
      // 延迟 100ms 预取，避免阻塞当前渲染
      const timer = setTimeout(prefetchNextPage, 100);
      return () => clearTimeout(timer);
    }
  }, [queryResult.hasNextPage, queryResult.isFetchingNextPage, prefetchNextPage]);

  // 重置预取缓存当查询参数变化时
  useEffect(() => {
    prefetchedRef.current.clear();
  }, [category, search]);

  return queryResult;
}

/**
 * 将分页数据展平为单一数组
 */
export function flattenInfiniteData(
  data: { pages: PredictionsResponse[] } | undefined
): PredictionItem[] {
  if (!data?.pages) return [];
  return data.pages.flatMap((page) => page.data);
}

/**
 * 获取总数
 */
export function getTotalFromInfiniteData(
  data: { pages: PredictionsResponse[] } | undefined
): number {
  if (!data?.pages?.[0]) return 0;
  return data.pages[0].total;
}

