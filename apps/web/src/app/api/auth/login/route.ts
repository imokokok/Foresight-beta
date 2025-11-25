import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any
    const email = String(body?.email || '').trim()
    const password = String(body?.password || '')

    if (!email || !password) {
      return NextResponse.json({ message: '参数无效：缺少邮箱或密码' }, { status: 400 })
    }
    if (!supabase) {
      return NextResponse.json({ message: 'Supabase 未配置' }, { status: 500 })
    }

    const { data, error } = await (supabase as any).auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json({ message: '登录失败', detail: error.message }, { status: 401 })
    }
    // 返回会话安全字段（避免泄露敏感信息）
    return NextResponse.json({ message: 'ok', data: { session: { expires_at: data.session?.expires_at, user: data.session?.user } } })
  } catch (e: any) {
    return NextResponse.json({ message: '登录失败', detail: String(e?.message || e) }, { status: 500 })
  }
}

