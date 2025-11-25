import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnvLocal() {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '../../.env.local'),
    path.resolve(process.cwd(), '../../../.env.local')
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8')
        for (const rawLine of content.split(/\r?\n/)) {
          const line = rawLine.trim()
          if (!line || line.startsWith('#')) continue
          const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
          if (!m) continue
          const key = m[1]
          let val = m[2]
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
            val = val.slice(1, -1)
          }
          if (!process.env[key]) process.env[key] = val
        }
        break
      }
    } catch {}
  }
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !anon) {
    console.error('缺少 Supabase 环境变量: NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }
  const supabase = createClient(url, anon)
  const ping = await supabase.from('event_follows').select('*').limit(1)
  if (ping.error) {
    console.error('连接失败或RLS限制:', ping.error.message)
    process.exit(2)
  }
  console.log('Supabase连接正常，返回行数:', (ping.data || []).length)
}

main().catch((e) => { console.error(e); process.exit(3) })
