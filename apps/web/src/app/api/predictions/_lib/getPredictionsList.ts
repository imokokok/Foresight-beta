import type { SupabaseClient } from "@supabase/supabase-js";
import type { PredictionRow, EventFollowRow, PredictionListItem } from "./types";

export type GetPredictionsListArgs = {
  category?: string | null;
  status?: string | null;
  includeOutcomes: boolean;
  range?: { from: number; to: number };
  limit?: number;
};

export async function getPredictionsList(
  client: SupabaseClient,
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
  if (args.range) query = query.range(args.range.from, args.range.to);
  else if (args.limit) query = query.limit(args.limit);

  const { data: predictions, error, count } = await query;
  if (error) throw error;

  const predictionRows = (predictions || []) as PredictionRow[];
  const ids = predictionRows.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));

  const followerCounts = await fetchFollowerCounts(client, ids);
  const statsMap = await fetchPredictionStats(client, ids);

  const items: PredictionListItem[] = predictionRows.map((p) => {
    const idNum = Number(p.id);
    const followersCount = followerCounts[idNum] || 0;
    const stat = statsMap[idNum];

    const yesAmount = stat?.yesAmount ?? 0;
    const noAmount = stat?.noAmount ?? 0;
    const totalAmount = stat?.totalAmount ?? 0;
    const participantCount = stat?.participantCount ?? 0;
    const betCount = stat?.betCount ?? 0;

    let yesProbability = 0.5;
    let noProbability = 0.5;
    if (totalAmount > 0) {
      yesProbability = yesAmount / totalAmount;
      noProbability = noAmount / totalAmount;
    }

    return {
      ...p,
      followers_count: followersCount,
      stats: {
        yesAmount: parseFloat(yesAmount.toFixed(4)),
        noAmount: parseFloat(noAmount.toFixed(4)),
        totalAmount: parseFloat(totalAmount.toFixed(4)),
        participantCount,
        yesProbability: parseFloat(yesProbability.toFixed(4)),
        noProbability: parseFloat(noProbability.toFixed(4)),
        betCount,
      },
    };
  });

  return { items, total: count || 0 };
}

async function fetchFollowerCounts(
  client: SupabaseClient,
  ids: number[]
): Promise<Record<number, number>> {
  const followerCounts: Record<number, number> = {};
  if (ids.length === 0) return followerCounts;

  const { data: rows, error } = await (client as any)
    .from("event_follows")
    .select("event_id")
    .in("event_id", ids);

  if (error || !rows) return followerCounts;

  const followRows = rows as EventFollowRow[];
  for (const r of followRows) {
    const eid = Number(r.event_id);
    if (Number.isFinite(eid)) {
      followerCounts[eid] = (followerCounts[eid] || 0) + 1;
    }
  }
  return followerCounts;
}

async function fetchPredictionStats(
  client: SupabaseClient,
  ids: number[]
): Promise<
  Record<
    number,
    {
      yesAmount: number;
      noAmount: number;
      totalAmount: number;
      participantCount: number;
      betCount: number;
    }
  >
> {
  const statsMap: Record<
    number,
    {
      yesAmount: number;
      noAmount: number;
      totalAmount: number;
      participantCount: number;
      betCount: number;
    }
  > = {};
  if (ids.length === 0) return statsMap;

  const { data: statsRows, error } = await (client as any)
    .from("prediction_stats")
    .select("prediction_id, yes_amount, no_amount, total_amount, participant_count, bet_count")
    .in("prediction_id", ids);

  if (error || !Array.isArray(statsRows)) return statsMap;

  for (const row of statsRows) {
    const pid = Number((row as any).prediction_id);
    if (!Number.isFinite(pid)) continue;
    statsMap[pid] = {
      yesAmount: Number((row as any).yes_amount || 0),
      noAmount: Number((row as any).no_amount || 0),
      totalAmount: Number((row as any).total_amount || 0),
      participantCount: Number((row as any).participant_count || 0),
      betCount: Number((row as any).bet_count || 0),
    };
  }
  return statsMap;
}
