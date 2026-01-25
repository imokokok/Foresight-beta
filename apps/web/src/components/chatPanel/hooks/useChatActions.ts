"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import type { ChatMessageView } from "../types";
import { buildDebatePrefix } from "../utils/debateUtils";

type ReplyToMessage = {
  id: string;
  user_id?: string;
  content?: string;
};

export function useChatActions({
  eventId,
  address,
  partition,
  debateMode,
  debateStance,
  debateKind,
  setMessages,
  setPartition,
}: {
  eventId: number | string;
  address: string | null | undefined;
  partition: "chat" | "debate" | "forum";
  debateMode: boolean;
  debateStance: NonNullable<ChatMessageView["debate_stance"]>;
  debateKind: NonNullable<ChatMessageView["debate_kind"]>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageView[]>>;
  setPartition: (p: "chat" | "debate" | "forum") => void;
}) {
  const tChat = useTranslations("chat");
  const tCommon = useTranslations("common");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (input: string, replyTo: ReplyToMessage | null, imageUrl?: string) => {
      if (!input.trim() && !imageUrl) return;
      if (!address) {
        const msg = tChat("errors.walletRequired");
        setSendError(msg);
        toast.error(tCommon("error"), msg);
        return;
      }
      if (partition === "forum") {
        const msg = tChat("forum.readOnlyHint");
        setSendError(msg);
        toast.error(tCommon("error"), msg);
        return;
      }
      const effectiveDebateMode = partition === "debate" || debateMode;
      const contentToSend = effectiveDebateMode
        ? `${buildDebatePrefix(debateStance, debateKind)} ${input}`
        : input;
      setSending(true);
      setSendError(null);
      try {
        const replyToId = replyTo?.id && /^\d+$/.test(replyTo.id) ? Number(replyTo.id) : null;
        const res = await fetch("/api/discussions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proposalId: eventId,
            content: contentToSend,
            userId: address,
            image_url: imageUrl,
            replyToId,
            replyToUser: replyTo?.user_id || null,
            replyToContent: replyTo?.content ? replyTo.content.slice(0, 100) : null,
            topic: null,
          }),
        });
        if (!res.ok) {
          throw new Error("send_failed");
        }
        setPartition(effectiveDebateMode ? "debate" : "chat");
        return true;
      } catch (e) {
        const error = e as Error;
        const msg = tChat("errors.sendFailed");
        setSendError(msg);
        toast.error(tCommon("error"), msg);
        return false;
      } finally {
        setSending(false);
      }
    },
    [
      address,
      eventId,
      partition,
      debateMode,
      debateStance,
      debateKind,
      setPartition,
      tChat,
      tCommon,
    ]
  );

  const deleteMessage = useCallback(
    async (msg: ChatMessageView) => {
      if (!address) return;
      if (!/^\d+$/.test(String(msg.id || ""))) return;
      try {
        const res = await fetch(`/api/discussions/${msg.id}`, { method: "DELETE" });
        if (!res.ok) {
          const contentType = String(res.headers.get("content-type") || "");
          const json = contentType.includes("application/json")
            ? await res.json().catch(() => null)
            : null;
          const serverMsg = String(
            (json as any)?.error?.message || (json as any)?.message || ""
          ).trim();
          throw new Error(serverMsg || "delete_failed");
        }
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)));
        toast.success(tCommon("success"), tChat("message.deleted"));
      } catch (e) {
        const error = e as Error;
        const msg = String(error?.message || "").trim();
        toast.error(
          tCommon("error"),
          msg && msg !== "delete_failed" ? msg : tChat("message.deleteFailed")
        );
      }
    },
    [address, setMessages, tCommon, tChat]
  );

  const reportMessage = useCallback(
    async (msg: ChatMessageView, reason: string) => {
      if (!address) return;
      if (!/^\d+$/.test(String(msg.id || ""))) return;
      try {
        const res = await fetch("/api/discussions/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discussionId: Number(msg.id),
            reason,
          }),
        });
        if (!res.ok) {
          const contentType = String(res.headers.get("content-type") || "");
          const json = contentType.includes("application/json")
            ? await res.json().catch(() => null)
            : null;
          const serverMsg = String(
            (json as any)?.error?.message || (json as any)?.message || ""
          ).trim();
          throw new Error(serverMsg || "report_failed");
        }
        toast.success(tCommon("success"), tChat("message.reported"));
      } catch (e) {
        const error = e as Error;
        const msg = String(error?.message || "").trim();
        toast.error(
          tCommon("error"),
          msg && msg !== "report_failed" ? msg : tChat("message.reportFailed")
        );
      }
    },
    [address, tCommon, tChat]
  );

  return {
    sending,
    sendError,
    sendMessage,
    deleteMessage,
    reportMessage,
  };
}
