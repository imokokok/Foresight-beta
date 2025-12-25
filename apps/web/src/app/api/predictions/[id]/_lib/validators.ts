export function parsePredictionId(id: string | undefined) {
  if (!id || isNaN(parseInt(id))) return null;
  const predictionId = parseInt(id);
  return Number.isFinite(predictionId) ? predictionId : null;
}

export function parseIncludeStatsParam(v: string | null) {
  return v !== "0";
}

export function parseIncludeOutcomesParam(v: string | null) {
  return (v || "0") !== "0";
}
