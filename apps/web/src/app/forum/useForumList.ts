import { useMemo, useState, useCallback, useRef } from "react";
import { useCategories } from "@/hooks/useQueries";
import { Activity, Globe } from "lucide-react";
import {
  CATEGORY_MAPPING,
  ID_TO_CATEGORY_NAME,
  TRENDING_CATEGORIES,
  normalizeCategoryId,
} from "@/features/trending/trendingModel";
import { CATEGORIES } from "./forumConfig";
import {
  useInfinitePredictions,
  flattenInfiniteData,
  getTotalFromInfiniteData,
  type PredictionItem,
} from "./useInfinitePredictions";
import { useRealtimePredictions } from "./useRealtimePredictions";

export type { PredictionItem };

export type ForumCategory = {
  id: string;
  name: string;
  icon: typeof Activity;
};

const PAGE_SIZE = 20;

export function useForumList() {
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: categoriesData } = useCategories();

  // 滚动位置保持
  const scrollPositionRef = useRef<number>(0);

  const categoryFilter =
    activeCategory === "all" ? undefined : ID_TO_CATEGORY_NAME[activeCategory] || activeCategory;

  // 使用无限滚动查询
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error, refetch } =
    useInfinitePredictions({
      category: categoryFilter,
      search: searchQuery.trim() || undefined,
      pageSize: PAGE_SIZE,
    });

  // 展平分页数据
  const predictions = useMemo(() => flattenInfiniteData(data), [data]);
  const total = useMemo(() => getTotalFromInfiniteData(data), [data]);

  // 当分类或搜索变化时，重置选中的话题
  const handleSetActiveCategory = useCallback((category: string | ((prev: string) => string)) => {
    setActiveCategory(category);
    // 切换分类后选中第一个话题
    setSelectedTopicId(null);
  }, []);

  const handleSetSearchQuery = useCallback((query: string | ((prev: string) => string)) => {
    setSearchQuery(query);
    setSelectedTopicId(null);
  }, []);

  // 分类列表
  const categories: ForumCategory[] = useMemo(() => {
    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
      const seen = new Set<string>();
      const dynamic = (categoriesData as any[])
        .map((item) => {
          const rawName = String((item as any).name || "").trim();
          if (!rawName) {
            return null;
          }
          const name = rawName === "其他" ? "更多" : rawName;
          const id = normalizeCategoryId(name);
          if (seen.has(id)) {
            return null;
          }
          seen.add(id);
          return {
            id,
            name,
            icon: Activity,
          };
        })
        .filter(Boolean) as ForumCategory[];

      const order = TRENDING_CATEGORIES.map(
        (cat) => CATEGORY_MAPPING[cat.name] || normalizeCategoryId(cat.name)
      );

      const sortedDynamic = [...dynamic].sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.name.localeCompare(b.name, "zh-CN");
      });

      return [{ id: "all", name: "All Topics", icon: Globe }, ...sortedDynamic];
    }
    return CATEGORIES as ForumCategory[];
  }, [categoriesData]);

  // 服务端已经过滤，这里直接使用
  const filtered = predictions;

  // 使用 Map 优化 O(1) 查找
  const predictionsMap = useMemo(() => {
    return new Map(predictions.map((p) => [p.id, p]));
  }, [predictions]);

  // 当前选中的话题
  const currentTopic = useMemo(() => {
    const id = selectedTopicId;
    if (!id && filtered.length) {
      // 首次加载时自动选中第一个
      return filtered[0];
    }
    return predictionsMap.get(id!) || filtered[0] || null;
  }, [predictionsMap, filtered, selectedTopicId]);

  // 自动选中第一个话题
  useMemo(() => {
    if (!selectedTopicId && filtered.length > 0) {
      setSelectedTopicId(filtered[0].id);
    }
  }, [filtered, selectedTopicId]);

  const activeCat = normalizeCategoryId(currentTopic?.category);

  // 加载更多
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 实时订阅新话题
  const { newCount, resetNewCount, isConnected } = useRealtimePredictions({
    enabled: true,
  });

  // 刷新并重置新话题计数
  const refreshAndReset = useCallback(async () => {
    await refetch();
    resetNewCount();
  }, [refetch, resetNewCount]);

  // 保存滚动位置
  const saveScrollPosition = useCallback((position: number) => {
    scrollPositionRef.current = position;
  }, []);

  // 获取保存的滚动位置
  const getSavedScrollPosition = useCallback(() => {
    return scrollPositionRef.current;
  }, []);

  return {
    predictions,
    categories,
    activeCategory,
    setActiveCategory: handleSetActiveCategory,
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
    filtered,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    error: error ? (error as Error).message : null,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
    // 无限滚动相关
    hasNextPage: hasNextPage ?? false,
    loadMore,
    total,
    refetch,
    // 实时更新相关
    newCount,
    resetNewCount,
    refreshAndReset,
    isConnected,
    // 滚动位置
    saveScrollPosition,
    getSavedScrollPosition,
  };
}
