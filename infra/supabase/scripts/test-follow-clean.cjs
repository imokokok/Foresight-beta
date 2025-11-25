// 清理调试插入的 event_follows 测试行
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
    const { rowCount } = await client.query(
      'DELETE FROM public.event_follows WHERE event_id=$1 AND user_id=$2',
      [eventId, testUser]
    )
    console.log('删除测试行 count =', rowCount)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('清理失败:', err?.message || err)
  process.exit(1)
})