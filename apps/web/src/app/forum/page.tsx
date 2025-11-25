"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const [events, setEvents] = useState<Array<{ id: number; title: string; category?: string; status?: string }>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [q, setQ] = useState<string>("");
  const leftAsideRef = useRef<HTMLDivElement | null>(null);
  const [leftAsideHeight, setLeftAsideHeight] = useState<number>(0);

  

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
  }, [events.length, q, selectedId]);

  const searchParams = useSearchParams();
  const activeEventId = selectedId ?? (events[0]?.id ?? 1);
  const activeTitle = events.find(e => e.id === activeEventId)?.title || '';
  const activeCategory = events.find(e => e.id === activeEventId)?.category || '';

  useEffect(() => {
    const idStr = searchParams?.get('id');
    const idNum = Number(idStr);
    if (Number.isFinite(idNum) && idNum > 0) {
      setSelectedId(idNum);
    }
  }, [searchParams, events.length]);

  const catEmoji = (cat?: string) => {
    const c = String(cat || '').toLowerCase();
    if (c.includes('娱乐')) return '🍿';
    if (c.includes('科技')) return '🚀';
    if (c.includes('体育')) return '⚽';
    if (c.includes('时政') || c.includes('政治')) return '🏛️';
    if (c.includes('天气')) return '☀️';
    if (c.includes('加密') || c.includes('crypto')) return '🪙';
    if (c.includes('生活')) return '🌸';
    return '📌';
  };
  const catPastelCls = (cat?: string) => {
    const c = String(cat || '').toLowerCase();
    if (c.includes('娱乐')) return 'bg-pink-100 text-pink-600';
    if (c.includes('科技')) return 'bg-sky-100 text-sky-700';
    if (c.includes('体育')) return 'bg-emerald-100 text-emerald-700';
    if (c.includes('时政') || c.includes('政治')) return 'bg-violet-100 text-violet-700';
    if (c.includes('天气')) return 'bg-amber-100 text-amber-700';
    if (c.includes('加密') || c.includes('crypto')) return 'bg-indigo-100 text-indigo-700';
    if (c.includes('生活')) return 'bg-rose-100 text-rose-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-cyan-50 overflow-hidden text-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-200/30 to-pink-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-xl"></div>
      </div>

      

      <div className="relative z-10 px-6 lg:px-10 py-6">
        <div className="px-4 py-3 rounded-3xl mb-6 bg-gradient-to-br from-pink-50/60 to-cyan-50/60 border border-pink-200/60">
          <div className="flex items-center justify-between">
            <div className="font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">社区频道</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <aside ref={leftAsideRef} className="rounded-3xl border border-purple-200/60 bg-white/80 backdrop-blur-sm shadow-sm p-4 lg:sticky lg:top-24 h-fit lg:col-span-1">
            <h2 className="text-lg font-bold mb-3">全部频道</h2>
            
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
                  className={`inline-flex items-center whitespace-nowrap text-xs px-2.5 py-1 rounded-full border ${q.trim() === cat ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-700'}`}
                >{cat}</button>
              ))}
              {events.length > 0 && (
                <button onClick={() => setQ('')} className={`inline-flex items-center whitespace-nowrap text-xs px-2.5 py-1 rounded-full border ${q ? 'border-gray-200 bg-white text-gray-700' : 'border-purple-400 bg-purple-50 text-purple-700'}`}>全部</button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 -mr-1">
              {events
                .filter((e) => {
                  const qq = q.trim().toLowerCase();
                  if (!qq) return true;
                  if (selectedId && e.id === selectedId) return false;
                  return e.title.toLowerCase().includes(qq) || String(e.category || "").toLowerCase().includes(qq);
                })
                .slice(0, 12)
                .map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => { setSelectedId(ev.id); }}
                    className={`group relative w-full text-left rounded-3xl p-[1px] transition-all duration-300 hover:scale-[1.02] ${selectedId === ev.id ? "bg-gradient-to-r from-purple-400 to-pink-400 shadow-lg shadow-purple-300/50" : "bg-gradient-to-r from-purple-200/20 to-pink-200/20"}`}
                  >
                    <div className={`${selectedId === ev.id ? "text-white ring-1 ring-white/30" : "bg-white/60 backdrop-blur-md text-gray-800 shadow-sm hover:shadow-md"} rounded-3xl px-4 py-3`}> 
                      <div className="flex items-center gap-3">
                        <span className={`${selectedId === ev.id ? "bg-white/20 text-white" : catPastelCls(ev.category)} inline-flex items-center whitespace-nowrap text-xs px-2.5 py-1 rounded-full`}> 
                          <span className="mr-1">{catEmoji(ev.category)}</span>{ev.category || '未分类'}
                        </span>
                        <div className={`${selectedId === ev.id ? "text-white" : "text-gray-800"} text-base font-medium line-clamp-2 flex-1`}>{ev.title}</div>
                      </div>
                      <span className={`${String(ev.status || '').toLowerCase().includes('active') ? (selectedId === ev.id ? 'bg-emerald-300' : 'bg-emerald-400') : (selectedId === ev.id ? 'bg-gray-300' : 'bg-gray-400')} absolute right-3 top-3 w-2 h-2 rounded-full animate-pulse`}></span>
                      <div className={`${selectedId === ev.id ? "text-white/80" : "text-gray-500"} text-xs mt-1`}>{ev.status ? ev.status : ''}</div>
                    </div>
                  </button>
                ))}
            </div>
          </aside>
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <main className="space-y-6 lg:col-span-3">
                <ChatPanel
                  eventId={activeEventId}
                  roomTitle={activeTitle}
                  roomCategory={activeCategory}
                  isProposalRoom={false}
                  minHeightPx={leftAsideHeight}
                />
              </main>
          </div>
        </div>
      </div>
    </div>
  );
}
