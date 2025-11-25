// 修复 Supabase public.event_follows.user_id 字段类型为 TEXT
// 使用 pg 直连数据库执行 ALTER TABLE 语句
// 兼容在根目录 .env.local / .env 提供连接字符串
try {
  const path = require('path')
  const dotenv = require('dotenv')
  // 优先加载当前目录的 .env / .env.local
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  // 同时尝试加载项目根目录的 .env / .env.local
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') })
} catch {}

// 兼容 CJS 的导入方式
let Client
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Client = require('pg').Client
} catch (e) {
  console.error('未找到 pg 依赖，请先运行: npm i pg')
  process.exit(1)
}

// 读取环境变量中的 Supabase 连接字符串
// 支持 SUPABASE_DB_URL 与 SUPABASE_CONNECTION_STRING 两种变量名
let connectionString =
  process.env.SUPABASE_DB_URL || process.env.SUPABASE_CONNECTION_STRING

// 如果未配置环境变量，使用项目中已验证可用的连接字符串回退
if (!connectionString) {
  console.error(
    '缺少数据库连接字符串，请在根 .env.local 或 infra/supabase/.env 中设置 SUPABASE_CONNECTION_STRING 或 SUPABASE_DB_URL'
  )
  process.exit(1)
}

// 允许使用上述回退连接字符串

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

// 需要执行的 SQL 语句列表（幂等）
const statements = [
  // 如果存在旧的外键约束，先移除（有些环境可能没有该约束）
  'ALTER TABLE IF EXISTS public.event_follows DROP CONSTRAINT IF EXISTS event_follows_user_id_fkey;',
  // 将 user_id 列类型改为 TEXT（使用 USING 保留现有数据）
  'ALTER TABLE IF EXISTS public.event_follows ALTER COLUMN user_id TYPE TEXT USING user_id::text;',
  // 确保唯一性索引存在（避免重复创建导致错误）
  'DROP INDEX IF EXISTS public.event_follows_user_id_event_id_idx;',
  'CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);',
]

async function main() {
  try {
    await client.connect()
    console.log('已连接 Supabase Postgres')
    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i]
      process.stdout.write(`执行语句 ${i + 1}/${statements.length}: ${sql}\n`)
      try {
        await client.query(sql)
        console.log('  -> 成功')
      } catch (err) {
        console.error('  -> 失败:', err?.message || err)
        throw err
      }
    }

    // 验证结构：检查 user_id 列类型为 text 且唯一索引存在
    console.log('验证：检查列类型与唯一索引存在')
    const { rows: colRows } = await client.query(
      `SELECT data_type FROM information_schema.columns 
       WHERE table_schema='public' AND table_name='event_follows' AND column_name='user_id'`
    )
    const dtype = (colRows?.[0]?.data_type || '').toLowerCase()
    if (dtype !== 'text') {
      throw new Error(`验证失败：user_id 列类型为 ${dtype}，应为 text`)
    }
    const { rows: idxRows } = await client.query(
      `SELECT indexname FROM pg_indexes 
       WHERE schemaname='public' AND tablename='event_follows' AND indexname='event_follows_user_id_event_id_key'`
    )
    if (!idxRows?.length) {
      throw new Error('验证失败：缺少唯一索引 event_follows_user_id_event_id_key')
    }
    console.log('验证通过：user_id 为 TEXT 且唯一索引存在')

    console.log('所有操作完成')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('修复过程中发生错误:', err)
  process.exit(1)
})