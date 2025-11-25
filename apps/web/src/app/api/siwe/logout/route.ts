import { NextResponse } from 'next/server'

export async function GET() {
  // 清除会话与 nonce Cookie
  const res = NextResponse.json({ success: true })
  res.cookies.set('fs_session', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
  res.cookies.set('siwe_nonce', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 })
  return res
}

export async function POST() {
  return GET()
}