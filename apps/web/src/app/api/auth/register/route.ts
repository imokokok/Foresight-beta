import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any
    const email = String(body?.email || '').trim()
    const password = String(body?.password || '')

    if (!validateEmail(email) || password.length < 6) {
      return NextResponse.json({ message: '参数无效：邮箱或密码不符合要求' }, { status: 400 })
    }
    if (!supabase) {
      return NextResponse.json({ message: 'Supabase 未配置' }, { status: 500 })
    }

    const { data, error } = await (supabase as any).auth.signUp({ email, password })
    if (error) {
      return NextResponse.json({ message: '注册失败', detail: error.message }, { status: 400 })
    }
    return NextResponse.json({ message: 'ok', data })
  } catch (e: any) {
    return NextResponse.json({ message: '注册失败', detail: String(e?.message || e) }, { status: 500 })
  }
}

