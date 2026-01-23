"use client";

import { useEffect, useState, useCallback } from "react";

export function useMutedUsers() {
  const [mutedUsers, setMutedUsers] = useState<Record<string, true>>({});

  useEffect(() => {
    const key = "chat:mutedUsers";
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(arr)) return;
      const next: Record<string, true> = {};
      arr.forEach((x) => {
        const a = typeof x === "string" ? x : "";
        const k = a.trim().toLowerCase();
        if (k) next[k] = true;
      });
      setMutedUsers(next);
    } catch {}
  }, []);

  const isMuted = useCallback(
    (addr?: string | null) => {
      const k = String(addr || "")
        .trim()
        .toLowerCase();
      if (!k) return false;
      return !!mutedUsers[k];
    },
    [mutedUsers]
  );

  const setMute = useCallback((addr: string, muted: boolean) => {
    const key = "chat:mutedUsers";
    const k = String(addr || "")
      .trim()
      .toLowerCase();
    if (!k) return;
    setMutedUsers((prev) => {
      const next = { ...prev };
      if (muted) next[k] = true;
      else delete next[k];
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(Object.keys(next)));
        }
      } catch {}
      return next;
    });
  }, []);

  return {
    isMuted,
    setMute,
  };
}
