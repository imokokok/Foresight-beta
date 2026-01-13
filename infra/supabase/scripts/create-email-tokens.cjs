try {
  const path = require('path')
  const dotenv = require('dotenv')
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })
  dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true })
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true })
} catch {}

let Client
try {
  Client = require('pg').Client
} catch (e) {
  console.error('未找到 pg 依赖，请先运行: npm i pg')
  process.exit(1)
}

const connectionString =
  process.env.SUPABASE_DB_URL || process.env.SUPABASE_CONNECTION_STRING
if (!connectionString) {
  console.error('缺少数据库连接字符串：请在根 .env.local 或 infra/supabase/.env 中设置 SUPABASE_CONNECTION_STRING 或 SUPABASE_DB_URL')
  process.exit(1)
}

const statements = [
  `CREATE TABLE IF NOT EXISTS public.email_login_tokens (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    created_ip TEXT,
    created_ua TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_email_login_tokens_email ON public.email_login_tokens(email);`,
  `ALTER TABLE public.email_login_tokens ENABLE ROW LEVEL SECURITY;`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'email_login_tokens' AND policyname = 'Deny public access'
    ) THEN
      EXECUTE 'CREATE POLICY "Deny public access" ON public.email_login_tokens FOR ALL USING (false)';
    END IF;
  END $$;`
]

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i]
      console.log(`执行语句 ${i + 1}/${statements.length}...`)
      await client.query(sql)
    }
    console.log('email_login_tokens 表创建完成')
  } catch (err) {
    console.error('创建失败:', err?.message || err)
    process.exit(1)
  } finally {
    try { await client.end() } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(2) })
