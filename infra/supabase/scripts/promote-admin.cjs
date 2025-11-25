try {
  const path = require('path')
  const fs = require('fs')
  const dotenv = require('dotenv')
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') })
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env.local') })
} catch {}

const { Client } = require('pg')

function normalizeAddress(addr) {
  const a = String(addr || '')
  return a.startsWith('0x') ? a.toLowerCase() : a
}

async function main() {
  const rawAddr = process.argv[2] || ''
  if (!rawAddr) {
    console.error('缺少地址参数')
    process.exit(1)
  }
  const addr = normalizeAddress(rawAddr)

  const conn = process.env.SUPABASE_CONNECTION_STRING || process.env.SUPABASE_DB_URL
  if (!conn) {
    console.error('缺少连接字符串: 设置 SUPABASE_CONNECTION_STRING 或 SUPABASE_DB_URL 于 .env.local')
    process.exit(2)
  }

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false')
    await client.query('CREATE INDEX IF NOT EXISTS user_profiles_wallet_idx ON public.user_profiles (wallet_address)')
    const upd = await client.query('UPDATE public.user_profiles SET is_admin = true WHERE lower(wallet_address) = $1', [addr])
    if (!upd.rowCount) {
      await client.query('INSERT INTO public.user_profiles (wallet_address, username, email, is_admin) VALUES ($1, $2, $3, true)', [addr, 'admin', 'admin@local'])
    }
    await client.query('COMMIT')
    console.log('✅ 已设置管理员:', addr)
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('❌ 设置管理员失败:', e?.message || e)
    process.exit(3)
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error('异常:', e?.message || e); process.exit(4) })
