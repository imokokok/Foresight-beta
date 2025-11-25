// 启用并放宽 event_follows RLS 策略（开发环境），可选地重建外键
// 使用 pg 直连数据库执行非破坏 ALTER 语句
require('dotenv/config')

let Client
try {
  Client = require('pg').Client
} catch (e) {
  console.error('未找到 pg 依赖，请先运行: npm i pg')
  process.exit(1)
}

// 读取连接字符串：优先环境变量 SUPABASE_DB_URL
const connectionString =
  process.env.SUPABASE_DB_URL || process.env.SUPABASE_CONNECTION_STRING

if (!connectionString) {
  console.error('缺少数据库连接字符串 SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

// 非破坏修复：启用 RLS + 放宽策略；可选重建外键（若存在则重建，否则创建）
const statements = [
  `ALTER TABLE IF EXISTS public.event_follows ENABLE ROW LEVEL SECURITY;`,
  `DROP POLICY IF EXISTS "Allow all operations on event_follows" ON public.event_follows;`,
  `CREATE POLICY "Allow all operations on event_follows" ON public.event_follows FOR ALL USING (true) WITH CHECK (true);`,
  // 外键重建（如果 predictions 存在且类型一致，则成功；否则失败但不影响 RLS）
  `ALTER TABLE IF EXISTS public.event_follows DROP CONSTRAINT IF EXISTS fk_event_follows_prediction;`,
  `ALTER TABLE IF EXISTS public.event_follows ADD CONSTRAINT fk_event_follows_prediction FOREIGN KEY (event_id) REFERENCES public.predictions(id) ON DELETE CASCADE;`,
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
        // 外键失败不阻断流程（可能是类型不一致或表不存在），继续向后执行
      }
    }

    // 验证：策略是否生效
    console.log('验证：检查 RLS 与策略')
    const { rows: polRows } = await client.query(
      `SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='event_follows'`
    )
    console.log('现有策略:', polRows.map(r => r.policyname))

    console.log('所有操作完成')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('修复过程中发生错误:', err)
  process.exit(1)
})