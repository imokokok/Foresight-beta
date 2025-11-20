import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getClient } from '@/lib/supabase'

function toNum(v: any): number | null { const n = Number(v); return Number.isFinite(n) ? n : null }

// POST /api/forum/vote  body: { type: 'thread'|'comment', id: number, dir: 'up'|'down' }
function getSessionAddressFromCookie(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('fs_session')?.value || ''
    if (!raw) return null
    const obj = JSON.parse(raw)
    const addr = String(obj?.address || '').toLowerCase()
    return /^0x[a-fA-F0-9]{40}$/.test(addr) ? addr : null
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as any
    const type = body?.type === 'comment' ? 'comment' : 'thread'
    const dir = body?.dir === 'down' ? 'down' : 'up'
    const id = toNum(body?.id)
    if (!id) return NextResponse.json({ message: 'id 必填' }, { status: 400 })
    const userAddr = getSessionAddressFromCookie(req)
    if (!userAddr) return NextResponse.json({ message: '未登录或会话失效' }, { status: 401 })

    // 内容存在性与事件ID解析
    let eventId: number | null = null
    const client = getClient()
    if (type === 'thread') {
      const { data: t, error } = await client.from('forum_threads').select('event_id, upvotes, downvotes').eq('id', id).maybeSingle()
      if (error) return NextResponse.json({ message: '查询失败', detail: error.message }, { status: 500 })
      if (!t) return NextResponse.json({ message: '未找到对象' }, { status: 404 })
      eventId = Number((t as any).event_id)
    } else {
      const { data: c, error } = await client.from('forum_comments').select('event_id, upvotes, downvotes').eq('id', id).maybeSingle()
      if (error) return NextResponse.json({ message: '查询失败', detail: error.message }, { status: 500 })
      if (!c) return NextResponse.json({ message: '未找到对象' }, { status: 404 })
      eventId = Number((c as any).event_id)
    }
    if (!Number.isFinite(eventId)) return NextResponse.json({ message: '事件不存在或无效' }, { status: 400 })

    if (!supabaseAdmin) {
      return NextResponse.json({ message: '服务端未配置 SUPABASE_SERVICE_KEY' }, { status: 500 })
    }

    // 重复投票检查
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('forum_votes')
      .select('id')
      .eq('user_id', userAddr)
      .eq('content_type', type)
      .eq('content_id', id)
      .maybeSingle()
    if (existErr) {
      return NextResponse.json({ message: '检查投票状态失败', detail: existErr.message }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json({ message: '您已经投过票了' }, { status: 409 })
    }

    // 写入投票记录（唯一约束防止并发重复）
    const { error: insErr } = await supabaseAdmin
      .from('forum_votes')
      .insert({ user_id: userAddr, event_id: eventId, content_id: id, content_type: type, vote_type: dir })
    if (insErr) {
      const msg = (insErr.message || '').toLowerCase()
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return NextResponse.json({ message: '您已经投过票了' }, { status: 409 })
      }
      return NextResponse.json({ message: '投票记录写入失败', detail: insErr.message }, { status: 500 })
    }

    // 更新本地计数用于 UI
    // 更新计数（简化处理，读取后 +1 写回）
    const admin = supabaseAdmin || client
    if (type === 'thread') {
      const { data: cur } = await admin.from('forum_threads').select('upvotes, downvotes').eq('id', id).maybeSingle()
      const up = Number((cur as any)?.upvotes || 0) + (dir === 'up' ? 1 : 0)
      const down = Number((cur as any)?.downvotes || 0) + (dir === 'down' ? 1 : 0)
      const { data: updated, error: uerr } = await admin.from('forum_threads').update({ upvotes: up, downvotes: down }).eq('id', id).select().maybeSingle()
      if (uerr) return NextResponse.json({ message: '更新失败', detail: uerr.message }, { status: 500 })
      return NextResponse.json({ message: 'ok', data: updated, voted: { type, id, dir } })
    } else {
      const { data: cur } = await admin.from('forum_comments').select('upvotes, downvotes').eq('id', id).maybeSingle()
      const up = Number((cur as any)?.upvotes || 0) + (dir === 'up' ? 1 : 0)
      const down = Number((cur as any)?.downvotes || 0) + (dir === 'down' ? 1 : 0)
      const { data: updated, error: uerr } = await admin.from('forum_comments').update({ upvotes: up, downvotes: down }).eq('id', id).select().maybeSingle()
      if (uerr) return NextResponse.json({ message: '更新失败', detail: uerr.message }, { status: 500 })
      return NextResponse.json({ message: 'ok', data: updated, voted: { type, id, dir } })
    }
  } catch (e: any) {
    return NextResponse.json({ message: '投票失败', detail: String(e?.message || e) }, { status: 500 })
  }
}