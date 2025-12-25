"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ChatMessageView } from "../types";

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
            const m = {
              id: String(r.id),
              user_id: String(r.user_id),
              content: String(r.content),
              created_at: String(r.created_at),
            };
            setMessages((prev) => {
              const merged = [...prev];
              if (!merged.find((x) => x.id === m.id)) merged.push(m);
              merged.sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return merged;
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
