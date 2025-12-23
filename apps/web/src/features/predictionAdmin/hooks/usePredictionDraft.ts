"use client";

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "@/lib/toast";
import { CATEGORY_MAPPING } from "@/features/trending/trendingModel";
import type { Outcome, PredictionForm } from "../types";
import { DRAFT_KEY, DEFAULT_FORM, DEFAULT_OUTCOMES } from "../constants";

type UsePredictionDraftParams = {
  form: PredictionForm;
  setForm: Dispatch<SetStateAction<PredictionForm>>;
  outcomes: Outcome[];
  setOutcomes: Dispatch<SetStateAction<Outcome[]>>;
  tTrendingAdmin: (key: string) => string;
};

export function usePredictionDraft({
  form,
  setForm,
  outcomes,
  setOutcomes,
  tTrendingAdmin,
}: UsePredictionDraftParams) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const manualSaveDraft = () => {
    const payload = { form, outcomes, ts: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setLastSaved(new Date());
    setMsg(tTrendingAdmin("draft.savedMsg"));
    toast.success(tTrendingAdmin("draft.savedToastTitle"), tTrendingAdmin("draft.savedToastDesc"));
  };

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      setTimeout(() => {
        if (!window.confirm(tTrendingAdmin("draft.restoreConfirm"))) return;

        if (data.form) {
          setForm((previous) => {
            const next = { ...previous, ...data.form };
            const rawCategory = String(next.category || "");
            if (rawCategory) {
              next.category = CATEGORY_MAPPING[rawCategory] || rawCategory;
            }
            return next;
          });
        }

        if (data.outcomes) {
          setOutcomes(data.outcomes);
        }

        if (data.ts) {
          setLastSaved(new Date(data.ts));
        }

        toast.success(
          tTrendingAdmin("draft.restoredToastTitle"),
          tTrendingAdmin("draft.restoredToastDesc")
        );
      }, 100);
    } catch (error) {
      console.error("Failed to load draft", error);
    }
  }, [setForm, setOutcomes, tTrendingAdmin]);

  useEffect(() => {
    if (!form.title && !form.description && outcomes.length === 2 && outcomes[0].label === "Yes") {
      return;
    }

    const timer = setTimeout(() => {
      const payload = { form, outcomes, ts: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setLastSaved(new Date());
    }, 1000);

    return () => clearTimeout(timer);
  }, [form, outcomes]);

  const clearDraft = () => {
    if (!window.confirm(tTrendingAdmin("draft.clearConfirm"))) return;
    localStorage.removeItem(DRAFT_KEY);
    setForm(DEFAULT_FORM);
    setOutcomes(DEFAULT_OUTCOMES);
    setLastSaved(null);
    setMsg(tTrendingAdmin("draft.clearedMsg"));
  };

  return {
    lastSaved,
    msg,
    setMsg,
    manualSaveDraft,
    clearDraft,
  };
}
