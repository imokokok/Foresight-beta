"use client";

import { useEffect, useState } from "react";
import type { ChatMessageView } from "../types";

export function useForumThreads(eventId: number) {
  const [forumThreads, setForumThreads] = useState<any[]>([]);
  const [forumMessages, setForumMessages] = useState<ChatMessageView[]>([]);

  useEffect(() => {
    const loadForum = async () => {
      try {
        const res = await fetch(`/api/forum?eventId=${eventId}`);
        const data = await res.json();
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
      } catch {}
    };
    loadForum();
  }, [eventId]);

  return { forumThreads, forumMessages };
}
