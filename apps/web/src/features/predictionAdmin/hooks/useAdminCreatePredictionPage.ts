"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useUserProfileOptional } from "@/contexts/UserProfileContext";
import { useCategories } from "@/hooks/useQueries";
import { useTranslations } from "@/lib/i18n";
import { ID_TO_CATEGORY_NAME } from "@/features/trending/trendingModel";
import type { Outcome, PredictionForm } from "../types";
import { DEFAULT_FORM, DEFAULT_OUTCOMES } from "../constants";
import { usePredictionOutcomes } from "./usePredictionOutcomes";
import { usePredictionDraft } from "./usePredictionDraft";

export function useAdminCreatePredictionPage() {
  const router = useRouter();
  const { account, siweLogin } = useWallet();
  const profileCtx = useUserProfileOptional();
  const { data: categoriesData } = useCategories();
  const tTrending = useTranslations("trending");
  const tTrendingAdmin = useTranslations("trending.admin");
  const tCommon = useTranslations("common");
  const [form, setForm] = useState<PredictionForm>(DEFAULT_FORM);
  const [outcomes, setOutcomes] = useState<Outcome[]>(DEFAULT_OUTCOMES);
  const [submitting, setSubmitting] = useState(false);
  const [showDraftMenu, setShowDraftMenu] = useState(false);

  useEffect(() => {
    if (form.type !== "multi") return;
    setOutcomes((previous) => {
      if (previous.length >= 3) return previous;
      const next = [...previous];
      for (let i = next.length; i < 3; i++) {
        next.push({ label: `Option ${i + 1}` });
      }
      return next;
    });
  }, [form.type]);

  const {
    lastSaved,
    msg,
    setMsg,
    manualSaveDraft,
    clearDraft,
    draftConfirmOpen,
    draftConfirmMessage,
    closeDraftConfirm,
    confirmDraft,
  } = usePredictionDraft({
    form,
    setForm,
    outcomes,
    setOutcomes,
    tTrendingAdmin,
  });

  const setField = useCallback(
    (key: keyof PredictionForm, value: PredictionForm[keyof PredictionForm]) =>
      setForm((previous) => ({ ...previous, [key]: value })),
    []
  );

  const setType = useCallback((type: PredictionForm["type"]) => {
    setForm((previous) => ({ ...previous, type }));
  }, []);

  const { onAddOutcome, onDelOutcome, onOutcomeChange } = usePredictionOutcomes(setOutcomes);

  const submit = useCallback(async () => {
    try {
      setSubmitting(true);
      setMsg(null);

      if (!account) {
        setMsg(tCommon("connectWallet"));
        return;
      }

      try {
        await siweLogin();
      } catch {}

      const categoryId = String(form.category || "");
      const categoryName = ID_TO_CATEGORY_NAME[categoryId] || categoryId;

      const payload: any = {
        title: form.title,
        description: form.description,
        category: categoryName,
        deadline: form.deadline,
        minStake: Number(form.minStake),
        criteria: form.criteria,
        type: form.type,
        walletAddress: String(account).toLowerCase(),
      };

      const referenceUrl = String(form.referenceUrl || "").trim();
      if (referenceUrl) {
        payload.reference_url = referenceUrl;
      }

      if (form.type === "multi") {
        payload.outcomes = outcomes.map((outcome) => ({ ...outcome }));
      }

      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        setMsg(String(data?.message || tTrendingAdmin("createFailed")));
        return;
      }

      setMsg(tTrendingAdmin("createSuccess"));
      const id = Number(data?.data?.id);
      if (Number.isFinite(id)) {
        router.push(`/prediction/${id}`);
      }
    } catch (error: any) {
      setMsg(String(error?.message || error || tTrendingAdmin("createFailed")));
    } finally {
      setSubmitting(false);
    }
  }, [account, form, outcomes, router, siweLogin, tCommon, tTrendingAdmin, setMsg]);

  useEffect(() => {
    if (!account) return;
    if (!profileCtx?.isAdmin) {
      router.replace("/trending");
    }
  }, [account, profileCtx?.isAdmin, router]);

  return {
    router,
    categoriesData,
    tTrending,
    tTrendingAdmin,
    form,
    outcomes,
    submitting,
    showDraftMenu,
    setShowDraftMenu,
    lastSaved,
    msg,
    manualSaveDraft,
    clearDraft,
    draftConfirmOpen,
    draftConfirmMessage,
    closeDraftConfirm,
    confirmDraft,
    setField,
    setType,
    onAddOutcome,
    onDelOutcome,
    onOutcomeChange,
    submit,
  };
}
