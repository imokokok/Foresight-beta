import { NextResponse } from 'next/server'
import { getClient, supabaseAdmin } from '@/lib/supabase'
import { parseRequestBody } from '@/lib/serverUtils'

function toNum(v: unknown): number | null { const n = Number(v); return Number.isFinite(n) ? n : null }

// POST /api/forum/comments  body: { eventId, threadId, content, walletAddress, parentId? }
export async function POST(req: Request) {
  try {
    const body = await parseRequestBody(req)
    const eventId = toNum(body?.eventId)
    const threadId = toNum(body?.threadId)
    const parentId = body?.parentId == null ? null : toNum(body?.parentId)
    const content = String(body?.content || '')
    const walletAddress = String(body?.walletAddress || '')
    if (!eventId || !threadId || !content.trim()) {
      return NextResponse.json({ message: 'eventId、threadId、content 必填' }, { status: 400 })
    }
    const client = (supabaseAdmin || getClient()) as any
    const { data, error } = await client
      .from('forum_comments')
      .insert({ event_id: eventId, thread_id: threadId, content, user_id: walletAddress || 'guest', parent_id: parentId })
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ message: '创建失败', detail: error.message }, { status: 500 })
    return NextResponse.json({ message: 'ok', data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '创建失败', detail: String(e?.message || e) }, { status: 500 })
  }
}
