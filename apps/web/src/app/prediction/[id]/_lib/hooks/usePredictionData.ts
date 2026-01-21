"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import type { PredictionDetail } from "../types";
import { safeJson } from "../http";

export function usePredictionData(predictionIdRaw: string | number | undefined) {
  const tCommon = useTranslations("common");
  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!predictionIdRaw) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/predictions/${predictionIdRaw}?includeStats=1&includeOutcomes=1`
        );
        const data = await safeJson(res);
        if (cancelled) return;
        if (data.success) {
          setPrediction(data.data);
          setError(null);
        } else {
          setError(data.message || tCommon("loadFailed"));
        }
      } catch (e) {
        if (!cancelled) setError(tCommon("loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [predictionIdRaw]);

  return { prediction, setPrediction, loading, error, setError };
}
