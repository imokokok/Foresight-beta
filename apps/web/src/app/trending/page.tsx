import { Suspense } from "react";
import { getClient } from "@/lib/supabase";
import { CardListSkeleton } from "@/components/skeletons";
import TrendingClient from "./TrendingClient";
import type { Prediction } from "@/features/trending/trendingModel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RawPrediction = {
  id: number | string | null;
  title: string | null;
  description: string | null;
  min_stake: number | null;
  category: string | null;
  image_url: string | null;
  deadline: string | null;
  status: string | null;
  criteria: string | null;
  type: string | null;
};

type EventFollowRow = {
  event_id: number | string | null;
};

async function getPredictions(): Promise<Prediction[]> {
  const client = getClient();
  if (!client) return [];

  const { data: rawPredictions, error } = await client
    .from("predictions")
    .select("id,title,description,min_stake,category,image_url,deadline,status,criteria,type")
    .order("created_at", { ascending: false })
    .limit(100); // 限制最多返回100条，防止数据量过大

  if (error || !rawPredictions) {
    console.error("Server fetch predictions error:", error);
    return [];
  }

  const predictions = rawPredictions as RawPrediction[];

  const ids = predictions.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));
  let counts: Record<number, number> = {};

  if (ids.length > 0) {
    const { data: rawRows, error: rowsError } = await client
      .from("event_follows")
      .select("event_id")
      .in("event_id", ids);

    if (!rowsError && Array.isArray(rawRows)) {
      const rows = rawRows as EventFollowRow[];
      // 在内存中聚合，对于小规模数据（<10k rows）比多次 DB 调用快
      // 如果数据量大，应该使用 rpc 或视图
      for (const r of rows) {
        const eid = Number(r.event_id);
        if (Number.isFinite(eid) && ids.includes(eid)) {
          counts[eid] = (counts[eid] || 0) + 1;
        }
      }
    } else {
      // Fallback: 如果 select * 失败或太慢，可以用 count 查询 (N+1 problem solved by logic above, but this is just safety)
    }
  }

  const predictionsWithFollowersCount = predictions.map((p) => ({
    ...p,
    followers_count: counts[Number(p.id)] || 0,
  })) as Prediction[];

  return predictionsWithFollowersCount;
}

export default async function Page() {
  const predictions = await getPredictions();

  return (
    <Suspense fallback={<CardListSkeleton count={6} />}>
      <TrendingClient initialPredictions={predictions} />
    </Suspense>
  );
}
