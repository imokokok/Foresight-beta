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
import { catCls, getAccentClass } from "./chatPanel/utils/colors";
import { mergeMessages } from "./chatPanel/utils/mergeMessages";
import { ChatHeader } from "./chatPanel/ui/ChatHeader";
import { AnnouncementBar } from "./chatPanel/ui/AnnouncementBar";
import { MessagesList } from "./chatPanel/ui/MessagesList";
import { ChatInputArea } from "./chatPanel/ui/ChatInputArea";

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
  const { forumThreads, forumMessages } = useForumThreads(eventId);
  const { nameMap } = useNameMap({ messages, forumMessages, account });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessageView | null>(null);
  const [activeTopic, setActiveTopic] = useState<string>("all");

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

  const mergedMessages = useMemo(
    () => mergeMessages(messages, forumMessages),
    [messages, forumMessages]
  );

  const filteredMessages = useMemo(
    () =>
      activeTopic === "all"
        ? mergedMessages
        : mergedMessages.filter((m) => m.topic === activeTopic),
    [mergedMessages, activeTopic]
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
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: eventId,
          content: input,
          userId: account,
          image_url: imageUrl,
          replyToId: replyTo?.id,
          replyToUser: replyTo?.user_id,
          replyToContent: replyTo?.content.slice(0, 100), // 存储前100个字符作为摘要
          topic: activeTopic === "all" ? null : activeTopic,
        }),
      });
      if (!res.ok) {
        throw new Error("send_failed");
      }
      setInput("");
      setReplyTo(null);
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

      <AnnouncementBar
        roomCategory={roomCategory}
        forumThreads={forumThreads}
        tChat={tChat}
        badgeClass={catCls(roomCategory)}
      />

      <MessagesList
        mergedMessages={filteredMessages}
        account={account}
        displayName={displayName}
        tChat={tChat}
        setInput={setInput}
        listRef={listRef}
        setReplyTo={setReplyTo} // 确保正确传递状态设置函数
        activeTopic={activeTopic}
        onTopicChange={setActiveTopic}
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
      />
    </div>
  );
}
