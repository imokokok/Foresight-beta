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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const proposalId = toNum(searchParams.get('proposalId'))
    if (!proposalId) return NextResponse.json({ message: 'proposalId 必填' }, { status: 400 })
    const client = getClient()
    if (!client) return NextResponse.json({ message: 'Supabase 未配置' }, { status: 500 })
    const { data, error } = await client
      .from('discussions')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true })
    if (error) {
      try { console.error('[discussions:get]', error?.message || error) } catch {}
      return NextResponse.json({ message: '查询失败', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ discussions: data || [] }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '请求失败', detail: String(e?.message || e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req)
    const proposalId = toNum(body?.proposalId)
    const content = String(body?.content || '')
    const userId = String(body?.userId || '')
    if (!proposalId || !content.trim() || !userId.trim()) {
      return NextResponse.json({ message: 'proposalId、content、userId 必填' }, { status: 400 })
    }
    const client = supabaseAdmin || getClient()
    if (!client) return NextResponse.json({ message: 'Supabase 未配置' }, { status: 500 })
    const { data, error } = await client
      .from('discussions')
      .insert({ proposal_id: proposalId, user_id: userId, content })
      .select()
      .maybeSingle()
    if (error) {
      try { console.error('[discussions:post]', error?.message || error) } catch {}
      return NextResponse.json({ message: '创建失败', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ discussion: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '请求失败', detail: String(e?.message || e) }, { status: 500 })
  }
}