"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ChatMessageView } from "../types";

// 二分查找插入位置，避免每次排序整个数组
function binaryInsertPosition(arr: ChatMessageView[], target: ChatMessageView): number {
  const targetTime = new Date(target.created_at).getTime();
  let left = 0;
  let right = arr.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = new Date(arr[mid].created_at).getTime();
    if (midTime < targetTime) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

export function useDiscussionMessages(eventId: number) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);

  useEffect(() => {
    let channel: any = null;
    let isSubscribed = true;

    const load = async () => {
      try {
        if (!isSubscribed) return;

        if (supabase) {
          const { data, error } = await supabase
            .from("discussions")
            .select("*")
            .eq("proposal_id", eventId)
            .order("created_at", { ascending: true });
          if (!error && isSubscribed) {
            const list = Array.isArray(data) ? data : [];
            setMessages(
              list.map((r: any) => ({
                id: String(r.id),
                user_id: String(r.user_id),
                content: String(r.content),
                created_at: String(r.created_at),
              }))
            );
            return;
          }
        }

        const res = await fetch(`/api/discussions?proposalId=${eventId}`);
        const data = await res.json();
        if (!isSubscribed) return;

        const list = Array.isArray(data?.discussions) ? data.discussions : [];
        setMessages(
          list.map((r: any) => ({
            id: String(r.id),
            user_id: String(r.user_id),
            content: String(r.content),
            created_at: String(r.created_at),
          }))
        );
      } catch {}
    };

    load();

    if (supabase) {
      channel = supabase
        .channel(`discussions:${eventId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "discussions",
            filter: `proposal_id=eq.${eventId}`,
          },
          (payload) => {
            if (!isSubscribed) return;
            const r: any = payload.new;
            const m: ChatMessageView = {
              id: String(r.id),
              user_id: String(r.user_id),
              content: String(r.content),
              created_at: String(r.created_at),
            };
            setMessages((prev) => {
              // 检查是否已存在
              if (prev.some((x) => x.id === m.id)) return prev;
              // 使用二分插入，O(log n) 而非 O(n log n)
              const insertIdx = binaryInsertPosition(prev, m);
              const next = [...prev];
              next.splice(insertIdx, 0, m);
              return next;
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "discussions",
            filter: `proposal_id=eq.${eventId}`,
          },
          (payload) => {
            if (!isSubscribed) return;
            const r: any = payload.new;
            const m = {
              id: String(r.id),
              user_id: String(r.user_id),
              content: String(r.content),
              created_at: String(r.created_at),
            };
            setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "discussions",
            filter: `proposal_id=eq.${eventId}`,
          },
          (payload) => {
            if (!isSubscribed) return;
            const r: any = payload.old;
            setMessages((prev) => prev.filter((x) => x.id !== String(r.id)));
          }
        )
        .subscribe();
    }

    return () => {
      isSubscribed = false;
      if (channel) {
        try {
          channel.unsubscribe();
          supabase?.removeChannel(channel);
          channel = null;
        } catch (error) {
          console.error("Failed to cleanup WebSocket channel:", error);
        }
      }
    };
  }, [eventId]);

  return { messages, setMessages };
}
