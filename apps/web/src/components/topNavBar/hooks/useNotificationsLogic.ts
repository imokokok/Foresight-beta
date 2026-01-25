"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslations } from "@/lib/i18n";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  url?: string;
  unread?: boolean;
  read_at?: string | null;
  payload?: unknown;
};

export type NotificationFilter = "all" | "system" | "review" | "challenge";

export function useNotificationsLogic(viewerId: string | null) {
  const tNotifications = useTranslations("notifications");

  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);
  const [notificationsCursor, setNotificationsCursor] = useState<string | null>(null);
  const [notificationsHasMore, setNotificationsHasMore] = useState(false);
  const [markAllNotificationsLoading, setMarkAllNotificationsLoading] = useState(false);
  const [archiveNotificationIdLoading, setArchiveNotificationIdLoading] = useState<string | null>(
    null
  );
  const [archiveAllNotificationsLoading, setArchiveAllNotificationsLoading] = useState(false);
  const [notificationsFilter, setNotificationsFilter] = useState<NotificationFilter>("all");
  const pollingInFlightRef = useRef(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fs_notifications_filter");
      if (saved === "all" || saved === "system" || saved === "review" || saved === "challenge") {
        setNotificationsFilter(saved);
      }
    } catch (error) {
      console.error("[useNotificationsLogic] Failed to load notifications filter:", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("fs_notifications_filter", notificationsFilter);
    } catch (error) {
      console.error("[useNotificationsLogic] Failed to save notifications filter:", error);
    }
  }, [notificationsFilter]);

  useEffect(() => {
    const update = () => {
      setPageVisible(!document.hidden);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const safeUrl = useCallback((candidate: unknown) => {
    if (typeof candidate !== "string") return "/flags";
    const trimmed = candidate.trim();
    if (!trimmed.startsWith("/")) return "/flags";
    return trimmed;
  }, []);

  const titleFallbackForType = useCallback(
    (type: string) => {
      return type === "witness_invite"
        ? tNotifications("fallbackWitnessInviteTitle")
        : type === "checkin_review"
          ? tNotifications("fallbackCheckinReviewTitle")
          : tNotifications("fallbackGenericTitle");
    },
    [tNotifications]
  );

  const markNotificationsRead = useCallback(async (ids: string[]) => {
    const numericIds = ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (!numericIds.length) return;
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: numericIds }),
      });
    } catch (error) {
      console.error("[useNotificationsLogic] Failed to mark notifications as read:", error);
    }
  }, []);

  const fetchNotifications = useCallback(
    async (options?: { append?: boolean; resetCursor?: boolean }) => {
      if (!viewerId) {
        setNotifications([]);
        setNotificationsCursor(null);
        setNotificationsHasMore(false);
        setNotificationsError(false);
        return;
      }
      const append = options?.append === true;
      const resetCursor = options?.resetCursor === true;
      const cursor = append && !resetCursor && notificationsCursor ? notificationsCursor : null;
      setNotificationsLoading(true);
      if (!append) setNotificationsError(false);
      try {
        const url = cursor
          ? `/api/notifications?limit=20&cursor=${cursor}`
          : "/api/notifications?limit=20";
        const listRes = await fetch(url, { cache: "no-store" });
        const listJson = listRes.ok ? await listRes.json().catch(() => ({})) : {};
        const rawItems = Array.isArray(listJson?.notifications) ? listJson.notifications : [];
        const mapped = rawItems
          .map((n: any) => {
            const type = String(n?.type || "");
            const id = String(n?.id || "");
            const created_at = String(n?.created_at || "");
            const read_at = n?.read_at ? String(n.read_at) : null;
            const payload = n?.payload;
            const base = {
              id,
              type,
              created_at,
              url: safeUrl(n?.url),
              read_at,
              unread: !read_at,
              title: String(n?.title || ""),
              message: String(n?.message || ""),
              payload,
            };
            if (type === "pending_review") {
              const count = Number(base.message || 0);
              return {
                ...base,
                title: tNotifications("pendingReviewTitle"),
                message: tNotifications("pendingReviewMessage").replace("{count}", String(count)),
                url: "/flags",
                read_at: null,
                unread: true,
              };
            }
            if (type === "flag_checkin_reminder") {
              const count = Number(base.message || 0);
              const sampleTitles = Array.isArray((payload as any)?.sampleTitles)
                ? ((payload as any).sampleTitles as string[])
                : [];
              const normalizedTitles = sampleTitles
                .map((x) => (typeof x === "string" ? x.trim() : ""))
                .filter((x) => x);
              const truncateTitle = (value: string) =>
                value.length > 30 ? `${value.slice(0, 30)}…` : value;
              const visibleTitles = normalizedTitles.slice(0, 3).map(truncateTitle);
              const baseMessage = tNotifications("flagCheckinReminderMessage").replace(
                "{count}",
                String(count)
              );
              const samplePart =
                visibleTitles.length > 0
                  ? `: ${visibleTitles.join(", ")}${count > visibleTitles.length ? "…" : ""}`
                  : "";
              return {
                ...base,
                title: tNotifications("flagCheckinReminderTitle"),
                message: `${baseMessage}${samplePart}`,
                url: "/flags",
                read_at: null,
                unread: true,
              };
            }
            const title = base.title.trim() ? base.title : titleFallbackForType(type);
            return { ...base, title };
          })
          .filter((x: any) => x.id && x.type);
        if (append) {
          setNotifications((prev) => [...prev, ...mapped]);
        } else {
          setNotifications(mapped);
        }
        const nextCursor =
          typeof listJson?.nextCursor === "string" && listJson.nextCursor
            ? String(listJson.nextCursor)
            : null;
        setNotificationsCursor(nextCursor);
        setNotificationsHasMore(Boolean(nextCursor));
      } catch {
        setNotificationsError(true);
      } finally {
        setNotificationsLoading(false);
      }
    },
    [viewerId, notificationsCursor, safeUrl, tNotifications, titleFallbackForType]
  );

  useEffect(() => {
    if (!pageVisible) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (delayMs: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void tick();
      }, delayMs);
    };
    const load = async (): Promise<number | null> => {
      if (!viewerId) {
        if (!cancelled) {
          setNotificationsCount(0);
        }
        return 0;
      }
      try {
        const countRes = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        const countJson = countRes.ok ? await countRes.json().catch(() => ({})) : {};
        const count = Number(countJson?.count || 0);
        if (!cancelled) {
          setNotificationsCount(Number.isFinite(count) ? count : 0);
        }
        return Number.isFinite(count) ? count : 0;
      } catch {
        if (!cancelled) {
          setNotificationsCount(0);
        }
        return 0;
      }
    };
    const tick = async () => {
      if (cancelled) return;
      if (!pageVisible) return;
      if (!viewerId) {
        const c = await load();
        if (!cancelled) {
          const delay = c !== null && Number.isFinite(c) && c > 0 ? 60000 : 180000;
          schedule(delay);
        }
        return;
      }
      if (pollingInFlightRef.current) {
        schedule(2500);
        return;
      }
      pollingInFlightRef.current = true;
      let c: number | null = null;
      try {
        c = await load();
      } finally {
        pollingInFlightRef.current = false;
        if (!cancelled) {
          const delay = c !== null && Number.isFinite(c) && c > 0 ? 60000 : 180000;
          schedule(delay);
        }
      }
    };
    schedule(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [viewerId, pageVisible]);

  useEffect(() => {
    if (!notificationsOpen) return;
    if (!viewerId) return;
    if (!pageVisible) return;
    setNotificationsCursor(null);
    setNotificationsHasMore(false);
    void fetchNotifications({ append: false, resetCursor: true });
  }, [notificationsOpen, viewerId, pageVisible, fetchNotifications]);

  const handleNotificationsToggle = useCallback(() => {
    if (!viewerId) return;
    if (notificationsOpen) {
      setNotificationsOpen(false);
      return;
    }
    const unreadIds = notifications
      .filter((n) => n.type !== "pending_review" && n.type !== "flag_checkin_reminder" && n.unread)
      .map((n) => n.id);
    void markNotificationsRead(unreadIds);
    setNotifications((prev) =>
      prev.map((n) =>
        n.type === "pending_review" || n.type === "flag_checkin_reminder"
          ? n
          : n.unread
            ? { ...n, unread: false }
            : n
      )
    );
    setNotificationsOpen(true);
  }, [viewerId, notificationsOpen, notifications, markNotificationsRead]);

  const handleLoadMoreNotifications = useCallback(() => {
    if (!notificationsHasMore) return;
    if (notificationsLoading) return;
    void fetchNotifications({ append: true });
  }, [notificationsHasMore, notificationsLoading, fetchNotifications]);

  const handleReloadNotifications = useCallback(() => {
    if (!viewerId) return;
    void fetchNotifications({ append: false, resetCursor: true });
  }, [viewerId, fetchNotifications]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (!viewerId) return;
    if (markAllNotificationsLoading) return;
    setMarkAllNotificationsLoading(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.type === "pending_review"
            ? n
            : { ...n, unread: false, read_at: n.read_at || new Date().toISOString() }
        )
      );
      try {
        const countRes = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        const countJson = countRes.ok ? await countRes.json().catch(() => ({})) : {};
        const count = Number(countJson?.count || 0);
        setNotificationsCount(Number.isFinite(count) ? count : 0);
      } catch (error) {
        console.error("[useNotificationsLogic] Failed to fetch unread count:", error);
      }
    } finally {
      setMarkAllNotificationsLoading(false);
    }
  }, [viewerId, markAllNotificationsLoading]);

  const archiveIds = useCallback((ids: string[]) => {
    const numericIds = ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (!numericIds.length) return null;
    return numericIds;
  }, []);

  const handleArchiveNotification = useCallback(
    async (id: string, unread: boolean | undefined) => {
      if (!viewerId) return;
      if (archiveNotificationIdLoading) return;
      const numericIds = archiveIds([id]);
      if (!numericIds || !numericIds.length) return;
      setArchiveNotificationIdLoading(id);
      try {
        await fetch("/api/notifications/archive", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: numericIds }),
        });
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (unread) {
          try {
            const countRes = await fetch("/api/notifications/unread-count", { cache: "no-store" });
            const countJson = countRes.ok ? await countRes.json().catch(() => ({})) : {};
            const count = Number(countJson?.count || 0);
            setNotificationsCount(Number.isFinite(count) ? count : 0);
          } catch (error) {
            console.error(
              "[useNotificationsLogic] Failed to update unread count after archive:",
              error
            );
          }
        }
      } finally {
        setArchiveNotificationIdLoading(null);
      }
    },
    [viewerId, archiveNotificationIdLoading, archiveIds]
  );

  const handleArchiveAllNotifications = useCallback(async () => {
    if (!viewerId) return;
    if (archiveAllNotificationsLoading) return;
    setArchiveAllNotificationsLoading(true);
    try {
      await fetch("/api/notifications/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications([]);
      setNotificationsCursor(null);
      setNotificationsHasMore(false);
      try {
        const countRes = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        const countJson = countRes.ok ? await countRes.json().catch(() => ({})) : {};
        const count = Number(countJson?.count || 0);
        setNotificationsCount(Number.isFinite(count) ? count : 0);
      } catch (error) {
        console.error(
          "[useNotificationsLogic] Failed to update unread count after archive all:",
          error
        );
      }
    } finally {
      setArchiveAllNotificationsLoading(false);
    }
  }, [viewerId, archiveAllNotificationsLoading]);

  return {
    notifications,
    notificationsCount,
    notificationsOpen,
    setNotificationsOpen,
    handleNotificationsToggle,
    notificationsLoading,
    notificationsError,
    notificationsHasMore,
    handleLoadMoreNotifications,
    handleReloadNotifications,
    handleMarkAllNotificationsRead,
    markAllNotificationsLoading,
    handleArchiveNotification,
    archiveNotificationIdLoading,
    handleArchiveAllNotifications,
    archiveAllNotificationsLoading,
    notificationsFilter,
    setNotificationsFilter,
  };
}
