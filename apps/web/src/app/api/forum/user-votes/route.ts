import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getSessionAddressFromCookie(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get('fs_session')?.value || ''
    if (!raw) return null
    const obj = JSON.parse(raw)
    const addr = String(obj?.address || '').toLowerCase()
    return /^0x[a-fA-F0-9]{40}$/.test(addr) ? addr : null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const address = getSessionAddressFromCookie(req)
    const { searchParams } = new URL(req.url)
    const eventId = Number(searchParams.get('eventId') || '0')
    if (!address) return NextResponse.json({ votes: [] }, { status: 200 })
    if (!Number.isFinite(eventId) || eventId <= 0) return NextResponse.json({ votes: [] }, { status: 200 })
    if (!supabaseAdmin) return NextResponse.json({ votes: [] }, { status: 200 })

    const { data, error } = await supabaseAdmin
      .from('forum_votes')
      .select('content_type, content_id, vote_type')
      .eq('user_id', address)
      .eq('event_id', eventId)

    if (error) return NextResponse.json({ votes: [] }, { status: 200 })
    return NextResponse.json({ votes: data || [] }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ votes: [] }, { status: 200 })
  }
}