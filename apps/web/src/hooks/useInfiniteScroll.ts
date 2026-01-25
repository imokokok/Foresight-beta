import { useEffect, useRef, useState, useCallback } from "react";

/**
 * 简化版无限滚动选项（Phase 2 版本）
 */
interface UseInfiniteScrollOptions {
  loading: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  threshold?: number;
  disabled?: boolean;
}

/**
 * 简化版无限滚动 Hook（Phase 2 版本）
 *
 * 用于已有数据加载逻辑的场景，仅提供 IntersectionObserver 触发器
 */
export function useInfiniteScroll({
  loading,
  hasNextPage,
  onLoadMore,
  threshold = 0.1,
  disabled = false,
}: UseInfiniteScrollOptions) {
  const observerTargetRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !loading && !disabled) {
        onLoadMore();
      }
    },
    [hasNextPage, loading, onLoadMore, disabled]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: "0px",
      threshold,
    });

    const currentTarget = observerTargetRef.current;

    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [threshold, handleIntersection]);

  return observerTargetRef;
}

/**
 * 完整版无限滚动选项（Phase 3 版本）
 */
export interface UseInfiniteScrollFullOptions {
  /**
   * IntersectionObserver 触发阈值
   * @default 0.8
   */
  threshold?: number;
  /**
   * 根边距（提前加载的距离）
   * @default "200px"
   */
  rootMargin?: string;
  /**
   * 是否启用（可用于暂停加载）
   * @default true
   */
  enabled?: boolean;
}

export interface UseInfiniteScrollFullResult<T> {
  /**
   * 当前加载的所有数据
   */
  data: T[];
  /**
   * 是否正在加载
   */
  loading: boolean;
  /**
   * 是否还有更多数据
   */
  hasMore: boolean;
  /**
   * 当前页码
   */
  page: number;
  /**
   * 加载错误
   */
  error: Error | null;
  /**
   * 加载更多的触发元素 ref
   */
  loadMoreRef: React.RefObject<HTMLDivElement>;
  /**
   * 手动加载更多
   */
  loadMore: () => Promise<void>;
  /**
   * 重置数据
   */
  reset: () => void;
  /**
   * 设置数据（用于刷新）
   */
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * 完整版无限滚动 Hook（Phase 3 版本）
 *
 * 使用 IntersectionObserver 实现高性能无限滚动，包含完整的数据管理
 *
 * @example
 * ```tsx
 * const { data, loading, hasMore, loadMoreRef } = useInfiniteScrollFull(
 *   async (page) => {
 *     const res = await fetch(`/api/items?page=${page}&limit=20`);
 *     return res.json();
 *   },
 *   { threshold: 0.5, rootMargin: "100px" }
 * );
 *
 * return (
 *   <div>
 *     {data.map(item => <ItemCard key={item.id} item={item} />)}
 *     <div ref={loadMoreRef}>
 *       {loading && <Spinner />}
 *       {!hasMore && <div>没有更多了</div>}
 *     </div>
 *   </div>
 * );
 * ```
 */
export function useInfiniteScrollFull<T>(
  fetchFn: (page: number) => Promise<T[]>,
  options: UseInfiniteScrollFullOptions = {}
): UseInfiniteScrollFullResult<T> {
  const { threshold = 0.8, rootMargin = "200px", enabled = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false); // 防止重复加载
  const pageRef = useRef(1); // 使用 ref 跟踪页码，避免 loadMore 依赖变化

  // 加载更多数据
  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMore || !enabled) return;

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const currentPage = pageRef.current;
      const newData = await fetchFn(currentPage);

      if (!newData || newData.length === 0) {
        setHasMore(false);
      } else {
        setData((prev) => [...prev, ...newData]);
        pageRef.current = currentPage + 1;
        setPage(pageRef.current);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load more");
      setError(error);
      console.error("Failed to load more:", error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [hasMore, enabled, fetchFn]);

  // 设置 IntersectionObserver
  useEffect(() => {
    if (!enabled || !hasMore) {
      observerRef.current?.disconnect();
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingRef.current) {
          loadMore();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, hasMore, loadMore, threshold, rootMargin]);

  // 重置数据
  const reset = useCallback(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    isLoadingRef.current = false;
  }, []);

  return {
    data,
    loading,
    hasMore,
    page,
    error,
    loadMoreRef: loadMoreRef as any,
    loadMore,
    reset,
    setData,
  };
}

/**
 * 基于窗口滚动的无限滚动 Hook
 *
 * @deprecated 推荐使用 useInfiniteScrollFull，性能更好
 */
export function useWindowInfiniteScroll<T>(
  fetchFn: (page: number) => Promise<T[]>,
  options: { distance?: number; enabled?: boolean } = {}
): Omit<UseInfiniteScrollFullResult<T>, "loadMoreRef"> {
  const { distance = 300, enabled = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isLoadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMore || !enabled) return;

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const newData = await fetchFn(page);

      if (!newData || newData.length === 0) {
        setHasMore(false);
      } else {
        setData((prev) => [...prev, ...newData]);
        setPage((prev) => prev + 1);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load more");
      setError(error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [page, hasMore, enabled, fetchFn]);

  useEffect(() => {
    if (!enabled || !hasMore) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      if (scrollTop + clientHeight >= scrollHeight - distance && !isLoadingRef.current) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [enabled, hasMore, loadMore, distance]);

  const reset = useCallback(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    isLoadingRef.current = false;
  }, []);

  return {
    data,
    loading,
    hasMore,
    page,
    error,
    loadMore,
    reset,
    setData,
  };
}
