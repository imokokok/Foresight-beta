export type Address = string

export function normalizeAddress(addr?: string): Address | null {
  const s = String(addr || '').trim()
  if (!s) return null
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return s.toLowerCase()
  return null
}

export type RelayerConfig = {
  url: string
}