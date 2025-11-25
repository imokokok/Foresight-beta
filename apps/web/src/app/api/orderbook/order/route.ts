import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const client = getClient()
    if (!client) return NextResponse.json({ success: false, message: 'Supabase not configured' }, { status: 500 })
    const url = new URL(req.url)
    const idStr = url.searchParams.get('id') || ''
    const id = Number(idStr)
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, message: 'invalid id' }, { status: 400 })
    const { data, error } = await client
      .from('orders')
      .select('id, verifying_contract, chain_id, maker_address, maker_salt, outcome_index, is_buy, price, amount, remaining, expiry, signature, status, created_at')
      .eq('id', id)
      .limit(1)
      .maybeSingle()
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || String(e) }, { status: 500 })
  }
}