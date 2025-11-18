import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type OtpRecord = {
  email: string
  address: string
  code: string
  expiresAt: number
  sentAtList: number[]
  failCount: number
  lockUntil: number
  createdIp: string
  createdAt: number
}

type LogItem = { email: string; address: string; status: 'queued'|'sent'|'error'|'verified'; messageId?: string; error?: string; sentAt: number }

function getShared() {
  const g = globalThis as any
  if (!g.__emailOtpStore) g.__emailOtpStore = new Map<string, OtpRecord>()
  if (!g.__emailOtpLogs) g.__emailOtpLogs = [] as LogItem[]
  return { store: g.__emailOtpStore as Map<string, OtpRecord>, logs: g.__emailOtpLogs as LogItem[] }
}

function normalizeAddress(addr: string) {
  const a = String(addr || '')
  return a.startsWith('0x') ? a.toLowerCase() : a
}

function getSessionAddress(req: NextRequest) {
  const raw = req.cookies.get('fs_session')?.value || ''
  try { const obj = JSON.parse(raw); return normalizeAddress(String(obj?.address || '')) } catch { return '' }
}

export async function POST(req: NextRequest) {
  try {
    const { store, logs } = getShared()
    const bodyText = await req.text()
    let payload: any = {}
    try { payload = JSON.parse(bodyText) } catch {}

    const email = String(payload?.email || '').trim().toLowerCase()
    const code = String(payload?.code || '').trim()
    const walletAddress = normalizeAddress(String(payload?.walletAddress || ''))

    const sessAddr = getSessionAddress(req)
    if (!sessAddr || sessAddr !== walletAddress) {
      return NextResponse.json({ success: false, message: '未认证或会话地址不匹配' }, { status: 401 })
    }

    const rec = store.get(email)
    const now = Date.now()
    if (!rec) {
      return NextResponse.json({ success: false, message: '验证码未发送或已失效' }, { status: 400 })
    }
    if (rec.lockUntil && now < rec.lockUntil) {
      const waitMin = Math.ceil((rec.lockUntil - now) / 60000)
      return NextResponse.json({ success: false, message: `该邮箱已被锁定，请 ${waitMin} 分钟后重试` }, { status: 429 })
    }
    if (now > rec.expiresAt) {
      return NextResponse.json({ success: false, message: '验证码已过期' }, { status: 400 })
    }
    if (code !== rec.code) {
      rec.failCount = (rec.failCount || 0) + 1
      if (rec.failCount >= 3) {
        rec.lockUntil = now + 60 * 60_000
      }
      store.set(email, rec)
      const remain = Math.max(0, 3 - rec.failCount)
      return NextResponse.json({ success: false, message: remain > 0 ? `验证码不正确，剩余 ${remain} 次尝试` : '连续失败次数过多，已锁定 1 小时' }, { status: 400 })
    }

    // 通过验证：绑定邮箱到钱包地址
    const client = supabaseAdmin
    if (client) {
      const { data: existing } = await client
        .from('user_profiles')
        .select('wallet_address, email')
        .eq('wallet_address', walletAddress)
        .maybeSingle()
      if (!existing) {
        await client
          .from('user_profiles')
          .insert({ wallet_address: walletAddress, email })
      } else {
        await client
          .from('user_profiles')
          .update({ email })
          .eq('wallet_address', walletAddress)
      }
    }

    // 审计记录（内存）：时间戳与 IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    console.log(`[email-otp] verified email=${email} addr=${walletAddress} ip=${ip} at=${new Date().toISOString()}`)
    try { logs.push({ email, address: walletAddress, status: 'verified', sentAt: Date.now() }) } catch {}

    // 清理使用过的记录
    store.delete(email)

    return NextResponse.json({ success: true, message: '验证成功' })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: String(e?.message || e) }, { status: 500 })
  }
}