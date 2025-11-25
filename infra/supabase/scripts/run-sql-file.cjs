// 使用 pg 直连 Postgres，执行指定的 SQL 文件内容
// 兼容加载根目录 .env/.env.local 以及当前目录的 .env/.env.local
try {
  const path = require('path')
  const dotenv = require('dotenv')
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true })
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })
  // infra/supabase/.env(.local)
  dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true })
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true })
  // 项目根 .env(.local)
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env'), override: true })
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env.local'), override: true })
} catch {}

let Client
try {
  Client = require('pg').Client
} catch (e) {
  console.error('未找到 pg 依赖，请先运行: npm i pg')
  process.exit(1)
}

const fs = require('fs')
const path = require('path')

// 读取连接字符串：优先 SUPABASE_DB_URL，其次 SUPABASE_CONNECTION_STRING
const connectionString =
  process.env.SUPABASE_DB_URL || process.env.SUPABASE_CONNECTION_STRING

if (!connectionString) {
  console.error('缺少数据库连接字符串：请在根 .env.local 或 infra/supabase/.env 中设置 SUPABASE_CONNECTION_STRING 或 SUPABASE_DB_URL')
  process.exit(1)
}

// 从命令行参数读取SQL文件路径
const fileArg = process.argv[2]
if (!fileArg) {
  console.error('用法: node scripts/run-sql-file.cjs <sql-file-path>')
  process.exit(1)
}

const sqlPath = path.resolve(process.cwd(), fileArg)
if (!fs.existsSync(sqlPath)) {
  console.error('SQL 文件不存在:', sqlPath)
  process.exit(1)
}

const sql = fs.readFileSync(sqlPath, 'utf8')

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })

async function main() {
  try {
    await client.connect()
    console.log('已连接 Postgres')
    console.log('执行文件:', sqlPath)
    const res = await client.query(sql)
    if (res && Array.isArray(res.rows)) {
      console.log(`SQL 执行完成，返回行数: ${res.rowCount}`)
      if (res.rows.length) {
        const preview = res.rows.slice(0, 10)
        console.log('前 10 行预览:')
        console.table(preview)
      }
    } else {
      console.log('SQL 执行完成')
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('执行 SQL 失败:', err?.message || err)
  process.exit(1)
})