// 简单的插入测试：验证 event_follows 能写入，排除数据库层问题
require('dotenv/config')

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
  console.error('缺少数据库连接字符串 SUPABASE_DB_URL')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

const eventId = parseInt(process.env.TEST_EVENT_ID || '1', 10)
const testUser = (process.env.TEST_USER_ID || '0xdebug000000000000000000000000000000000001').toLowerCase()

async function main() {
  await client.connect()
  console.log('已连接 Supabase Postgres')
  try {
    const sql = `INSERT INTO public.event_follows (event_id, user_id) VALUES ($1, $2)
                 ON CONFLICT (user_id, event_id) DO NOTHING;`
    await client.query(sql, [eventId, testUser])
    const { rows } = await client.query(
      'SELECT COUNT(*)::int AS c FROM public.event_follows WHERE event_id=$1 AND user_id=$2',
      [eventId, testUser]
    )
    console.log('插入校验 count =', rows?.[0]?.c)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('插入测试失败:', err?.message || err)
  process.exit(1)
})