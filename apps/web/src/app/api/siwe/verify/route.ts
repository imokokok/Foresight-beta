import { NextRequest, NextResponse } from 'next/server'
import { SiweMessage } from 'siwe'

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text()
    let payload: any = {}
    try { payload = JSON.parse(bodyText) } catch {}

    const messageStr: string = payload?.message || ''
    const signature: string = payload?.signature || ''
    if (!messageStr || !signature) {
      return NextResponse.json({ success: false, message: '缺少 message 或 signature' }, { status: 400 })
    }

    const cookieNonce = req.cookies.get('siwe_nonce')?.value || ''
    const msg = new SiweMessage(messageStr)

    const domain = (payload?.domain || msg.domain || (typeof window === 'undefined' ? undefined : window.location.host)) as string | undefined
    const origin = (payload?.uri || msg.uri) as string | undefined
    const nonce = msg.nonce

    if (!cookieNonce || cookieNonce !== nonce) {
      return NextResponse.json({ success: false, message: 'nonce 不匹配或过期' }, { status: 401 })
    }

    const result = await msg.verify({ signature, domain, nonce })
    if (!result?.success) {
      return NextResponse.json({ success: false, message: '签名验证失败' }, { status: 401 })
    }

    const address = msg.address
    const res = NextResponse.json({ success: true, address })
    // 简单会话：写入地址到 cookie（生产建议使用 JWT 或服务端会话）
    res.cookies.set('fs_session', JSON.stringify({ address }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    // 清除一次性 nonce
    res.cookies.set('siwe_nonce', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
    return res
  } catch (e: any) {
    return NextResponse.json({ success: false, message: '服务器错误', detail: String(e?.message || e) }, { status: 500 })
  }
}