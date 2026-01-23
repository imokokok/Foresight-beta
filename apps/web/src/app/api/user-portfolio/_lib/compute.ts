import type { BetRow, PortfolioResponse, PredictionMeta, PredictionStats } from "./types";

type Grouped = Record<
  number,
  { totalStake: number; stakeYes: number; stakeNo: number; stakeOther: number; joinedAt: string }
>;

export function groupBets(bets: BetRow[]): { grouped: Grouped; predictionIds: number[] } {
  const predictionIds = Array.from(
    new Set(
      (bets || []).map((item) => Number(item.prediction_id)).filter((id) => Number.isFinite(id))
    )
  );

  const grouped: Grouped = {};
  for (const bet of bets || []) {
    const pid = Number(bet.prediction_id);
    if (!Number.isFinite(pid)) continue;
    const amount = Number(bet.amount || 0);
    const outcome = String(bet.outcome || "");
    const created = String(bet.created_at || "");

    if (!grouped[pid]) {
      grouped[pid] = { totalStake: 0, stakeYes: 0, stakeNo: 0, stakeOther: 0, joinedAt: created };
    }

    grouped[pid].totalStake += amount;
    const lower = outcome.toLowerCase();
    if (lower === "yes") grouped[pid].stakeYes += amount;
    else if (lower === "no") grouped[pid].stakeNo += amount;
    else grouped[pid].stakeOther += amount;

    if (
      grouped[pid].joinedAt &&
      created &&
      new Date(created).getTime() < new Date(grouped[pid].joinedAt).getTime()
    ) {
      grouped[pid].joinedAt = created;
    }
  }

  return { grouped, predictionIds };
}

export function buildPortfolioResponse(args: {
  grouped: Grouped;
  predictionsMap: Record<number, PredictionMeta>;
  statsMap: Record<number, PredictionStats>;
}): PortfolioResponse {
  const { grouped, predictionsMap, statsMap } = args;

  let totalInvested = 0;
  let totalRealizedPnl = 0;
  let winCount = 0;
  let lossCount = 0;

  const positions: PortfolioResponse["positions"] = Object.entries(grouped).map(
    ([pidStr, value]) => {
      const pid = Number(pidStr);
      const meta = predictionsMap[pid];
      const s = statsMap[pid];

      const yesAmount = s?.yesAmount ?? 0;
      const noAmount = s?.noAmount ?? 0;
      const totalAmount = s?.totalAmount ?? 0;
      const participantCount = s?.participantCount ?? 0;
      const betCount = s?.betCount ?? 0;

      let yesProbability = 0.5;
      let noProbability = 0.5;
      if (totalAmount > 0) {
        yesProbability = yesAmount / totalAmount;
        noProbability = noAmount / totalAmount;
      }

      const imageUrl = meta?.image_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${pid}`;

      const invested = value.totalStake > 0 ? value.totalStake : meta?.min_stake || 0;
      totalInvested += invested;

      const winner = String(meta?.winning_outcome || "").toLowerCase();
      const resolved = winner === "yes" || winner === "no";

      let gross = 0;
      let netPnl = 0;

      if (resolved && totalAmount > 0) {
        if (winner === "yes" && yesAmount > 0) {
          const payoutYes = (value.stakeYes / yesAmount) * totalAmount;
          gross = payoutYes;
        } else if (winner === "no" && noAmount > 0) {
          const payoutNo = (value.stakeNo / noAmount) * totalAmount;
          gross = payoutNo;
        }
        netPnl = gross - value.totalStake;
      }

      totalRealizedPnl += netPnl;

      if (resolved && invested > 0) {
        if (netPnl > 0) winCount += 1;
        else if (netPnl < 0) lossCount += 1;
      }

      const pnlPct = invested > 0 ? (netPnl / invested) * 100 : 0;
      const pnlPctRounded = Number(pnlPct.toFixed(1));
      const pnlLabel =
        pnlPctRounded >= 0 ? `+${pnlPctRounded.toFixed(1)}%` : `${pnlPctRounded.toFixed(1)}%`;

      const mainOutcome =
        value.stakeYes >= value.stakeNo && value.stakeYes > 0
          ? "Yes"
          : value.stakeNo > 0
            ? "No"
            : value.stakeOther > 0
              ? "Other"
              : "Unknown";

      return {
        id: pid,
        title: meta?.title || "Unknown Event",
        image_url: imageUrl,
        status: meta?.status || "active",
        deadline: meta?.deadline || null,
        stake: invested,
        outcome: mainOutcome,
        pnl: resolved ? pnlLabel : "+0%",
        joined_at: value.joinedAt,
        stats: {
          yesAmount,
          noAmount,
          totalAmount,
          participantCount,
          betCount,
          yesProbability: parseFloat(yesProbability.toFixed(4)),
          noProbability: parseFloat(noProbability.toFixed(4)),
        },
      };
    }
  );

  positions.sort((a, b) => {
    const ta = a.joined_at ? new Date(a.joined_at).getTime() : 0;
    const tb = b.joined_at ? new Date(b.joined_at).getTime() : 0;
    return tb - ta;
  });

  const activeCount = positions.filter((p) => String(p.status || "") === "active").length;
  const winRate =
    winCount + lossCount > 0 ? `${((winCount / (winCount + lossCount)) * 100).toFixed(1)}%` : "0%";

  return {
    positions,
    stats: {
      total_invested: totalInvested,
      active_count: activeCount,
      win_rate: winRate,
      realized_pnl: Number(totalRealizedPnl.toFixed(2)),
    },
  };
}
