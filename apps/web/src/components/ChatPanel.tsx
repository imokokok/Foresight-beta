"use client";
import React, { useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useWallet } from '@/contexts/WalletContext'
import { MessageSquare, Sparkles, Loader2, Smile, Pin } from 'lucide-react'
import ForumSection from '@/components/ForumSection'

interface ChatPanelProps {
  eventId: number
  roomTitle?: string
  roomCategory?: string
  isProposalRoom?: boolean
  minHeightPx?: number
}

interface ChatMessageView {
  id: string
  user_id: string
  content: string
  created_at: string
}

export default function ChatPanel({ eventId, roomTitle, roomCategory, isProposalRoom, minHeightPx }: ChatPanelProps) {
const { account, connectWallet, formatAddress, siweLogin, requestWalletPermissions, multisigSign } = useWallet()
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [forumThreads, setForumThreads] = useState<any[]>([])
  const [forumMessages, setForumMessages] = useState<ChatMessageView[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [showEmojis, setShowEmojis] = useState(false)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})

  const displayName = (addr: string) => {
    const key = String(addr || '').toLowerCase()
    return nameMap[key] || formatAddress(addr)
  }

  const quickPrompts = [
    '这条预测的依据是什么？',
    '有没有最新进展？',
    '我认为概率更高的理由是…'
  ]

  useEffect(() => {
    let unsub: any
    const load = async () => {
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from('discussions')
            .select('*')
            .eq('proposal_id', eventId)
            .order('created_at', { ascending: true })
          if (!error) {
            const list = Array.isArray(data) ? data : []
            setMessages(list.map((r: any) => ({ id: String(r.id), user_id: String(r.user_id), content: String(r.content), created_at: String(r.created_at) })))
            return
          }
        }
        const res = await fetch(`/api/discussions?proposalId=${eventId}`)
        const data = await res.json()
        const list = Array.isArray(data?.discussions) ? data.discussions : []
        setMessages(list.map((r: any) => ({ id: String(r.id), user_id: String(r.user_id), content: String(r.content), created_at: String(r.created_at) })))
      } catch {}
    }
    load()
    if (supabase) {
      const ch = supabase.channel(`discussions:${eventId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussions', filter: `proposal_id=eq.${eventId}` }, (payload) => {
          const r: any = payload.new
          const m = { id: String(r.id), user_id: String(r.user_id), content: String(r.content), created_at: String(r.created_at) }
          setMessages(prev => {
            const merged = [...prev]
            if (!merged.find(x => x.id === m.id)) merged.push(m)
            merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            return merged
          })
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'discussions', filter: `proposal_id=eq.${eventId}` }, (payload) => {
          const r: any = payload.new
          const m = { id: String(r.id), user_id: String(r.user_id), content: String(r.content), created_at: String(r.created_at) }
          setMessages(prev => prev.map(x => x.id === m.id ? m : x))
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'discussions', filter: `proposal_id=eq.${eventId}` }, (payload) => {
          const r: any = payload.old
          setMessages(prev => prev.filter(x => x.id !== String(r.id)))
        })
        .subscribe()
      unsub = () => { try { supabase?.removeChannel(ch) } catch {} }
    }
    return () => { if (typeof unsub === 'function') unsub() }
  }, [eventId])

  useEffect(() => {
    const loadForum = async () => {
      try {
        const res = await fetch(`/api/forum?eventId=${eventId}`)
        const data = await res.json()
        const threads = Array.isArray(data?.threads) ? data.threads : []
        setForumThreads(threads)
        const fm: ChatMessageView[] = []
        threads.forEach((t: any) => {
          fm.push({ id: `thread:${t.id}`, user_id: String(t.user_id || ''), content: `${String(t.title || '')}\n${String(t.content || '')}`.trim(), created_at: String(t.created_at || '') })
          ;(Array.isArray(t.comments) ? t.comments : []).forEach((c: any) => {
            fm.push({ id: `comment:${c.id}`, user_id: String(c.user_id || ''), content: String(c.content || ''), created_at: String(c.created_at || '') })
          })
        })
        fm.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        setForumMessages(fm)
      } catch {}
    }
    loadForum()
  }, [eventId])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  useEffect(() => {
    try {
      const addrs = new Set<string>()
      messages.forEach(m => { if (m.user_id) addrs.add(String(m.user_id).toLowerCase()) })
      forumMessages.forEach(m => { if (m.user_id) addrs.add(String(m.user_id).toLowerCase()) })
      if (account) addrs.add(String(account).toLowerCase())
      const unknown = Array.from(addrs).filter(a => !nameMap[a])
      if (unknown.length === 0) return
      fetch(`/api/user-profiles?addresses=${encodeURIComponent(unknown.join(','))}`)
        .then(r => r.json())
        .then(data => {
          const arr = Array.isArray(data?.profiles) ? data.profiles : []
          const next: Record<string, string> = {}
          arr.forEach((p: any) => { if (p?.wallet_address && p?.username) next[String(p.wallet_address).toLowerCase()] = String(p.username) })
          if (Object.keys(next).length > 0) setNameMap(prev => ({ ...prev, ...next }))
        }).catch(() => {})
    } catch {}
  }, [messages, forumMessages, account])

  const mergedMessages = React.useMemo(() => {
    const all = [...messages, ...forumMessages]
    const byId: Record<string, ChatMessageView> = {}
    all.forEach(m => { byId[m.id] = m })
    const arr = Object.values(byId)
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return arr
  }, [messages, forumMessages])

  const roomLabel = React.useMemo(() => {
    const t = String(roomTitle || '').trim()
    if (!t) return '聊天室'
    return `聊天室 · ${t}`
  }, [roomTitle])

  const sendMessage = async () => {
    if (!input.trim()) return
    if (!account) {
      setError('请先连接钱包后再发送消息')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: eventId, content: input, userId: account })
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t)
      }
      setInput('')
    } catch (e: any) {
      setError(e?.message || '发送失败')
    } finally {
      setSending(false)
    }
  }

  const catCls = (cat?: string) => {
    const c = String(cat || '').toLowerCase()
    if (c.includes('科技')) return 'bg-sky-100 text-sky-700'
    if (c.includes('体育')) return 'bg-emerald-100 text-emerald-700'
    if (c.includes('娱乐')) return 'bg-pink-100 text-pink-700'
    if (c.includes('时政') || c.includes('政治')) return 'bg-violet-100 text-violet-700'
    if (c.includes('天气')) return 'bg-amber-100 text-amber-700'
    if (c.includes('加密') || c.includes('crypto')) return 'bg-indigo-100 text-indigo-700'
    if (c.includes('生活')) return 'bg-rose-100 text-rose-700'
    return 'bg-gray-100 text-gray-700'
  }

  const containerCls = 'rounded-3xl border border-purple-200/50 bg-white/60 backdrop-blur-xl shadow-lg overflow-hidden flex flex-col'
  const minH = String(minHeightPx && minHeightPx > 0 ? `${minHeightPx}px` : (isProposalRoom ? '60vh' : '75vh'))

  return (
    <div className={containerCls} style={{ minHeight: minH }}>
      <div className="px-4 py-3 panel-base panel-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-7 h-7 bg-white/20 rounded-xl">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="font-semibold flex items-center gap-2">
            <span>{roomLabel}</span>
          </div>
          <Sparkles className="w-4 h-4 opacity-90" />
        </div>
        <div className="text-xs opacity-90">
          {account ? `你：${displayName(account)}` : '未连接钱包'}
        </div>
      </div>

      <div className="px-4 py-2 bg-white/70 border-t border-b border-gray-100 flex items-center gap-2 text-xs text-gray-700">
        <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">公告</span>
        <div className="flex-1 truncate">
          {forumThreads.slice(0, 2).map(t => (
            <span key={t.id} className="mr-3">{String(t.title || '').slice(0, 40)}</span>
          ))}
          {forumThreads.length === 0 && <span>暂无公告</span>}
        </div>
      </div>

      {isProposalRoom ? (
        <div className="mx-4 mt-3 mb-4 rounded-3xl border-2 border-pink-400 bg-pink-50/80 shadow-sm">
          <div className="px-4 pb-4">
            <ForumSection eventId={eventId} />
          </div>
        </div>
      ) : null}

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-white/60">
        {mergedMessages.length === 0 && (
          <div className="text-center text-gray-500 text-sm">暂无消息，快来开启讨论吧！</div>
        )}
        {mergedMessages.map((m, i) => {
          const mine = !!account && !!m.user_id && String(account).toLowerCase() === String(m.user_id).toLowerCase()
          const prev = i > 0 ? mergedMessages[i - 1] : null
          const dateChanged = prev && new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
          return (
            <React.Fragment key={m.id}>
              {dateChanged && (
                <div className="flex justify-center">
                  <span className="text-xs text-gray-500 bg-white/80 border border-gray-200 rounded-full px-3 py-1">
                    {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className={`flex items-end gap-3 ${mine ? 'justify-end' : ''}`}>
                <div className={`${mine ? 'order-2' : ''} w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold`}> 
                  {displayName(m.user_id).slice(0,2)}
                </div>
                <div className={`${mine ? 'order-1' : ''} max-w-[80%]`}> 
                  <div className={`${mine 
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' 
                    : 'bg-white text-gray-800 border border-gray-200'} rounded-2xl px-3 py-2 shadow-sm`}> 
                    <div className="text-xs opacity-80 mb-1">
                      <span className="mr-2">{displayName(m.user_id)}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div className="leading-relaxed break-words">{m.content}</div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      <div className="p-3 border-t border-gray-100 bg-white relative">
        {!account ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">发送消息需连接钱包</div>
              <Button size="sm" variant="cta" onClick={async () => { await connectWallet(); await requestWalletPermissions(); await siweLogin(); await multisigSign(); }}>连接并签名</Button>
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
                  className="text-xs px-2 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"
                  rows={2}
                  className="w-full resize-none px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/80"
                />
                {/* 表情选择 */}
                <div className="absolute right-2 bottom-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                    onClick={() => setShowEmojis(v => !v)}
                    aria-label="选择表情"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> : <Smile className="w-4 h-4 text-purple-600" />}
                  </button>
                </div>
                {showEmojis && (
                  <div className="absolute right-0 bottom-12 z-10 bg-white border border-gray-200 rounded-xl shadow p-2 grid grid-cols-6 gap-1">
                    {['🙂','🔥','🚀','💡','🎯','👏','📈','🤔','✅','❗','✨','📌'].map((emo) => (
                      <button
                        key={emo}
                        className="text-base px-1 py-1 hover:bg-gray-100 rounded"
                        type="button"
                        onClick={() => setInput(prev => prev + emo)}
                      >{emo}</button>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={sendMessage} disabled={sending} size="sm" variant="primary">
                {sending ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />发送中…</span>
                ) : '发送'}
              </Button>
            </div>
          </>
        )}
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>
    </div>
  )
}
