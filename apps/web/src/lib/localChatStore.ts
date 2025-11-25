import { getClient } from '@/lib/supabase'

export interface ChatMessage {
  id: string
  event_id: number
  user_id: string
  content: string
  created_at: string
}

export async function addMessage(userId: string, eventId: number, content: string): Promise<ChatMessage> {
  const client = getClient()
  const text = String(content || '').slice(0, 2000)
  const { data, error } = await client
    .from('discussions')
    .insert({ proposal_id: eventId, user_id: userId || 'guest', content: text })
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = data as any
  return {
    id: String(row?.id ?? ''),
    event_id: Number(row?.proposal_id ?? eventId),
    user_id: String(row?.user_id ?? (userId || 'guest')),
    content: String(row?.content ?? text),
    created_at: String(row?.created_at ?? new Date().toISOString())
  }
}

export async function getMessagesByEvent(eventId: number, limit = 50, since?: string): Promise<ChatMessage[]> {
  const client = getClient()
  let q = client
    .from('discussions')
    .select('*')
    .eq('proposal_id', eventId)
    .order('created_at', { ascending: true })
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const list = (Array.isArray(data) ? data : []).map((row: any) => ({
    id: String(row?.id ?? ''),
    event_id: Number(row?.proposal_id ?? eventId),
    user_id: String(row?.user_id ?? ''),
    content: String(row?.content ?? ''),
    created_at: String(row?.created_at ?? '')
  }))
  const filtered = since ? list.filter(r => new Date(r.created_at).getTime() > new Date(since).getTime()) : list
  return limit && limit > 0 ? filtered.slice(Math.max(0, filtered.length - limit)) : filtered
}