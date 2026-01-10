"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { getDisplayName } from "@/lib/userProfiles";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { ChatPanelProps, ChatMessageView } from "./chatPanel/types";
import { useDiscussionMessages } from "./chatPanel/hooks/useDiscussionMessages";
import { useForumThreads } from "./chatPanel/hooks/useForumThreads";
import { useNameMap } from "./chatPanel/hooks/useNameMap";
import { getAccentClass } from "./chatPanel/utils/colors";
import { mergeMessages } from "./chatPanel/utils/mergeMessages";
import { ChatHeader } from "./chatPanel/ui/ChatHeader";
import { MessagesList } from "./chatPanel/ui/MessagesList";
import { ChatInputArea } from "./chatPanel/ui/ChatInputArea";

function buildDebatePrefix(
  stance: NonNullable<ChatMessageView["debate_stance"]>,
  kind: NonNullable<ChatMessageView["debate_kind"]>
) {
  return `[debate:stance=${stance};kind=${kind}]`;
}

function parseDebatePrefs(raw: string | null) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<{
      debateMode: boolean;
      debateStance: ChatMessageView["debate_stance"];
      debateKind: ChatMessageView["debate_kind"];
      debateFilter: "all" | "debate" | "normal";
      partition: "chat" | "debate";
      stanceFilter: "all" | "pro" | "con" | "uncertain";
      kindFilter: "all" | "claim" | "evidence" | "rebuttal" | "question" | "summary";
    }>;
    if (typeof obj !== "object" || obj === null) return null;
    const next: {
      debateMode?: boolean;
      debateStance?: NonNullable<ChatMessageView["debate_stance"]>;
      debateKind?: NonNullable<ChatMessageView["debate_kind"]>;
      partition?: "chat" | "debate";
      stanceFilter?: "all" | "pro" | "con" | "uncertain";
      kindFilter?: "all" | "claim" | "evidence" | "rebuttal" | "question" | "summary";
    } = {};
    if (typeof obj.debateMode === "boolean") next.debateMode = obj.debateMode;
    if (
      obj.debateStance === "pro" ||
      obj.debateStance === "con" ||
      obj.debateStance === "uncertain"
    ) {
      next.debateStance = obj.debateStance;
    }
    if (
      obj.debateKind === "claim" ||
      obj.debateKind === "evidence" ||
      obj.debateKind === "rebuttal" ||
      obj.debateKind === "question" ||
      obj.debateKind === "summary"
    ) {
      next.debateKind = obj.debateKind;
    }
    if (obj.partition === "chat" || obj.partition === "debate") {
      next.partition = obj.partition;
    } else if (obj.debateFilter === "debate") {
      next.partition = "debate";
    } else if (obj.debateFilter === "normal" || obj.debateFilter === "all") {
      next.partition = "chat";
    }
    if (
      obj.stanceFilter === "all" ||
      obj.stanceFilter === "pro" ||
      obj.stanceFilter === "con" ||
      obj.stanceFilter === "uncertain"
    ) {
      next.stanceFilter = obj.stanceFilter;
    }
    if (
      obj.kindFilter === "all" ||
      obj.kindFilter === "claim" ||
      obj.kindFilter === "evidence" ||
      obj.kindFilter === "rebuttal" ||
      obj.kindFilter === "question" ||
      obj.kindFilter === "summary"
    ) {
      next.kindFilter = obj.kindFilter;
    }
    return next;
  } catch {
    return null;
  }
}

