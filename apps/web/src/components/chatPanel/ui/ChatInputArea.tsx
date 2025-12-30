"use client";

import React, { memo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { Loader2, Smile, X, MessageSquare, Image as ImageIcon, Sticker, Lock } from "lucide-react";
import type { ChatMessageView } from "../types";
import { OFFICIAL_STICKERS, isImageUrl } from "@/components/StickerRevealModal";

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
  sendMessage: (imageUrl?: string) => Promise<void>;
  sending: boolean;
  showEmojis: boolean;
  setShowEmojis: React.Dispatch<React.SetStateAction<boolean>>;
  replyTo?: ChatMessageView | null;
  setReplyTo?: (msg: ChatMessageView | null) => void;
  displayName?: (addr: string) => string;
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
  replyTo,
  setReplyTo,
  displayName,
  error,
}: ChatInputAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !account) return;

    setUploading(true);
    setLocalError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("walletAddress", account);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (result.success && result.data?.publicUrl) {
        await sendMessage(result.data.publicUrl);
      } else {
        throw new Error("upload_failed");
      }
    } catch (err: any) {
      setLocalError(tChat("input.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSendSticker = async (stickerUrl: string) => {
    setShowStickers(false);
    await sendMessage(stickerUrl);
  };
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

            {replyTo && (
              <div className="flex items-center justify-between gap-2 mb-2 p-2 bg-brand/5 border border-brand/10 rounded-xl text-xs animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare size={12} className="text-brand shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-brand truncate">
                      {displayName?.(replyTo.user_id)}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 truncate">
                      {replyTo.content}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setReplyTo?.(null)}
                  className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-slate-400"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploading || !account}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-brand transition-colors disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                  title={tChat("input.uploadImage")}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-brand" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={!account}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-brand transition-colors disabled:opacity-50 ${showStickers ? "text-brand bg-brand/5" : ""}`}
                  onClick={() => {
                    setShowStickers(!showStickers);
                    setShowEmojis(false);
                  }}
                  title={tChat("input.stickers")}
                >
                  <Sticker className="w-4 h-4" />
                </button>
              </div>

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
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 dark:hover:bg-white/5 text-slate-400 hover:text-brand transition-colors ${showEmojis ? "text-brand" : ""}`}
                    onClick={() => {
                      setShowEmojis((v) => !v);
                      setShowStickers(false);
                    }}
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
                  <div className="absolute right-0 bottom-14 z-10 bg-[var(--card-bg)] backdrop-blur-md border border-[var(--card-border)] rounded-2xl shadow-xl p-3 grid grid-cols-6 gap-1 animate-in fade-in zoom-in duration-200">
                    {[
                      "🙂",
                      "🔥",
                      "🚀",
                      "💡",
                      "🎯",
                      "👏",
                      "📈",
                      "🤔",
                      "✅",
                      "❗",
                      "✨",
                      "📌",
                      "🌈",
                      "💎",
                      "💯",
                      "🎉",
                      "👀",
                      "🙌",
                    ].map((emo) => (
                      <button
                        key={emo}
                        className="text-base px-1 py-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                        type="button"
                        onClick={() => setInput((prev) => prev + emo)}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                )}
                {showStickers && (
                  <div className="absolute left-0 bottom-14 z-10 w-64 bg-[var(--card-bg)] backdrop-blur-md border border-[var(--card-border)] rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in duration-200">
                    <div className="text-[10px] font-black uppercase text-slate-400 mb-2 px-1 tracking-wider">
                      Stickers
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {OFFICIAL_STICKERS.map((s) => (
                        <button
                          key={s.id}
                          className="aspect-square flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 hover:bg-brand/10 border border-transparent hover:border-brand/20 transition-all group overflow-hidden"
                          type="button"
                          onClick={() => onSendSticker(s.emoji)}
                        >
                          {isImageUrl(s.emoji) ? (
                            <img src={s.emoji} alt={s.name} className="w-8 h-8 object-contain" />
                          ) : (
                            <span className="text-2xl group-hover:scale-110 transition-transform">
                              {s.emoji}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={() => sendMessage()}
                disabled={sending || uploading}
                size="sm"
                variant="primary"
              >
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
        {(error || localError) && (
          <div className="mt-2 text-xs text-red-600 animate-pulse">{error || localError}</div>
        )}
      </div>
    </div>
  );
});
