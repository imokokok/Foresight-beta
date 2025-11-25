// 简单检查数据库直连是否可用，并输出服务器版本
try {
  const path = require('path')
  const dotenv = require('dotenv')
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  // infra/supabase/.env(.local)
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
  // 项目根 .env(.local)
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') })
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env.local') })
} catch {}

let Client
try {
  Client = require('pg').Client
} catch (e) {
  console.error('未找到 pg 依赖，请先运行: npm i -w infra/supabase pg')
  process.exit(1)
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.SUPABASE_CONNECTION_STRING
if (!connectionString) {
  console.error('缺少连接字符串: 请在根 .env.local 或 infra/supabase/.env 设置 SUPABASE_DB_URL 或 SUPABASE_CONNECTION_STRING')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function main() {
  try {
    console.log('尝试连接数据库...')
    await client.connect()
    const { rows } = await client.query('select version() as version, current_database() as db, current_user as user')
    console.log('连接成功:', rows?.[0])
  } catch (err) {
    console.error('连接失败:', err?.message || err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()