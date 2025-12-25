"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import { useTranslations } from "@/lib/i18n";

export function ReplyBox({ onSubmit }: { onSubmit: (text: string) => void | Promise<void> }) {
  const tForum = useTranslations("forum");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await onSubmit(text);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={tForum("reply.placeholder")}
        className="flex-1 px-3 py-2 border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white/50 focus:bg-white/90 transition-all text-gray-800"
      />
      <Button onClick={submit} disabled={sending} size="sm" variant="primary">
        {sending ? tForum("reply.sending") : tForum("reply.submit")}
      </Button>
    </div>
  );
}
