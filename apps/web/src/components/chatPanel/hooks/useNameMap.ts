"use client";

import { useEffect, useState } from "react";
import { fetchUsernamesByAddresses } from "@/lib/userProfiles";
import type { ChatMessageView } from "../types";

export function useNameMap(args: {
  messages: ChatMessageView[];
  forumMessages: ChatMessageView[];
  account: string | null | undefined;
}) {
  const { messages, forumMessages, account } = args;
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const run = async () => {
      const addrs = new Set<string>();
      messages.forEach((m) => {
        if (m.user_id) addrs.add(String(m.user_id));
      });
      forumMessages.forEach((m) => {
        if (m.user_id) addrs.add(String(m.user_id));
      });
      if (account) addrs.add(String(account));
      const unknown = Array.from(addrs).filter((a) => !nameMap[String(a || "").toLowerCase()]);
      if (unknown.length === 0) return;
      const next = await fetchUsernamesByAddresses(unknown);
      if (Object.keys(next).length === 0) return;
      setNameMap((prev) => ({ ...prev, ...next }));
    };
    run();
  }, [messages, forumMessages, account, nameMap]);

  return { nameMap, setNameMap };
}
