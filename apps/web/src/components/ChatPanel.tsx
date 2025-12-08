"use client";
import React, { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { useWallet } from "@/contexts/WalletContext";
import {
  MessageSquare,
  Sparkles,
  Loader2,
  Smile,
  Pin,
  Users,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import ForumSection from "@/components/ForumSection";

interface ChatPanelProps {
  eventId: number;
  roomTitle?: string;
  roomCategory?: string;
  followersCount?: number;
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
  followersCount = 0,
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
    chainId,
    switchNetwork,
    refreshBalance,
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
    if (c.includes("体育") || c.includes("sport") || c.includes("nba"))
      return "bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-orange-200/50 shadow-md";
    if (
      c.includes("娱乐") ||
      c.includes("entertainment") ||
      c.includes("movie")
    )
      return "bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-pink-200/50 shadow-md";
    if (
      c.includes("时政") ||
      c.includes("政治") ||
      c.includes("politics") ||
      c.includes("news")
    )
      return "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-emerald-200/50 shadow-md";
    if (c.includes("天气") || c.includes("weather"))
      return "bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-cyan-200/50 shadow-md";
    if (
      c.includes("科技") ||
      c.includes("tech") ||
      c.includes("ai") ||
      c.includes("crypto")
    )
      return "bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-violet-200/50 shadow-md";
    return "bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-indigo-200/50 shadow-md";
  };

  const getButtonGradient = () => {
    return "bg-gradient-to-r from-[#a855f7] to-[#ec4899] hover:brightness-105 text-white shadow-purple-200 shadow-md";
  };

  const getFooterBg = () => {
    const c = String(roomCategory || "").toLowerCase();
    if (
      c.includes("体育") ||
      c.includes("sport") ||
      c.includes("nba") ||
      c.includes("football")
    )
      return "bg-orange-50/95 border-orange-100";
    if (
      c.includes("娱乐") ||
      c.includes("entertainment") ||
      c.includes("movie") ||
      c.includes("music")
    )
      return "bg-pink-50/95 border-pink-100";
    if (
      c.includes("时政") ||
      c.includes("政治") ||
      c.includes("politics") ||
      c.includes("news") ||
      c.includes("finance")
    )
      return "bg-emerald-50/95 border-emerald-100";
    if (c.includes("天气") || c.includes("weather") || c.includes("climate"))
      return "bg-cyan-50/95 border-cyan-100";
    if (
      c.includes("科技") ||
      c.includes("tech") ||
      c.includes("ai") ||
      c.includes("crypto")
    )
      return "bg-violet-50/95 border-violet-100";
    // 默认也给科技色，或者保持暖米色。用户说“科技分类还没改”，暗示当前是科技分类但没生效。
    // 如果默认就是科技分类，这里应该兜底到科技色，或者确保逻辑能命中。
    // 但为了保险，我把 Tech 相关的词加全。
    return "bg-[#FAF2DA] border-[#FAF2DA]";
  };

  const getHeaderGradient = () => {
    const c = String(roomCategory || "").toLowerCase();
    if (c.includes("体育") || c.includes("sport") || c.includes("nba"))
      return "from-orange-500/90 to-amber-500/90";
    if (c.includes("娱乐") || c.includes("entertainment"))
      return "from-pink-500/90 to-rose-500/90";
    if (
      c.includes("时政") ||
      c.includes("政治") ||
      c.includes("politics") ||
      c.includes("news")
    )
      return "from-emerald-500/90 to-teal-500/90";
    if (c.includes("天气") || c.includes("weather"))
      return "from-cyan-500/90 to-blue-500/90";
    if (
      c.includes("科技") ||
      c.includes("tech") ||
      c.includes("ai") ||
      c.includes("crypto")
    )
      return "from-violet-500/90 to-purple-500/90";
    return "from-indigo-500/90 to-purple-600/90";
  };

  const getCategoryIconColor = () => {
    const c = String(roomCategory || "").toLowerCase();
    if (c.includes("体育") || c.includes("sport") || c.includes("nba"))
      return "text-orange-200";
    if (c.includes("娱乐") || c.includes("entertainment"))
      return "text-pink-200";
    if (
      c.includes("时政") ||
      c.includes("政治") ||
      c.includes("politics") ||
      c.includes("news")
    )
      return "text-emerald-200";
    if (c.includes("天气") || c.includes("weather")) return "text-cyan-200";
    if (
      c.includes("科技") ||
      c.includes("tech") ||
      c.includes("ai") ||
      c.includes("crypto")
    )
      return "text-violet-200";
    return "text-indigo-200";
  };

  const getMonetTexture = () => {
    const c = String(roomCategory || "").toLowerCase();

    const noise = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`;
    const strokes = `repeating-linear-gradient(125deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 6px, rgba(0,0,0,0) 6px, rgba(0,0,0,0) 14px)`;
    const swirl = `repeating-conic-gradient(from 20deg at 30% 60%, rgba(255,255,255,0.06) 0deg 12deg, rgba(0,0,0,0) 12deg 24deg)`;
    const base = "bg-fixed bg-cover bg-no-repeat";
    const commonStyle = {
      backgroundBlendMode: "soft-light, soft-light, normal, normal, normal",
      backgroundSize: "cover, 320px 320px, 220px 220px, cover, cover",
      backgroundPosition: "center, 0 0, 30% 40%, center, center",
      filter: "saturate(1.02) contrast(1.02)",
    } as React.CSSProperties;

    if (c.includes("体育") || c.includes("sport") || c.includes("nba")) {
      return {
        style: {
          ...commonStyle,
          backgroundImage: `${noise}, ${strokes}, ${swirl}, radial-gradient(circle at 0% 0%, rgba(255,230,200,0.6) 0%, transparent 60%), linear-gradient(120deg, #FFF8E1 0%, #FFECB3 100%)`,
          backgroundColor: "#FFF8E1",
          boxShadow: "inset 0 0 80px rgba(255,200,150,0.2)",
        },
        className: base,
      };
    }

    if (c.includes("娱乐") || c.includes("entertainment")) {
      return {
        style: {
          ...commonStyle,
          backgroundImage: `${noise}, ${strokes}, ${swirl}, radial-gradient(circle at 80% 20%, rgba(255,200,230,0.6) 0%, transparent 50%), linear-gradient(150deg, #FCE4EC 0%, #F3E5F5 100%)`,
          backgroundColor: "#FFF0F5",
          boxShadow: "inset 0 0 80px rgba(255,180,210,0.15)",
        },
        className: base,
      };
    }

    if (c.includes("时政") || c.includes("政治") || c.includes("news")) {
      return {
        style: {
          ...commonStyle,
          backgroundImage: `${noise}, ${strokes}, ${swirl}, radial-gradient(circle at 50% 0%, rgba(200,245,230,0.6) 0%, transparent 70%), linear-gradient(180deg, #E0F2F1 0%, #E0F7FA 100%)`,
          backgroundColor: "#F0FDF4",
          boxShadow: "inset 0 0 80px rgba(160,230,200,0.15)",
        },
        className: base,
      };
    }

    if (c.includes("科技") || c.includes("tech") || c.includes("ai")) {
      return {
        style: {
          ...commonStyle,
          backgroundImage: `${noise}, ${strokes}, ${swirl}, radial-gradient(circle at 0% 50%, rgba(220,220,255,0.6) 0%, transparent 50%), linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)`,
          backgroundColor: "#F5F3FF",
          boxShadow: "inset 0 0 80px rgba(180,190,255,0.15)",
        },
        className: base,
      };
    }

    return {
      style: {
        ...commonStyle,
        backgroundImage: `${noise}, ${strokes}, ${swirl}, radial-gradient(circle at 90% 10%, rgba(200,240,255,0.5) 0%, transparent 60%), linear-gradient(to bottom right, #E3F2FD 0%, #F3E5F5 100%)`,
        backgroundColor: "#F8FAFC",
        boxShadow: "inset 0 0 80px rgba(180,210,255,0.15)",
      },
      className: base,
    };
  };

  const monet = getMonetTexture();

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
        className={`px-4 py-3 bg-gradient-to-r ${getHeaderGradient()} text-white border-b border-white/10 flex items-center justify-between relative overflow-hidden shrink-0`}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="flex items-center gap-3 relative z-10 min-w-0 flex-1 mr-2">
          <div className="inline-flex items-center justify-center w-9 h-9 bg-white/20 rounded-xl shadow-sm flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="font-bold flex items-center gap-2 text-lg leading-tight">
              <span className="truncate">{roomTitle || "聊天室"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/80 mt-0.5">
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
              {account && (
                <>
                  <span className="opacity-60">•</span>
                  <span className="truncate max-w-[100px]">
                    {displayName(account)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10 flex-shrink-0">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
              Followers
            </span>
            <span className="text-sm font-bold text-white flex items-center gap-1">
              <Users size={14} className={getCategoryIconColor()} />
              {followersCount}
            </span>
          </div>

          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
              Category
            </span>
            <span className="text-sm font-bold text-white flex items-center gap-1">
              <TrendingUp size={14} className={getCategoryIconColor()} />
              {roomCategory || "General"}
            </span>
          </div>

          <button className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <MoreHorizontal size={20} />
          </button>
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
        className={`flex-1 overflow-y-auto p-4 pb-20 space-y-3 ${monet.className} backdrop-blur-[1px] scrollbar-hide`}
        style={monet.style}
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
                  } w-8 h-8 rounded-full bg-slate-100/80 border border-white/50 flex items-center justify-center text-purple-600 text-xs font-bold shadow-sm`}
                >
                  {displayName(m.user_id).slice(0, 2)}
                </div>
                <div className={`${mine ? "order-1" : ""} max-w-[80%]`}>
                  <div
                    className={`${
                      mine
                        ? getMessageBubbleColor()
                        : "bg-slate-50/80 backdrop-blur-sm text-gray-900 border border-white/40 shadow-sm"
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

      <div
        className={`p-3 border-t backdrop-blur-md relative pb-[env(safe-area-inset-bottom)] text-slate-800 ${getFooterBg()}`}
      >
        {!account ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 font-medium">
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
            {account && !chainId && (
              <div className="mb-2 flex items-center justify-between rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2 text-yellow-800">
                <span className="text-xs font-medium">钱包未连接网络</span>
                <button
                  type="button"
                  className="text-xs px-2 py-1 rounded-md bg-purple-600 text-white hover:brightness-105"
                  onClick={async () => {
                    const res = await switchNetwork("0xaa36a7");
                    if (res?.success) await refreshBalance();
                  }}
                >
                  切到 Sepolia
                </button>
              </div>
            )}
            {/* 快捷提示 */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInput(p)}
                  className="text-xs px-2 py-1 rounded-full border border-transparent bg-white/60 text-slate-600 hover:bg-white transition-colors shadow-sm"
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
                  className="w-full resize-none px-3 py-2 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7A15]/20 bg-white focus:bg-white transition-all shadow-sm placeholder:text-slate-400 text-slate-800"
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
                  <div className="absolute right-0 bottom-14 z-10 bg-slate-100/95 backdrop-blur-md border border-white/50 rounded-2xl shadow-xl p-3 grid grid-cols-6 gap-1">
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
                className={getButtonGradient()}
              >
                {sending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
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
