import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const client = getClient()
    if (!client) return NextResponse.json({ success: false, message: 'Supabase not configured' }, { status: 500 })
    const url = new URL(req.url)
    const idStr = url.searchParams.get('id') || ''
    const chainStr = url.searchParams.get('chainId') || ''
    const eventId = Number(idStr)
    const chainId = chainStr ? Number(chainStr) : undefined
    if (!Number.isFinite(eventId)) return NextResponse.json({ success: false, message: 'invalid id' }, { status: 400 })
    let q = client.from('markets_map').select('*').eq('event_id', eventId)
    if (chainId && Number.isFinite(chainId)) q = q.eq('chain_id', chainId)
    const { data, error } = await q.limit(1).maybeSingle()
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = getClient()
    if (!client) return NextResponse.json({ success: false, message: 'Supabase not configured' }, { status: 500 })
    const body = await req.json().catch(()=>({})) as any
    const payload = {
      event_id: Number(body.event_id),
      chain_id: Number(body.chain_id),
      market: String(body.market || ''),
      collateral_token: String(body.collateral_token || ''),
      tick_size: body.tick_size == null ? null : Number(body.tick_size),
      resolution_time: body.resolution_time || null,
      status: String(body.status || 'open')
    }
    if (!Number.isFinite(payload.event_id) || !Number.isFinite(payload.chain_id) || !payload.market) {
      return NextResponse.json({ success: false, message: 'invalid payload' }, { status: 400 })
    }
    const { data, error } = await client
      .from('markets_map')
      .upsert(payload as any, { onConflict: 'event_id,chain_id' })
      .select()
      .maybeSingle()
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || String(e) }, { status: 500 })
  }
}
