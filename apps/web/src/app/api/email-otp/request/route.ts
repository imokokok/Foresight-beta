import { NextRequest, NextResponse } from 'next/server'

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

type LogItem = { email: string; address: string; status: 'queued'|'sent'|'error'; messageId?: string; error?: string; sentAt: number }

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

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email)
}

function genCode() { return String(Math.floor(100000 + Math.random() * 900000)) }

async function sendMailSMTP(email: string, code: string) {
  const host = process.env.SMTP_HOST || ''
  const port = Number(process.env.SMTP_PORT || 0)
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const from = process.env.SMTP_FROM || 'noreply@localhost'
  if (!host || !port || !user || !pass) throw new Error('SMTP 未配置完整')
  const nodemailer = await import('nodemailer')
  const transporter = (nodemailer as any).createTransport({ host, port, secure, auth: { user, pass } })
  const subject = '您的验证码'
  const html = `<div style="font-family:system-ui,Segoe UI,Arial">验证码：<b>${code}</b>（15分钟内有效）。如非本人操作请忽略。</div>`
  const text = `验证码：${code}（15分钟内有效）。如非本人操作请忽略。`
  const info = await transporter.sendMail({ from, to: email, subject, text, html })
  return String((info as any)?.messageId || '')
}

export async function POST(req: NextRequest) {
  try {
    const { store, logs } = getShared()
    const bodyText = await req.text()
    let payload: any = {}
    try { payload = JSON.parse(bodyText) } catch {}

    const email = String(payload?.email || '').trim().toLowerCase()
    const walletAddress = normalizeAddress(String(payload?.walletAddress || ''))

    const sessAddr = getSessionAddress(req)
    if (!sessAddr || sessAddr !== walletAddress) {
      return NextResponse.json({ success: false, message: '未认证或会话地址不匹配' }, { status: 401 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, message: '邮箱格式不正确' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    const now = Date.now()
    const rec = store.get(email) || {
      email, address: walletAddress, code: '', expiresAt: 0,
      sentAtList: [], failCount: 0, lockUntil: 0, createdIp: ip || '', createdAt: now,
    } as OtpRecord

    if (rec.lockUntil && now < rec.lockUntil) {
      const waitMin = Math.ceil((rec.lockUntil - now) / 60000)
      return NextResponse.json({ success: false, message: `该邮箱已被锁定，请 ${waitMin} 分钟后重试` }, { status: 429 })
    }

    rec.sentAtList = (rec.sentAtList || [])

    const code = genCode()
    rec.code = code
    rec.expiresAt = now + 15 * 60_000 // 15 分钟有效期
    rec.sentAtList.push(now)
    rec.address = walletAddress
    rec.createdIp = ip || rec.createdIp
    store.set(email, rec)

    logs.push({ email, address: walletAddress, status: 'queued', sentAt: now })
    try {
      const messageId = await sendMailSMTP(email, code)
      logs.push({ email, address: walletAddress, status: 'sent', messageId, sentAt: Date.now() })
      return NextResponse.json({ success: true, message: '验证码已发送', expiresInSec: 300 })
    } catch (err: any) {
      try {
        const host = process.env.SMTP_HOST || ''
        const port = Number(process.env.SMTP_PORT || 0)
        const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
        const user = process.env.SMTP_USER || ''
        const maskedUser = user ? (user.replace(/(^.).*(?=@)/, '$1***')) : ''
        console.error('[email-otp] SMTP send error', {
          email,
          address: walletAddress,
          host,
          port,
          secure,
          user: maskedUser,
          error: String(err?.message || err)
        })
      } catch {}
      logs.push({ email, address: walletAddress, status: 'error', error: String(err?.message || err), sentAt: Date.now() })
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ success: true, message: '开发环境：邮件发送失败，已直接返回验证码', codePreview: code, expiresInSec: 300 })
      }
      return NextResponse.json({ success: false, message: '邮件发送失败' }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, message: String(e?.message || e) }, { status: 500 })
  }
}