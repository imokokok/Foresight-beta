export type PredictionStats = {
  yesAmount: number;
  noAmount: number;
  totalAmount: number;
  participantCount: number;
  yesProbability: number;
  noProbability: number;
  betCount: number;
};

export async function fetchPredictionStats(
  client: any,
  predictionId: number
): Promise<{
  yesAmount: number;
  noAmount: number;
  totalAmount: number;
  participantCount: number;
  betCount: number;
}> {
  let yesAmount = 0;
  let noAmount = 0;
  let totalAmount = 0;
  let participantCount = 0;
  let betCount = 0;

  const { data: statsRow, error: statsError } = await client
    .from("prediction_stats")
    .select("yes_amount, no_amount, total_amount, participant_count, bet_count")
    .eq("prediction_id", predictionId)
    .maybeSingle();

  if (!statsError && statsRow) {
    yesAmount = Number((statsRow as any).yes_amount || 0);
    noAmount = Number((statsRow as any).no_amount || 0);
    totalAmount = Number((statsRow as any).total_amount || 0);
    participantCount = Number((statsRow as any).participant_count || 0);
    betCount = Number((statsRow as any).bet_count || 0);
    return { yesAmount, noAmount, totalAmount, participantCount, betCount };
  }

  const { data: betsStats, error: betsError } = await client
    .from("bets")
    .select("outcome, amount, user_id")
    .eq("prediction_id", predictionId);
  if (!betsError && betsStats) {
    const uniqueParticipants = new Set<string>();
    for (const bet of betsStats as any[]) {
      const amt = Number((bet as any)?.amount || 0);
      if ((bet as any)?.outcome === "yes") yesAmount += amt;
      else if ((bet as any)?.outcome === "no") noAmount += amt;
      totalAmount += amt;
      const uid = String((bet as any)?.user_id || "");
      if (uid) uniqueParticipants.add(uid);
    }
    participantCount = uniqueParticipants.size;
    betCount = (betsStats as any[]).length;
  }

  return { yesAmount, noAmount, totalAmount, participantCount, betCount };
}

export function computeProbabilities(args: {
  yesAmount: number;
  noAmount: number;
  totalAmount: number;
}) {
  const { yesAmount, noAmount, totalAmount } = args;
  let yesProbability = 0;
  let noProbability = 0;
  if (totalAmount > 0) {
    yesProbability = yesAmount / totalAmount;
    noProbability = noAmount / totalAmount;
  } else {
    yesProbability = 0.5;
    noProbability = 0.5;
  }
  return { yesProbability, noProbability };
}

export function toPredictionStatsResponse(raw: {
  yesAmount: number;
  noAmount: number;
  totalAmount: number;
  participantCount: number;
  yesProbability: number;
  noProbability: number;
  betCount: number;
}): PredictionStats {
  return {
    yesAmount: parseFloat(raw.yesAmount.toFixed(4)),
    noAmount: parseFloat(raw.noAmount.toFixed(4)),
    totalAmount: parseFloat(raw.totalAmount.toFixed(4)),
    participantCount: raw.participantCount,
    yesProbability: parseFloat(raw.yesProbability.toFixed(4)),
    noProbability: parseFloat(raw.noProbability.toFixed(4)),
    betCount: raw.betCount,
  };
}
