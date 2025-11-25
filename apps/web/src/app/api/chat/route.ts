import { NextResponse } from 'next/server'
import { addMessage, getMessagesByEvent } from '@/lib/localChatStore'

function toNum(v: any): number | null { const n = Number(v); return Number.isFinite(n) ? n : null }

async function parseBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get('content-type') || ''
  try {
    if (ct.includes('application/json')) {
      const txt = await req.text(); try { return JSON.parse(txt) } catch { return {} }
    }
    if (ct.includes('application/x-www-form-urlencoded')) {
      const txt = await req.text(); const params = new URLSearchParams(txt); return Object.fromEntries(params.entries())
    }
    if (ct.includes('multipart/form-data')) {
      const form = await (req as any).formData?.();
      if (form && typeof (form as any).entries === 'function') {
        const obj: Record<string, any> = {}
        for (const [k, v] of (form as any).entries()) obj[k] = v as any
        return obj
      }
      return {}
    }
    const txt = await req.text(); if (txt) { try { return JSON.parse(txt) } catch { return {} } }
    return {}
  } catch { return {} }
}

// GET /api/chat?eventId=1&limit=50
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const eventId = toNum(searchParams.get('eventId'))
  const limit = toNum(searchParams.get('limit')) ?? 50
  const since = searchParams.get('since') || undefined
  if (!eventId) return NextResponse.json({ message: 'eventId 必填' }, { status: 400 })
  const list = await getMessagesByEvent(eventId, limit, since)
  return NextResponse.json({ messages: list }, { status: 200 })
}

// POST /api/chat  body: { eventId, content, walletAddress }
export async function POST(req: Request) {
  try {
    const body = await parseBody(req)
    const eventId = toNum(body?.eventId)
    const content = String(body?.content || '')
    const walletAddress = String(body?.walletAddress || '')
    if (!eventId || !content.trim()) {
      return NextResponse.json({ message: 'eventId 与 content 必填' }, { status: 400 })
    }
    const msg = await addMessage(walletAddress || 'guest', eventId, content)
    return NextResponse.json({ message: 'ok', data: msg }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '发送失败', detail: String(e?.message || e) }, { status: 500 })
  }
}