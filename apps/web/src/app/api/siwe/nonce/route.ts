import { NextResponse } from 'next/server'
import { SiweMessage } from 'siwe'

export async function GET() {
  // 生成一次性 nonce（也可用 SiweMessage.generateNonce）
  const nonce = (SiweMessage as any).generateNonce ? (SiweMessage as any).generateNonce() : Math.random().toString(36).slice(2, 10)

  const res = NextResponse.json({ nonce })
  // 将 nonce 放入 HttpOnly Cookie，供校验使用
  res.cookies.set('siwe_nonce', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10 分钟有效
  })
  return res
}