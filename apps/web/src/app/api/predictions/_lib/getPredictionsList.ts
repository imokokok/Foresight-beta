import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase";
import type { PredictionRow, EventFollowRow, PredictionListItem } from "./types";

export type GetPredictionsListArgs = {
  category?: string | null;
  status?: string | null;
  includeOutcomes: boolean;
  range?: { from: number; to: number };
  limit?: number;
  cursor?: string; // 游标分页：上一页最后一条的 created_at
  search?: string; // 搜索关键词
};

/**
 * 优化后的预测列表查询
 * - 并行执行所有数据库查询（而不是串行）
 * - 使用 Map 代替普通对象提升查找性能
 * - 减少数据处理中的冗余计算
 */
export async function getPredictionsList(
  client: SupabaseClient<Database>,
  args: GetPredictionsListArgs
): Promise<{ items: PredictionListItem[]; total: number }> {
  let selectExpr = "*";
  if (args.includeOutcomes) selectExpr = "*, outcomes:prediction_outcomes(*)";

  let query = (client as any)
    .from("predictions")
    .select(selectExpr, { count: "exact" })
    .order("created_at", { ascending: false });

  if (args.category) query = query.eq("category", args.category);
  if (args.status) query = query.eq("status", args.status);
  if (args.search) query = query.ilike("title", `%${args.search}%`);

  // 游标分页：获取 created_at 小于游标的记录
  if (args.cursor) {
    query = query.lt("created_at", args.cursor);
  }

  if (args.range) query = query.range(args.range.from, args.range.to);
  else if (args.limit) query = query.limit(args.limit);

  const { data: predictions, error, count } = await query;
  if (error) throw error;

  const predictionRows = (predictions || []) as PredictionRow[];
  if (predictionRows.length === 0) {
    return { items: [], total: count || 0 };
  }

  const ids = predictionRows.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));

  // 🚀 性能优化：并行执行查询而不是串行
  const [followerCounts, statsMap] = await Promise.all([
    fetchFollowerCounts(client, ids),
    fetchPredictionStats(client, ids),
  ]);

  // 使用预计算的默认值减少条件判断
  const defaultStat = {
    yesAmount: 0,
    noAmount: 0,
    totalAmount: 0,
    participantCount: 0,
    betCount: 0,
  };

  const items: PredictionListItem[] = predictionRows.map((p) => {
    const idNum = Number(p.id);
    const followersCount = followerCounts.get(idNum) ?? 0;
    const stat = statsMap.get(idNum) ?? defaultStat;

    const { yesAmount, noAmount, totalAmount, participantCount, betCount } = stat;

    // 避免重复计算
    const hasAmount = totalAmount > 0;
    const yesProbability = hasAmount ? yesAmount / totalAmount : 0.5;
    const noProbability = hasAmount ? noAmount / totalAmount : 0.5;

    return {
      ...p,
      followers_count: followersCount,
      stats: {
        yesAmount: +yesAmount.toFixed(4),
        noAmount: +noAmount.toFixed(4),
        totalAmount: +totalAmount.toFixed(4),
        participantCount,
        yesProbability: +yesProbability.toFixed(4),
        noProbability: +noProbability.toFixed(4),
        betCount,
      },
    };
  });

  return { items, total: count || 0 };
}

type StatsData = {
  yesAmount: number;
  noAmount: number;
  totalAmount: number;
  participantCount: number;
  betCount: number;
};

/**
 * 🚀 优化：使用 Map 代替普通对象，O(1) 查找性能更稳定
 */
async function fetchFollowerCounts(
  client: SupabaseClient,
  ids: number[]
): Promise<Map<number, number>> {
  const followerCounts = new Map<number, number>();
  if (ids.length === 0) return followerCounts;

  const { data: rows, error } = await (client as any)
    .from("event_follows")
    .select("event_id")
    .in("event_id", ids);

  if (error || !rows) return followerCounts;

  for (const r of rows as EventFollowRow[]) {
    const eid = Number(r.event_id);
    if (Number.isFinite(eid)) {
      followerCounts.set(eid, (followerCounts.get(eid) ?? 0) + 1);
    }
  }
  return followerCounts;
}

/**
 * 🚀 优化：使用 Map + 减少类型转换
 */
async function fetchPredictionStats(
  client: SupabaseClient,
  ids: number[]
): Promise<Map<number, StatsData>> {
  const statsMap = new Map<number, StatsData>();
  if (ids.length === 0) return statsMap;

  const { data: statsRows, error } = await (client as any)
    .from("prediction_stats")
    .select("prediction_id, yes_amount, no_amount, total_amount, participant_count, bet_count")
    .in("prediction_id", ids);

  if (error || !Array.isArray(statsRows)) return statsMap;

  for (const row of statsRows) {
    const pid = Number(row.prediction_id);
    if (!Number.isFinite(pid)) continue;

    statsMap.set(pid, {
      yesAmount: Number(row.yes_amount) || 0,
      noAmount: Number(row.no_amount) || 0,
      totalAmount: Number(row.total_amount) || 0,
      participantCount: Number(row.participant_count) || 0,
      betCount: Number(row.bet_count) || 0,
    });
  }
  return statsMap;
}
