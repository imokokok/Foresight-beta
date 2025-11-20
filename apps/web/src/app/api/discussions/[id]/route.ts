import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getClient } from '@/lib/supabase'

function toNum(v: any): number | null { const n = Number(v); return Number.isFinite(n) ? n : null }

async function parseBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get('content-type') || ''
  try {
    if (ct.includes('application/json')) { const t = await req.text(); try { return JSON.parse(t) } catch { return {} } }
    if (ct.includes('application/x-www-form-urlencoded')) { const t = await req.text(); const p = new URLSearchParams(t); return Object.fromEntries(p.entries()) }
    const t = await req.text(); if (t) { try { return JSON.parse(t) } catch { return {} } }
    return {}
  } catch { return {} }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: pid } = await context.params
    const id = toNum(pid)
    if (!id) return NextResponse.json({ message: 'id 必填' }, { status: 400 })
    const body = await parseBody(req)
    const content = String(body?.content || '')
    if (!content.trim()) return NextResponse.json({ message: 'content 必填' }, { status: 400 })
    const client = supabaseAdmin || getClient()
    const { data, error } = await client
      .from('discussions')
      .update({ content })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ message: '更新失败', detail: error.message }, { status: 500 })
    return NextResponse.json({ discussion: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '请求失败', detail: String(e?.message || e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: pid } = await context.params
    const id = toNum(pid)
    if (!id) return NextResponse.json({ message: 'id 必填' }, { status: 400 })
    const client = supabaseAdmin || getClient()
    const { error } = await client
      .from('discussions')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ message: '删除失败', detail: error.message }, { status: 500 })
    return NextResponse.json({ message: '已删除' }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '请求失败', detail: String(e?.message || e) }, { status: 500 })
  }
}