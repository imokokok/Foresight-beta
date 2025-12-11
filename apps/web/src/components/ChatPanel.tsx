"use client";
import React, { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { useWallet } from "@/contexts/WalletContext";
import { MessageSquare, Sparkles, Loader2, Smile, Pin } from "lucide-react";
import ForumSection from "@/components/ForumSection";

interface ChatPanelProps {
  eventId: number;
  roomTitle?: string;
  roomCategory?: string;
  isProposalRoom?: boolean;
  minHeightPx?: number;
  minHeightVh?: number;
}

interface ChatMessageView {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export default function ChatPanel({
  eventId,
  roomTitle,
  roomCategory,
  isProposalRoom,
  minHeightPx,
  minHeightVh,
}: ChatPanelProps) {
  const {
    account,
    connectWallet,
    formatAddress,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
  } = useWallet();
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [forumThreads, setForumThreads] = useState<any[]>([]);
  const [forumMessages, setForumMessages] = useState<ChatMessageView[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const displayName = (addr: string) => {
    const key = String(addr || "").toLowerCase();
    return nameMap[key] || formatAddress(addr);
  };

  const quickPrompts = [
    "这条预测的依据是什么？",
    "有没有最新进展？",
    "我认为概率更高的理由是…",
  ];

  useEffect(() => {
    let unsub: any;
    const load = async () => {
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from("discussions")
            .select("*")
            .eq("proposal_id", eventId)
            .order("created_at", { ascending: true });
          if (!error) {
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
      const ch = supabase
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
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime()
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
            const r: any = payload.old;
            setMessages((prev) => prev.filter((x) => x.id !== String(r.id)));
          }
        )
        .subscribe();
      unsub = () => {
        try {
          supabase?.removeChannel(ch);
        } catch {}
      };
    }
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [eventId]);

  useEffect(() => {
    const loadForum = async () => {
      try {
        const res = await fetch(`/api/forum?eventId=${eventId}`);
        const data = await res.json();
        const threads = Array.isArray(data?.threads) ? data.threads : [];
        setForumThreads(threads);
        const fm: ChatMessageView[] = [];
        threads.forEach((t: any) => {
          fm.push({
            id: `thread:${t.id}`,
            user_id: String(t.user_id || ""),
            content: `${String(t.title || "")}\n${String(
              t.content || ""
            )}`.trim(),
            created_at: String(t.created_at || ""),
          });
          (Array.isArray(t.comments) ? t.comments : []).forEach((c: any) => {
            fm.push({
              id: `comment:${c.id}`,
              user_id: String(c.user_id || ""),
              content: String(c.content || ""),
              created_at: String(c.created_at || ""),
            });
          });
        });
        fm.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setForumMessages(fm);
      } catch {}
    };
    loadForum();
  }, [eventId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    try {
      const addrs = new Set<string>();
      messages.forEach((m) => {
        if (m.user_id) addrs.add(String(m.user_id).toLowerCase());
      });
      forumMessages.forEach((m) => {
        if (m.user_id) addrs.add(String(m.user_id).toLowerCase());
      });
      if (account) addrs.add(String(account).toLowerCase());
      const unknown = Array.from(addrs).filter((a) => !nameMap[a]);
      if (unknown.length === 0) return;
      fetch(
        `/api/user-profiles?addresses=${encodeURIComponent(unknown.join(","))}`
      )
        .then((r) => r.json())
        .then((data) => {
          const arr = Array.isArray(data?.profiles) ? data.profiles : [];
          const next: Record<string, string> = {};
          arr.forEach((p: any) => {
            if (p?.wallet_address && p?.username)
              next[String(p.wallet_address).toLowerCase()] = String(p.username);
          });
          if (Object.keys(next).length > 0)
            setNameMap((prev) => ({ ...prev, ...next }));
        })
        .catch(() => {});
    } catch {}
  }, [messages, forumMessages, account]);

  const mergedMessages = React.useMemo(() => {
    const all = [...messages, ...forumMessages];
    const byId: Record<string, ChatMessageView> = {};
    all.forEach((m) => {
      byId[m.id] = m;
    });
    const arr = Object.values(byId);
    arr.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return arr;
  }, [messages, forumMessages]);

  const roomLabel = React.useMemo(() => {
    const t = String(roomTitle || "").trim();
    if (!t) return "聊天室";
    return `聊天室 · ${t}`;
  }, [roomTitle]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    if (!account) {
      setError("请先连接钱包后再发送消息");
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
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      setInput("");
    } catch (e: any) {
      setError(e?.message || "发送失败");
    } finally {
      setSending(false);
    }
  };

  const catCls = (cat?: string) => {
    const c = String(cat || "").toLowerCase();
    if (c.includes("科技")) return "bg-sky-100 text-sky-700";
    if (c.includes("体育")) return "bg-emerald-100 text-emerald-700";
    if (c.includes("娱乐")) return "bg-pink-100 text-pink-700";
    if (c.includes("时政") || c.includes("政治"))
      return "bg-emerald-100 text-emerald-700";
    if (c.includes("天气")) return "bg-cyan-100 text-cyan-700";
    if (c.includes("加密") || c.includes("crypto"))
      return "bg-indigo-100 text-indigo-700";
    if (c.includes("生活")) return "bg-rose-100 text-rose-700";
    if (c.includes("科技")) return "bg-violet-100 text-violet-700";
    if (c.includes("体育")) return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-700";
  };

  const getMessageBubbleColor = () => {
    const c = String(roomCategory || "").toLowerCase();
    if (c.includes("体育"))
      return "bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-orange-200/50 shadow-md";
    if (c.includes("娱乐"))
      return "bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-pink-200/50 shadow-md";
    if (c.includes("时政") || c.includes("政治"))
      return "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-emerald-200/50 shadow-md";
    if (c.includes("天气"))
      return "bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-cyan-200/50 shadow-md";
    if (c.includes("科技"))
      return "bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-violet-200/50 shadow-md";
    return "bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-indigo-200/50 shadow-md";
  };

  const getHeaderGradient = () => {
    const c = String(roomCategory || "").toLowerCase();
    if (c.includes("体育")) return "from-orange-500/90 to-amber-500/90";
    if (c.includes("娱乐")) return "from-pink-500/90 to-rose-500/90";
    if (c.includes("时政") || c.includes("政治"))
      return "from-emerald-500/90 to-teal-500/90";
    if (c.includes("天气")) return "from-cyan-500/90 to-blue-500/90";
    if (c.includes("科技")) return "from-violet-500/90 to-purple-500/90";
    return "from-indigo-500/90 to-purple-600/90";
  };

  const containerCls = "flex flex-col h-full bg-transparent relative";
  const minH = String(
    minHeightPx && minHeightPx > 0
      ? `${minHeightPx}px`
      : minHeightVh && minHeightVh > 0
      ? `${minHeightVh}vh`
      : "100%"
  );

  return (
    <div className={containerCls} style={{ minHeight: minH }}>
      <div
        className={`px-4 py-4 bg-gradient-to-r ${getHeaderGradient()} text-white border-b border-white/10 flex items-center justify-between relative overflow-hidden`}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="flex items-center gap-2 relative z-10">
          <div className="inline-flex items-center justify-center w-8 h-8 bg-white/20 rounded-xl shadow-sm">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="font-bold flex items-center gap-2">
            <span className="tracking-tight">{roomLabel}</span>
          </div>
          <Sparkles className="w-4 h-4 text-white/90" />
        </div>
        <div className="text-xs font-medium bg-white/20 text-white px-2 py-1 rounded-lg border border-white/20 relative z-10">
          {account ? `你：${displayName(account)}` : "未连接钱包"}
        </div>
      </div>

      <div className="px-4 py-2 bg-white/10 border-b border-white/20 flex items-center gap-2 text-xs text-white">
        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white">
          公告
        </span>
        <div className="flex-1 truncate">
          {forumThreads.slice(0, 2).map((t) => (
            <span key={t.id} className="mr-3 opacity-90">
              {String(t.title || "").slice(0, 40)}
            </span>
          ))}
          {forumThreads.length === 0 && (
            <span className="opacity-75">暂无公告</span>
          )}
        </div>
      </div>

      {isProposalRoom ? (
        <div className="mx-4 mt-3 mb-4 rounded-3xl border-2 border-pink-400 bg-pink-50/80 shadow-sm">
          <div className="px-4 pb-4">
            <ForumSection eventId={eventId} />
          </div>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-4 pb-20 space-y-3 bg-transparent custom-scrollbar"
      >
        {mergedMessages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10">
            暂无消息，快来开启讨论吧！
          </div>
        )}
        {mergedMessages.map((m, i) => {
          const mine =
            !!account &&
            !!m.user_id &&
            String(account).toLowerCase() === String(m.user_id).toLowerCase();
          const prev = i > 0 ? mergedMessages[i - 1] : null;
          const dateChanged =
            prev &&
            new Date(prev.created_at).toDateString() !==
              new Date(m.created_at).toDateString();
          return (
            <React.Fragment key={m.id}>
              {dateChanged && (
                <div className="flex justify-center">
                  <span className="text-xs text-gray-500 bg-white/40 border border-white/60 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                    {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div
                className={`flex items-end gap-3 ${mine ? "justify-end" : ""}`}
              >
                <div
                  className={`${
                    mine ? "order-2" : ""
                  } w-8 h-8 rounded-full bg-white/80 border border-white flex items-center justify-center text-purple-600 text-xs font-bold shadow-sm`}
                >
                  {displayName(m.user_id).slice(0, 2)}
                </div>
                <div className={`${mine ? "order-1" : ""} max-w-[80%]`}>
                  <div
                    className={`$
                      mine
                        ? getMessageBubbleColor()
                    : "bg-white/60 text-gray-800 border border-white/30 shadow-sm"
                    } rounded-2xl px-3 py-2`}
                  >
                    <div className="text-xs opacity-80 mb-1">
                      <span className="mr-2">{displayName(m.user_id)}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div className="leading-relaxed break-words">
                      {m.content}
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="p-3 border-t border-white/30 bg-white/20 backdrop-blur-md relative pb-[env(safe-area-inset-bottom)] text-white">
        {!account ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-white font-medium">
              发送消息需连接钱包
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
              连接并签名
            </Button>
          </div>
        ) : (
          <>
            {/* 快捷提示 */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInput(p)}
                  className="text-xs px-2 py-1 rounded-full border border-white/30 bg-white/10 text-slate-800 hover:bg-white/20 transition-colors"
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
                  placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"
                  rows={2}
                  className="w-full resize-none px-3 py-2 border border-white/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/40 bg-white/15 focus:bg-white/25 transition-all shadow-inner placeholder:text-white/70 text-white"
                />
                {/* 表情选择 */}
                <div className="absolute right-2 bottom-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100/50 text-gray-400 hover:text-indigo-600 transition-colors"
                    onClick={() => setShowEmojis((v) => !v)}
                    aria-label="选择表情"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : (
                      <Smile className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {showEmojis && (
                  <div className="absolute right-0 bottom-14 z-10 bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl shadow-xl p-3 grid grid-cols-6 gap-1">
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
                    ].map((emo) => (
                      <button
                        key={emo}
                        className="text-base px-1 py-1 hover:bg-gray-100 rounded"
                        type="button"
                        onClick={() => setInput((prev) => prev + emo)}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={sendMessage}
                disabled={sending}
                size="sm"
                variant="primary"
              >
                {sending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    发送中…
                  </span>
                ) : (
                  "发送"
                )}
              </Button>
            </div>
          </>
        )}
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
}
