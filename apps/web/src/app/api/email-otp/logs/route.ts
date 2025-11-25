import { NextRequest, NextResponse } from 'next/server'
import { getEmailOtpShared, LogItem } from '@/lib/serverUtils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit') || 10)))
  const { logs: all } = getEmailOtpShared()
  const last = all.slice(-limit).reverse()
  return NextResponse.json({ logs: last })
}