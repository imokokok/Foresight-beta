"use client";

import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import {
  CATEGORY_MAPPING,
  ID_TO_CATEGORY_NAME,
  type TrendingEvent,
  updatePrediction,
  deletePrediction,
} from "@/features/trending/trendingModel";

interface UseTrendingAdminEventsParams {
  accountNorm: string | undefined;
  profileIsAdmin: boolean | undefined;
  siweLogin: () => Promise<unknown>;
  queryClient: QueryClient;
  tTrendingAdmin: (key: string) => string;
  tTrending: (key: string) => string;
}

export type TrendingEditForm = {
  title: string;
  category: string;
  status: string;
  deadline: string;
  minStake: string;
};

export function useTrendingAdminEvents({
  accountNorm,
  profileIsAdmin,
  siweLogin,
  queryClient,
  tTrendingAdmin,
  tTrending,
}: UseTrendingAdminEventsParams) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<TrendingEditForm>({
    title: "",
    category: "",
    status: "active",
    deadline: "",
    minStake: "0",
  });
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!accountNorm) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(!!profileIsAdmin);
  }, [accountNorm, profileIsAdmin]);

  const openEdit = (p: TrendingEvent) => {
    setEditTargetId(Number(p.id));
    const rawCategory = String(p.tag || p.category || "");
    const categoryId = rawCategory ? CATEGORY_MAPPING[rawCategory] || rawCategory : "";
    const minStakeSource = p.minInvestment || p.insured || "0";
    const minStakeNumber = Number(minStakeSource.split(" ")[0] || 0);
    setEditForm({
      title: String(p.title || ""),
      category: categoryId,
      status: String(p.status || "active"),
      deadline: String(p.deadline || ""),
      minStake: String(Number.isNaN(minStakeNumber) ? 0 : minStakeNumber),
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditTargetId(null);
  };

  const setEditField = <K extends keyof TrendingEditForm>(k: K, v: TrendingEditForm[K]) =>
    setEditForm((prev) => ({
      ...prev,
      [k]: v,
    }));

  const submitEdit = async () => {
    try {
      setSavingEdit(true);
      if (!accountNorm) return;
      try {
        await siweLogin();
      } catch {}
      const id = Number(editTargetId);
      const categoryId = String(editForm.category || "");
      const categoryName = ID_TO_CATEGORY_NAME[categoryId] || categoryId;
      const payload = {
        title: editForm.title,
        category: categoryName,
        status: editForm.status,
        deadline: editForm.deadline,
        minStake: Number(editForm.minStake),
        walletAddress: accountNorm,
      };
      await updatePrediction(id, payload);
      queryClient.setQueryData(
        ["predictions"],
        (old: TrendingEvent[] | undefined): TrendingEvent[] | undefined =>
          old?.map((p) =>
            p?.id === id
              ? {
                  ...p,
                  title: payload.title,
                  category: payload.category,
                  status: payload.status,
                  deadline: payload.deadline,
                  minInvestment: `${payload.minStake} USDC`,
                }
              : p
          )
      );
      toast.success(tTrendingAdmin("updateSuccessTitle"), tTrendingAdmin("updateSuccessDesc"));
      setEditOpen(false);
    } catch (e) {
      toast.error(
        tTrendingAdmin("updateFailed"),
        String((e as Error)?.message || e || tTrendingAdmin("retryLater"))
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteEvent = async (id: number) => {
    try {
      if (!confirm(tTrendingAdmin("confirmDelete"))) return;
      setDeleteBusyId(id);
      if (!accountNorm) return;
      try {
        await siweLogin();
      } catch {}
      await deletePrediction(id, accountNorm);
      queryClient.setQueryData(
        ["predictions"],
        (old: TrendingEvent[] | undefined): TrendingEvent[] | undefined =>
          old?.filter((p) => p?.id !== id)
      );
      toast.success(tTrendingAdmin("deleteSuccessTitle"), tTrendingAdmin("deleteSuccessDesc"));
    } catch (e) {
      toast.error(
        tTrendingAdmin("deleteFailed"),
        String((e as Error)?.message || e || tTrendingAdmin("retryLater"))
      );
    } finally {
      setDeleteBusyId(null);
    }
  };

  return {
    isAdmin,
    editOpen,
    editForm,
    savingEdit,
    deleteBusyId,
    openEdit,
    closeEdit,
    setEditField,
    submitEdit,
    deleteEvent,
  };
}
