import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    if (!supabase) {
      return NextResponse.json({ message: 'Supabase 未配置' }, { status: 500 })
    }
    const { error } = await (supabase as any).auth.signOut()
    if (error) {
      return NextResponse.json({ message: '登出失败', detail: error.message }, { status: 400 })
    }
    return NextResponse.json({ message: 'ok' })
  } catch (e: any) {
    return NextResponse.json({ message: '登出失败', detail: String(e?.message || e) }, { status: 500 })
  }
}

