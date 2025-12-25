import type { BetRow, PredictionMeta, PredictionStats } from "./types";

export async function fetchUserBets(admin: any, address: string) {
  const { data: bets, error: betsError } = await admin
    .from("bets")
    .select("id, prediction_id, amount, outcome, created_at")
    .eq("user_id", address)
    .order("created_at", { ascending: false });

  return { bets: (bets || []) as any[], betsError };
}

export async function fetchPredictionsMeta(admin: any, predictionIds: number[]) {
  const predictionsMap: Record<number, PredictionMeta> = {};
  if (predictionIds.length === 0) return { predictionsMap, predictionError: null as any };

  const { data: predictionRows, error: predictionError } = await admin
    .from("predictions")
    .select("id, title, image_url, status, min_stake, winning_outcome")
    .in("id", predictionIds);

  if (!predictionError && Array.isArray(predictionRows)) {
    for (const row of predictionRows as any[]) {
      const id = Number((row as any).id);
      if (!Number.isFinite(id)) continue;
      predictionsMap[id] = {
        title: String((row as any).title || "Unknown Event"),
        image_url: (row as any).image_url || null,
        status: String((row as any).status || "active"),
        min_stake: Number((row as any).min_stake || 0),
        winning_outcome:
          typeof (row as any).winning_outcome === "string" ? (row as any).winning_outcome : null,
      };
    }
  }

  return { predictionsMap, predictionError };
}

export async function fetchPredictionsStats(admin: any, predictionIds: number[]) {
  const statsMap: Record<number, PredictionStats> = {};
  if (predictionIds.length === 0) return { statsMap, statsError: null as any };

  const { data: statsRows, error: statsError } = await admin
    .from("prediction_stats")
    .select("prediction_id, yes_amount, no_amount, total_amount, participant_count, bet_count")
    .in("prediction_id", predictionIds);

  if (!statsError && Array.isArray(statsRows)) {
    for (const row of statsRows as any[]) {
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
  }

  return { statsMap, statsError };
}
