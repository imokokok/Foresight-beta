"use client";
import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, Tag, Flame, Pin } from "lucide-react";
import ForumSection from "@/components/ForumSection";
import ChatPanel from "@/components/ChatPanel";
interface ThreadView {
  id: number;
  event_id: number;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  comments?: Array<{
    id: number;
    thread_id: number;
    event_id: number;
    user_id: string;
    content: string;
    created_at: string;
    upvotes: number;
    downvotes: number;
    parent_id?: number | null;
  }>;
}

export default function ForumPage() {
  const [hotProposals, setHotProposals] = useState<ThreadView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{ id: number; title: string; category?: string; status?: string }>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'proposal'|'event'>('proposal');
  const [q, setQ] = useState<string>("");
  const leftAsideRef = useRef<HTMLDivElement | null>(null);
  const [leftAsideHeight, setLeftAsideHeight] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/forum?eventId=1");
        const data = await res.json();
        const threads: ThreadView[] = Array.isArray(data?.threads) ? data.threads : [];
        const ranked = [...threads].sort((a, b) => (b.upvotes) - (a.upvotes));
        setHotProposals(ranked.slice(0, 10));
      } catch (e: any) {
        setError(e?.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/predictions");
        const json = await res.json();
        const list: any[] = Array.isArray(json?.data) ? json.data : [];
        const mapped = list
          .filter((x) => Number.isFinite(Number(x?.id)))
          .map((x) => ({ id: Number(x.id), title: String(x.title || `事件 #${x.id}`), category: String(x.category || ""), status: String(x.status || "") }));
        setEvents(mapped);
        if (!selectedId && mapped.length > 0) setSelectedId(mapped[0].id);
      } catch {}
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    const measure = () => {
      const el = leftAsideRef.current;
      if (el) setLeftAsideHeight(el.offsetHeight);
    };
    measure();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      const id = setInterval(measure, 500);
      return () => { window.removeEventListener('resize', measure); clearInterval(id as any); };
    }
    return undefined;
  }, [events.length, q, selectedId, mode]);

  const activeEventId = selectedId ?? (events[0]?.id ?? 1);
  const activeTitle = mode === 'proposal' ? '事件提案' : (events.find(e => e.id === activeEventId)?.title || '');
  const activeCategory = mode === 'proposal' ? '置顶提案' : (events.find(e => e.id === activeEventId)?.category || '');

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-cyan-50 overflow-hidden text-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-xl"></div>
      </div>

      

      <div className="relative z-10 px-6 lg:px-10 py-6">
        <div className="px-4 py-3 rounded-3xl mb-6 bg-gradient-to-br from-pink-50/60 to-cyan-50/60 border border-pink-200/60">
          <div className="flex items-center justify-between">
            <div className="font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">社区频道与提案导航</div>
            <a href="#proposals" className="btn-base btn-sm btn-cta">快速发帖</a>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <aside ref={leftAsideRef} className="rounded-3xl border border-purple-200/60 bg-white/80 backdrop-blur-sm shadow-sm p-4 lg:sticky lg:top-24 h-fit lg:col-span-1">
            <h2 className="text-lg font-bold mb-3">全部频道</h2>
            <div className="mb-3">
              <button
                onClick={() => setMode('proposal')}
                className={`w-full text-left px-3 py-2 rounded-xl border transition-all duration-200 ${mode === 'proposal' ? 'border-pink-400 bg-pink-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-2">
                  <Pin className="w-4 h-4 text-pink-600" />
                  <span className="text-sm font-semibold text-gray-800">事件提案频道（置顶）</span>
                </div>
              </button>
            </div>
            <div className="mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索事件或分类"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/80"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {Array.from(new Set(events.map(e => String(e.category || '').trim()).filter(Boolean))).map(cat => (
                <button
                  key={cat}
                  onClick={() => setQ(cat)}
                  className={`text-xs px-2 py-1 rounded-full border ${q.trim() === cat ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-700'}`}
                >{cat}</button>
              ))}
              {events.length > 0 && (
                <button onClick={() => setQ('')} className={`text-xs px-2 py-1 rounded-full border ${q ? 'border-gray-200 bg-white text-gray-700' : 'border-purple-400 bg-purple-50 text-purple-700'}`}>全部</button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1 -mr-1">
              {events
                .filter((e) => {
                  const qq = q.trim().toLowerCase();
                  if (!qq) return true;
                  if (selectedId && e.id === selectedId) return false;
                  return e.title.toLowerCase().includes(qq) || String(e.category || "").toLowerCase().includes(qq);
                })
                .map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => { setSelectedId(ev.id); setMode('event'); }}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-all duration-200 ${(mode === 'event' && selectedId === ev.id) ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${String(ev.category || '').includes('科技') ? 'bg-sky-100 text-sky-700' : String(ev.category || '').includes('体育') ? 'bg-emerald-100 text-emerald-700' : String(ev.category || '').includes('娱乐') ? 'bg-pink-100 text-pink-700' : String(ev.category || '').includes('时政') ? 'bg-violet-100 text-violet-700' : String(ev.category || '').includes('天气') ? 'bg-amber-100 text-amber-700' : String(ev.category || '').includes('加密') ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>{ev.category || '未分类'}</span>
                      <div className="text-sm font-semibold text-gray-800 line-clamp-1">{ev.title}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{ev.status ? ev.status : ''}</div>
                  </button>
                ))}
            </div>
          </aside>
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <main className={`space-y-6 ${mode === 'event' ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                <ChatPanel
                  eventId={activeEventId}
                  roomTitle={activeTitle}
                  roomCategory={activeCategory}
                  isProposalRoom={mode === 'proposal'}
                  minHeightPx={leftAsideHeight}
                />
              </main>
              {mode !== 'event' && (
              <aside className="rounded-3xl border border-purple-200/60 bg-white/80 backdrop-blur-sm shadow-sm p-4 h-fit lg:col-span-1">
                  <div className="mb-4">
                    <h2 className="text-lg font-bold">热门提案</h2>
                    {loading && <div className="text-sm text-gray-600 mt-2">加载中…</div>}
                    {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
                    {!loading && !error && (
                      <div className="mt-3 space-y-3">
                        {hotProposals.length === 0 && (
                          <div className="text-sm text-gray-600">暂无提案</div>
                        )}
                        {hotProposals.map((p) => (
                          <div key={p.id} className="flex items-start justify-between p-3 rounded-xl border border-pink-200/60 bg-white/70">
                            <div className="mr-3">
                              <div className="text-sm font-medium text-gray-800 line-clamp-2">{p.title}</div>
                              <div className="text-xs text-gray-500 mt-1">由 {String(p.user_id).slice(0, 6)}… 在 {new Date(p.created_at).toLocaleDateString()} 提出</div>
                            </div>
                            <div className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">👍 {p.upvotes}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div id="announcements" className="mb-4">
                    <h2 className="text-lg font-bold">官方公告</h2>
                    <div className="mt-2 text-sm text-gray-700 bg-white/70 border border-purple-200/60 rounded-xl p-3">近期采纳的提案将通过此处公示与结算源确认</div>
                  </div>
                  <div className="mb-4">
                    <h2 className="text-lg font-bold">筛选与搜索</h2>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select className="px-3 py-2 rounded-xl border border-pink-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-800">
                        <option>状态：全部</option>
                        <option>草稿</option>
                        <option>审核中</option>
                        <option>已采纳</option>
                        <option>已拒绝</option>
                        <option>待补充结算源</option>
                      </select>
                      <select className="px-3 py-2 rounded-xl border border-pink-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-800">
                        <option>分类：全部</option>
                        <option>热门</option>
                        <option>加密</option>
                        <option>体育</option>
                        <option>政治</option>
                      </select>
                      <input className="col-span-2 px-3 py-2 rounded-xl border border-pink-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 text-gray-800" placeholder="搜索标题/正文关键字" />
                    </div>
                  </div>
                  <div className="mb-2">
                    <h2 className="text-lg font-bold">最近已采纳</h2>
                    <div className="mt-2 space-y-2">
                      {hotProposals.slice(0, 3).map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-purple-200/60 bg-white/70">
                          <span className="text-sm text-gray-800 truncate max-w-[12rem]">{p.title}</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">已采纳</span>
                        </div>
                      ))}
                      {hotProposals.length === 0 && (
                        <div className="text-sm text-gray-600">暂无记录</div>
                      )}
                    </div>
                  </div>
                </aside>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
