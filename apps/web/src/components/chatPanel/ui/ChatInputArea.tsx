"use client";

import React, { memo } from "react";
import Button from "@/components/ui/Button";
import { Loader2, Smile } from "lucide-react";

export type ChatInputAreaProps = {
  account: string | null | undefined;
  tChat: (key: string) => string;
  connectWallet: () => Promise<void>;
  requestWalletPermissions: () => Promise<{ success: boolean; error?: string }>;
  siweLogin: () => Promise<{ success: boolean; address?: string; error?: string }>;
  multisigSign: (data?: {
    verifyingContract?: string;
    action?: string;
    nonce?: number;
  }) => Promise<{ success: boolean; signature?: string; error?: string }>;
  quickPrompts: string[];
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sendMessage: () => Promise<void>;
  sending: boolean;
  showEmojis: boolean;
  setShowEmojis: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
};

export const ChatInputArea = memo(function ChatInputArea({
  account,
  tChat,
  connectWallet,
  requestWalletPermissions,
  siweLogin,
  multisigSign,
  quickPrompts,
  input,
  setInput,
  sendMessage,
  sending,
  showEmojis,
  setShowEmojis,
  error,
}: ChatInputAreaProps) {
  return (
    <div className="p-3 border-t border-[var(--card-border)] bg-[var(--card-bg)]/80 backdrop-blur-xl relative pb-[env(safe-area-inset-bottom)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-accent/15 via-brand/8 to-transparent dark:from-brand-accent/12 dark:via-brand/10 dark:to-transparent opacity-60" />
      <div className="relative z-10">
        {!account ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-700 dark:text-slate-200 font-medium">
              {tChat("input.walletRequired")}
            </div>
            <Button
              size="sm"
              variant="cta"
              onClick={async () => {
                await connectWallet();
                await requestWalletPermissions();
                await siweLogin();
                await multisigSign();
              }}
            >
              {tChat("input.connectAndSign")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInput(p)}
                  className="text-xs px-2 py-1 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-slate-600 dark:text-slate-300 hover:border-brand/25 hover:bg-brand/10 transition-colors shadow-sm"
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={tChat("input.placeholder")}
                  rows={2}
                  className="input-base w-full resize-none px-3 py-2 bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--foreground)] placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <div className="absolute right-2 bottom-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 text-slate-400 hover:text-brand transition-colors"
                    onClick={() => setShowEmojis((v) => !v)}
                    aria-label={tChat("input.toggleEmojisAria")}
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand" />
                    ) : (
                      <Smile className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {showEmojis && (
                  <div className="absolute right-0 bottom-14 z-10 bg-[var(--card-bg)] backdrop-blur-md border border-[var(--card-border)] rounded-2xl shadow-xl p-3 grid grid-cols-6 gap-1">
                    {["🙂", "🔥", "🚀", "💡", "🎯", "👏", "📈", "🤔", "✅", "❗", "✨", "📌"].map(
                      (emo) => (
                        <button
                          key={emo}
                          className="text-base px-1 py-1 hover:bg-white/10 dark:hover:bg-white/5 rounded"
                          type="button"
                          onClick={() => setInput((prev) => prev + emo)}
                        >
                          {emo}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
              <Button onClick={sendMessage} disabled={sending} size="sm" variant="primary">
                {sending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tChat("input.sending")}
                  </span>
                ) : (
                  tChat("input.send")
                )}
              </Button>
            </div>
          </>
        )}
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
});
