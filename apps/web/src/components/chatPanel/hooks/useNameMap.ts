"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { fetchUsernamesByAddresses } from "@/lib/userProfiles";
import type { ChatMessageView } from "../types";

export function useNameMap(args: {
  messages: ChatMessageView[];
  forumMessages: ChatMessageView[];
  address: string | null | undefined;
}) {
  const { messages, forumMessages, address } = args;
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  // 使用 ref 追踪已请求过的地址，避免重复请求
  const fetchedAddrsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;

    const run = async () => {
      if (!mountedRef.current || pendingRef.current) return;

      const addrs = new Set<string>();
      messages.forEach((m) => {
        if (m.user_id) addrs.add(String(m.user_id).toLowerCase());
      });
      forumMessages.forEach((m) => {
        if (m.user_id) addrs.add(String(m.user_id).toLowerCase());
      });
      if (address) addrs.add(String(address).toLowerCase());

      const unknown = Array.from(addrs).filter((a) => !fetchedAddrsRef.current.has(a));
      if (unknown.length === 0 || !mountedRef.current) return;

      unknown.forEach((a) => fetchedAddrsRef.current.add(a.toLowerCase()));
      pendingRef.current = true;

      try {
        const next = await fetchUsernamesByAddresses(unknown);
        if (mountedRef.current && Object.keys(next).length > 0) {
          setNameMap((prev) => ({ ...prev, ...next }));
        }
      } finally {
        pendingRef.current = false;
      }
    };

    run();

    return () => {
      mountedRef.current = false;
    };
  }, [messages, forumMessages, address]);

  // 提供手动刷新方法
  const refreshNames = useCallback(async (addresses: string[]) => {
    const next = await fetchUsernamesByAddresses(addresses);
    if (Object.keys(next).length > 0) {
      setNameMap((prev) => ({ ...prev, ...next }));
      addresses.forEach((a) => fetchedAddrsRef.current.add(a.toLowerCase()));
    }
  }, []);

  return { nameMap, setNameMap, refreshNames };
}
