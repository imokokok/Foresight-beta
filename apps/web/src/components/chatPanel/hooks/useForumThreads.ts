"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessageView } from "../types";

export function useForumThreads(eventId: number) {
  const [forumThreads, setForumThreads] = useState<any[]>([]);
  const [forumMessages, setForumMessages] = useState<ChatMessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadForum = async () => {
      try {
        if (cancelled) return;
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/forum?eventId=${eventId}`, { signal: controller.signal });
        if (!res.ok) throw new Error("load_failed");
        const data = await res.json();
        if (cancelled) return;
        const threads = Array.isArray(data?.threads) ? data.threads : [];
        setForumThreads(threads);

        const fm: ChatMessageView[] = [];
        threads.forEach((t: any) => {
          fm.push({
            id: `thread:${t.id}`,
            user_id: String(t.user_id || ""),
            content: `${String(t.title || "")}\n${String(t.content || "")}`.trim(),
            created_at: String(t.created_at || ""),
          });
          (Array.isArray(t.comments) ? t.comments : []).forEach((c: any) => {
            fm.push({
              id: `comment:${c.id}`,
              user_id: String(c.user_id || ""),
              content: String(c.content || ""),
              created_at: String(c.created_at || ""),
            });
          });
        });
        fm.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setForumMessages(fm);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("load_failed");
          setLoading(false);
        }
      }
    };
    loadForum();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [eventId, reloadKey]);

  return { forumThreads, forumMessages, loading, error, refresh };
}
