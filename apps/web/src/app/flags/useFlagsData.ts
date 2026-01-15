"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "@/lib/toast";
import type { FlagItem } from "@/components/FlagCard";
import type { StickerItem } from "@/components/StickerRevealModal";

type InviteNotice = {
  id: number;
  title: string;
} | null;

export function useFlagsData(account: string | null | undefined, tFlags: (key: string) => string) {
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMine, setFilterMine] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "success" | "witnessRequests"
  >("all");
  const [dbStickers, setDbStickers] = useState<StickerItem[]>([]);
  const [collectedStickers, setCollectedStickers] = useState<string[]>([]);

  const viewerId = String(account || "").toLowerCase();
  const noDataToastShownRef = useRef(false);

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      if (!account) {
        setFlags([]);
        return;
      }

      const res = await fetch(`/api/flags`, {
        cache: "no-store",
      });

      if (!res.ok) {
        toast.error(tFlags("toast.loadFailedTitle"), `HTTP ${res.status}: ${res.statusText}`);
        setFlags([]);
        return;
      }

      const payload = await res.json().catch(() => ({ flags: [] }));
      const list = Array.isArray(payload?.flags) ? payload.flags : [];

      setFlags(list as FlagItem[]);

      if (list.length === 0 && !noDataToastShownRef.current) {
        toast.info(tFlags("toast.noDataTitle"), tFlags("toast.noDataDesc"));
        noDataToastShownRef.current = true;
      }
    } catch (e) {
      console.error(e);
      toast.error(tFlags("toast.loadFailedTitle"), String(e));
    } finally {
      setLoading(false);
    }
  }, [account, tFlags]);

  const loadCollectedStickers = useCallback(async () => {
    try {
      if (!account) return;
      const res = await fetch(`/api/stickers?user_id=${encodeURIComponent(account)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({ stickers: [] }));
      const list = Array.isArray(data?.stickers) ? data.stickers : [];
      setCollectedStickers(list.map((s: any) => s.sticker_id));
    } catch (e) {
      console.error(e);
    }
  }, [account]);

  useEffect(() => {
    fetch("/api/emojis")
      .then((res) => res.json())
      .then((data) => {
        if (data.data && Array.isArray(data.data)) {
          setDbStickers(data.data);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (account) {
      loadFlags();
      loadCollectedStickers();
    } else {
      setFlags([]);
      setCollectedStickers([]);
    }
  }, [account, loadFlags, loadCollectedStickers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawStatus = window.localStorage.getItem("fs_flags_status_filter");
      if (
        rawStatus === "all" ||
        rawStatus === "active" ||
        rawStatus === "success" ||
        rawStatus === "witnessRequests"
      ) {
        setStatusFilter(rawStatus);
      }
      const rawMine = window.localStorage.getItem("fs_flags_filter_mine");
      if (rawMine === "1") setFilterMine(true);
      if (rawMine === "0") setFilterMine(false);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("fs_flags_status_filter", statusFilter);
      window.localStorage.setItem("fs_flags_filter_mine", filterMine ? "1" : "0");
    } catch {}
  }, [statusFilter, filterMine]);

  const activeFlags = useMemo(() => flags.filter((f) => f.status === "active"), [flags]);

  const completedFlags = useMemo(() => flags.filter((f) => f.status === "success"), [flags]);

  const witnessFlags = useMemo(
    () =>
      viewerId
        ? flags.filter(
            (f) =>
              f.verification_type === "witness" &&
              String(f.witness_id || "").toLowerCase() === viewerId &&
              String(f.user_id || "").toLowerCase() !== viewerId
          )
        : [],
    [flags, viewerId]
  );

  const pendingReviewFlagsForViewer = useMemo(
    () =>
      viewerId
        ? flags.filter(
            (f) =>
              f.status === "pending_review" &&
              f.verification_type === "witness" &&
              String(f.witness_id || "").toLowerCase() === viewerId
          )
        : [],
    [flags, viewerId]
  );

  const filteredFlags = useMemo(() => {
    if (statusFilter === "witnessRequests") {
      return pendingReviewFlagsForViewer
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return flags
      .filter((f) => (statusFilter === "all" ? true : f.status === statusFilter))
      .filter((f) => {
        if (!filterMine) return true;
        if (!account) return false;
        return String(f.user_id || "").toLowerCase() === String(account).toLowerCase();
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [flags, statusFilter, filterMine, account, pendingReviewFlagsForViewer]);

  const invitesCount = pendingReviewFlagsForViewer.length;

  const inviteNotice: InviteNotice = useMemo(
    () =>
      invitesCount > 0
        ? {
            id: pendingReviewFlagsForViewer[0].id,
            title: pendingReviewFlagsForViewer[0].title,
          }
        : null,
    [invitesCount, pendingReviewFlagsForViewer]
  );

  return {
    flags,
    loading,
    filterMine,
    setFilterMine,
    statusFilter,
    setStatusFilter,
    collectedStickers,
    dbStickers,
    loadFlags,
    activeFlags,
    completedFlags,
    filteredFlags,
    inviteNotice,
    invitesCount,
    viewerId,
    witnessFlags,
    pendingReviewFlagsForViewer,
  };
}

export type FlagsData = ReturnType<typeof useFlagsData>;
