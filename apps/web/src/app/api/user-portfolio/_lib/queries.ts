import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { BetRow, PredictionMeta, PredictionStats } from "./types";

type DbClient = SupabaseClient<Database>;

export async function fetchUserBets(admin: DbClient, address: string) {
  const { data: bets, error: betsError } = await admin
    .from("bets")
    .select("id, prediction_id, amount, outcome, created_at")
    .eq("user_id", address)
    .order("created_at", { ascending: false });

  return { bets: (bets || []) as BetRow[], betsError };
}

type PredictionRow = {
  id: number | string | null;
  title: string | null;
  image_url: string | null;
  status: string | null;
  deadline: string | null;
  min_stake: number | string | null;
  winning_outcome: string | null;
};

export async function fetchPredictionsMeta(admin: DbClient, predictionIds: number[]) {
  const predictionsMap: Record<number, PredictionMeta> = {};
  if (predictionIds.length === 0) return { predictionsMap, predictionError: null };

  const { data: predictionRows, error: predictionError } = await admin
    .from("predictions")
    .select("id, title, image_url, status, deadline, min_stake, winning_outcome")
    .in("id", predictionIds);

  if (!predictionError && Array.isArray(predictionRows)) {
    for (const row of (predictionRows || []) as PredictionRow[]) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      predictionsMap[id] = {
        title: String(row.title || "Unknown Event"),
        image_url: row.image_url || null,
        status: String(row.status || "active"),
        deadline: row.deadline || null,
        min_stake: Number(row.min_stake || 0),
        winning_outcome: typeof row.winning_outcome === "string" ? row.winning_outcome : null,
      };
    }
  }

  return { predictionsMap, predictionError };
}

type PredictionStatsRow = {
  prediction_id: number | string | null;
  yes_amount: number | string | null;
  no_amount: number | string | null;
  total_amount: number | string | null;
  participant_count: number | string | null;
  bet_count: number | string | null;
};

export async function fetchPredictionsStats(admin: DbClient, predictionIds: number[]) {
  const statsMap: Record<number, PredictionStats> = {};
  if (predictionIds.length === 0) return { statsMap, statsError: null };

  const { data: statsRows, error: statsError } = await admin
    .from("prediction_stats")
    .select("prediction_id, yes_amount, no_amount, total_amount, participant_count, bet_count")
    .in("prediction_id", predictionIds);

  if (!statsError && Array.isArray(statsRows)) {
    for (const row of (statsRows || []) as PredictionStatsRow[]) {
      const pid = Number(row.prediction_id);
      if (!Number.isFinite(pid)) continue;
      statsMap[pid] = {
        yesAmount: Number(row.yes_amount || 0),
        noAmount: Number(row.no_amount || 0),
        totalAmount: Number(row.total_amount || 0),
        participantCount: Number(row.participant_count || 0),
        betCount: Number(row.bet_count || 0),
      };
    }
  }

  return { statsMap, statsError };
}
