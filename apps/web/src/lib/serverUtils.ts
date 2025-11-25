import { NextRequest } from 'next/server'

export type OtpRecord = {
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

export type LogItem = {
  email: string
  address: string
  status: 'queued' | 'sent' | 'error' | 'verified'
  messageId?: string
  error?: string
  sentAt: number
}

export function normalizeAddress(addr: string) {
  const a = String(addr || '')
  return a.startsWith('0x') ? a.toLowerCase() : a
}

export function getSessionAddress(req: NextRequest) {
  const raw = req.cookies.get('fs_session')?.value || ''
  try {
    const obj = JSON.parse(raw)
    return normalizeAddress(String(obj?.address || ''))
  } catch {
    return ''
  }
}

export function getEmailOtpShared() {
  const g = globalThis as any
  if (!g.__emailOtpStore) g.__emailOtpStore = new Map<string, OtpRecord>()
  if (!g.__emailOtpLogs) g.__emailOtpLogs = [] as LogItem[]
  return { store: g.__emailOtpStore as Map<string, OtpRecord>, logs: g.__emailOtpLogs as LogItem[] }
}

export function isAdminAddress(addr: string) {
  const raw = (process.env.ADMIN_ADDRESSES || '').toLowerCase()
  const list = raw.split(',').map(s => s.trim()).filter(Boolean)
  const a = normalizeAddress(String(addr || '').toLowerCase())
  return list.includes(a)
}
