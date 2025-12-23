"use client";

import { useEffect, useState, useCallback } from "react";
import type { MouseEvent } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toggleFollowPrediction } from "@/lib/follows";
import { supabase } from "@/lib/supabase";
import {
  createSmartClickEffect,
  createHeartParticles,
} from "@/features/trending/trendingAnimations";
import type { TrendingEvent } from "@/features/trending/trendingModel";

export function useTrendingFollowState(
  accountNorm: string | undefined,
  requireLogin: () => void,
  tErrors: (key: string) => string,
  queryClient: QueryClient,
  visibleEvents: TrendingEvent[]
) {
  const [followedEvents, setFollowedEvents] = useState<Set<number>>(new Set());
  const [followError, setFollowError] = useState<string | null>(null);

  const toggleFollow = useCallback(
    async (predictionId: number, event: MouseEvent) => {
      if (!accountNorm) {
        requireLogin();
        return;
      }

      if (!Number.isFinite(Number(predictionId))) return;

      const normalizedId = Number(predictionId);
      const wasFollowing = followedEvents.has(normalizedId);

      createSmartClickEffect(event);
      createHeartParticles(event.currentTarget as HTMLElement, wasFollowing);

      setFollowedEvents((prev) => {
        const next = new Set(prev);
        if (next.has(normalizedId)) {
          next.delete(normalizedId);
        } else {
          next.add(normalizedId);
        }
        return next;
      });

      try {
        await toggleFollowPrediction(wasFollowing, normalizedId, accountNorm);
      } catch (err) {
        const message =
          err instanceof Error && err.message ? err.message : tErrors("followActionFailed");
        setFollowError(message);
        setTimeout(() => setFollowError(null), 3000);
        setFollowedEvents((prev) => {
          const rollback = new Set(prev);
          if (wasFollowing) {
            rollback.add(normalizedId);
          } else {
            rollback.delete(normalizedId);
          }
          return rollback;
        });
      }
    },
    [accountNorm, followedEvents, requireLogin, tErrors]
  );

  useEffect(() => {
    if (!accountNorm) return;
    (async () => {
      try {
        const res = await fetch(`/api/user-follows?address=${accountNorm}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          follows?: Array<{ id: number | string }>;
          total?: number;
        };
        const ids = new Set<number>(
          (data.follows || [])
            .map((item) => Number(item.id))
            .filter((id): id is number => Number.isFinite(id))
        );
        setFollowedEvents(ids);
      } catch {}
    })();
  }, [accountNorm]);

  useEffect(() => {
    let windowIds: number[] = [];
    windowIds = visibleEvents.map((e) => Number(e?.id)).filter(Number.isFinite) as number[];
    const ids = Array.from(new Set(windowIds));
    if (ids.length === 0) return;
    if (!supabase) {
      return;
    }

    const filterIn = `event_id=in.(${ids.join(",")})`;
    const channel = supabase.channel("event_follows_trending");
    let isSubscribed = true;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_follows",
          filter: filterIn,
        },
        (payload: { new?: { event_id?: number | string; user_id?: string | null } }) => {
          if (!isSubscribed) return;
          const row = payload.new;
          if (!row) return;
          const eid = Number(row.event_id);
          const uid = String(row.user_id || "");
          if (!Number.isFinite(eid)) return;
          if (!accountNorm || (uid || "").toLowerCase() !== accountNorm) {
            queryClient.setQueryData(
              ["predictions"],
              (
                old:
                  | Array<{
                      id: number;
                      followers_count?: number;
                      [key: string]: unknown;
                    }>
                  | undefined
              ) =>
                old?.map((p) =>
                  p.id === eid
                    ? {
                        ...p,
                        followers_count: Number(p.followers_count || 0) + 1,
                      }
                    : p
                )
            );
          }
          if (accountNorm && (uid || "").toLowerCase() === accountNorm) {
            setFollowedEvents((prev) => {
              const s = new Set(prev);
              s.add(eid);
              return s;
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "event_follows",
          filter: filterIn,
        },
        (payload: { old?: { event_id?: number | string; user_id?: string | null } }) => {
          if (!isSubscribed) return;
          const row = payload.old;
          if (!row) return;
          const eid = Number(row.event_id);
          const uid = String(row.user_id || "");
          if (!Number.isFinite(eid)) return;
          if (!accountNorm || (uid || "").toLowerCase() !== accountNorm) {
            queryClient.setQueryData(
              ["predictions"],
              (
                old:
                  | Array<{
                      id: number;
                      followers_count?: number;
                      [key: string]: unknown;
                    }>
                  | undefined
              ) =>
                old?.map((p) =>
                  p.id === eid
                    ? {
                        ...p,
                        followers_count: Math.max(0, Number(p.followers_count || 0) - 1),
                      }
                    : p
                )
            );
          }
          if (accountNorm && (uid || "").toLowerCase() === accountNorm) {
            setFollowedEvents((prev) => {
              const s = new Set(prev);
              s.delete(eid);
              return s;
            });
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;

      if (channel) {
        try {
          channel.unsubscribe();
          if (supabase) {
            supabase.removeChannel(channel);
          }
        } catch {}
      }
    };
  }, [visibleEvents, accountNorm, queryClient]);

  return { followedEvents, followError, toggleFollow };
}
