import { useEffect, useMemo, useState } from "react";
import { useCategories } from "@/hooks/useQueries";
import { Activity, Globe } from "lucide-react";
import {
  normalizeCategory,
  fetchPredictions,
  TRENDING_CATEGORIES,
} from "@/features/trending/trendingModel";
import { CATEGORIES } from "./forumConfig";

export type PredictionItem = {
  id: number;
  title: string;
  description?: string;
  category?: string;
  created_at?: string;
  followers_count?: number;
};

export type ForumCategory = {
  id: string;
  name: string;
  icon: typeof Activity;
};

export function useForumList() {
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: categoriesData } = useCategories();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPredictions();
        const list: PredictionItem[] = data.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          category: p.category,
          created_at: p.created_at,
          followers_count: p.followers_count,
        }));
        if (!cancelled) {
          setPredictions(list);
          setSelectedTopicId((prev) => prev ?? list[0]?.id ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setError("加载预测话题失败，请稍后重试");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          if (seen.has(name)) {
            return null;
          }
          seen.add(name);
          return {
            id: name,
            name,
            icon: Activity,
          };
        })
        .filter(Boolean) as ForumCategory[];

      const order = TRENDING_CATEGORIES.map((cat) => cat.name);

      const sortedDynamic = [...dynamic].sort((a, b) => {
        const na = normalizeCategory(a.name);
        const nb = normalizeCategory(b.name);
        const ia = order.indexOf(na);
        const ib = order.indexOf(nb);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.name.localeCompare(b.name, "zh-CN");
      });

      return [{ id: "all", name: "All Topics", icon: Globe }, ...sortedDynamic];
    }
    return CATEGORIES as ForumCategory[];
  }, [categoriesData]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return predictions.filter((p) => {
      const cat = normalizeCategory(p.category);
      const catOk = activeCategory === "all" || cat === activeCategory;
      const qOk =
        !q ||
        String(p.title || "")
          .toLowerCase()
          .includes(q);
      return catOk && qOk;
    });
  }, [predictions, activeCategory, searchQuery]);

  const currentTopic = useMemo(() => {
    const id = selectedTopicId;
    if (!id && filtered.length) return filtered[0];
    return predictions.find((p) => p.id === id) || filtered[0] || null;
  }, [predictions, filtered, selectedTopicId]);

  const activeCat = normalizeCategory(currentTopic?.category);

  return {
    predictions,
    categories,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    filtered,
    loading,
    error,
    selectedTopicId,
    setSelectedTopicId,
    currentTopic,
    activeCat,
  };
}
