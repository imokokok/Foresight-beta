"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Outcome } from "../types";

export function usePredictionOutcomes(setOutcomes: Dispatch<SetStateAction<Outcome[]>>) {
  const onAddOutcome = useCallback(() => {
    setOutcomes((previous) => [...previous, { label: `选项${previous.length}` }]);
  }, [setOutcomes]);

  const onDelOutcome = useCallback(
    (index: number) => {
      setOutcomes((previous) => previous.filter((_, idx) => idx !== index));
    },
    [setOutcomes]
  );

  const onOutcomeChange = useCallback(
    (index: number, key: keyof Outcome, value: any) => {
      setOutcomes((previous) =>
        previous.map((outcome, idx) => (idx === index ? { ...outcome, [key]: value } : outcome))
      );
    },
    [setOutcomes]
  );

  return {
    onAddOutcome,
    onDelOutcome,
    onOutcomeChange,
  };
}