export default function ChatPanel({
  eventId,
  roomTitle,
  roomCategory,
  hideHeader = false,
  className,
}: ChatPanelProps) {
  const {
    account,
    connectWallet,
    formatAddress,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
  } = useWallet();
  const tChat = useTranslations("chat");

  const { messages } = useDiscussionMessages(eventId);
  const { forumMessages } = useForumThreads(eventId);
  const { nameMap } = useNameMap({ messages, forumMessages, account });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessageView | null>(null);
  const [partition, setPartition] = useState<"chat" | "debate">("chat");
  const [stanceFilter, setStanceFilter] = useState<"all" | "pro" | "con" | "uncertain">("all");
  const [kindFilter, setKindFilter] = useState<
    "all" | "claim" | "evidence" | "rebuttal" | "question" | "summary"
  >("all");
  const [debateMode, setDebateMode] = useState(false);
  const [debateStance, setDebateStance] =
    useState<NonNullable<ChatMessageView["debate_stance"]>>("pro");
  const [debateKind, setDebateKind] =
    useState<NonNullable<ChatMessageView["debate_kind"]>>("claim");

  const displayName = (addr: string) => getDisplayName(addr, nameMap, formatAddress);

  const quickPrompts = [
    tChat("quickPrompt.reason"),
    tChat("quickPrompt.update"),
    tChat("quickPrompt.opinion"),
  ];

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    const key = `chat:debatePrefs:${eventId}`;
    const prefs = parseDebatePrefs(
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null
    );
    if (!prefs) return;
    if (prefs.debateMode !== undefined) setDebateMode(prefs.debateMode);
    if (prefs.debateStance) setDebateStance(prefs.debateStance);
    if (prefs.debateKind) setDebateKind(prefs.debateKind);
    if (prefs.partition) setPartition(prefs.partition);
    if (prefs.stanceFilter) setStanceFilter(prefs.stanceFilter);
    if (prefs.kindFilter) setKindFilter(prefs.kindFilter);
  }, [eventId]);

  useEffect(() => {
    const key = `chat:debatePrefs:${eventId}`;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          debateMode,
          debateStance,
          debateKind,
          partition,
          stanceFilter,
          kindFilter,
        })
      );
    } catch {}
  }, [eventId, debateMode, debateStance, debateKind, partition, stanceFilter, kindFilter]);

  useEffect(() => {
    if (partition === "debate") {
      setDebateMode(true);
    } else {
      setDebateMode(false);
    }
  }, [partition]);

  const mergedMessages = useMemo(
    () => mergeMessages(messages, forumMessages),
    [messages, forumMessages]
  );

  const filteredMessages = useMemo(
    () =>
      mergedMessages
        .filter((m) => {
          const isDebate = !!(m.debate_kind || m.debate_stance);
          return partition === "debate" ? isDebate : !isDebate;
        })
        .filter((m) => {
          if (partition !== "debate") return true;
          if (stanceFilter !== "all" && m.debate_stance !== stanceFilter) return false;
          if (kindFilter !== "all" && m.debate_kind !== kindFilter) return false;
          return true;
        }),
    [mergedMessages, partition, stanceFilter, kindFilter]
  );

  const roomLabel = useMemo(() => {
    const t = String(roomTitle || "").trim();
    if (!t) return tChat("header.title");
    return tChat("header.withTopic").replace("{title}", t);
  }, [roomTitle, tChat]);

  const sendMessage = async (imageUrl?: string) => {
    if (!input.trim() && !imageUrl) return;
    if (!account) {
      setError(tChat("errors.walletRequired"));
      return;
    }
    const effectiveDebateMode = partition === "debate" || debateMode;
    const contentToSend = effectiveDebateMode
      ? `${buildDebatePrefix(debateStance, debateKind)} ${input}`
      : input;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: eventId,
          content: contentToSend,
          userId: account,
          image_url: imageUrl,
          replyToId: replyTo?.id,
          replyToUser: replyTo?.user_id,
          replyToContent: replyTo?.content.slice(0, 100), // 存储前100个字符作为摘要
          topic: null,
        }),
      });
      if (!res.ok) {
        throw new Error("send_failed");
      }
      setInput("");
      setReplyTo(null);
      setPartition(effectiveDebateMode ? "debate" : "chat");
    } catch (e: any) {
      setError(tChat("errors.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-3xl text-[var(--foreground)] glass-card shadow-md shadow-brand/20 relative overflow-hidden",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand/10 via-brand-accent/10 to-transparent dark:from-brand/15 dark:via-brand-accent/10 dark:to-transparent opacity-70" />
      <div className="pointer-events-none absolute -z-10 -top-24 -left-24 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl dark:bg-purple-500/10" />
      <div className="pointer-events-none absolute -z-10 -bottom-24 -right-24 h-72 w-72 rounded-full bg-fuchsia-500/12 blur-3xl dark:bg-fuchsia-500/10" />
      {!hideHeader && (
        <ChatHeader
          roomLabel={roomLabel}
          roomCategory={roomCategory}
          account={account}
          displayName={displayName}
          tChat={tChat}
          accentClass={getAccentClass(roomCategory)}
        />
      )}

      <div className="px-4 py-3 border-b border-[var(--card-border)] bg-[var(--card-bg)]/60 backdrop-blur-md flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
          {tChat("topics.sectionTitle")}
        </span>
        {(
          [
            { value: "chat", labelKey: "topics.chat" },
            { value: "debate", labelKey: "topics.debate" },
          ] as const
        ).map((t) => {
          const isActive = partition === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setPartition(t.value)}
              className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-all ${
                isActive
                  ? "bg-brand/10 border-brand/40 text-brand-700 dark:text-brand-300"
                  : "bg-[var(--card-bg)] border-[var(--card-border)] text-slate-500 hover:border-brand/30 hover:text-brand-700 dark:hover:text-brand-300"
              }`}
            >
              {tChat(t.labelKey)}
            </button>
          );
        })}
      </div>

      <MessagesList
        mergedMessages={filteredMessages}
        account={account}
        displayName={displayName}
        tChat={tChat}
        setInput={setInput}
        listRef={listRef}
        setReplyTo={setReplyTo} // 确保正确传递状态设置函数
      />

      <ChatInputArea
        account={account}
        tChat={tChat}
        connectWallet={connectWallet}
        requestWalletPermissions={requestWalletPermissions}
        siweLogin={siweLogin}
        multisigSign={multisigSign}
        quickPrompts={quickPrompts}
        input={input}
        setInput={setInput}
        sendMessage={sendMessage}
        sending={sending}
        showEmojis={showEmojis}
        setShowEmojis={setShowEmojis}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        displayName={displayName}
        error={error}
        debateMode={debateMode}
        setDebateMode={setDebateMode}
        debateStance={debateStance}
        setDebateStance={setDebateStance}
        debateKind={debateKind}
        setDebateKind={setDebateKind}
        forceDebateMode={partition === "debate"}
      />
    </div>
  );
}
