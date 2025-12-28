// 检查 user_profiles 表中的用户数据
try {
  const path = require('path')
  const dotenv = require('dotenv')
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') })
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })
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
    console.log('正在连接数据库...')
    await client.connect()
    console.log('连接成功!\n')

    // 检查 user_profiles 表是否存在
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles'
      );
    `)
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ user_profiles 表不存在')
      return
    }
    
    console.log('✅ user_profiles 表存在\n')

    // 获取用户总数
    const countResult = await client.query('SELECT COUNT(*) as total FROM public.user_profiles')
    console.log(`📊 用户总数: ${countResult.rows[0].total}\n`)

    if (parseInt(countResult.rows[0].total) === 0) {
      console.log('⚠️  目前没有用户数据')
      console.log('\n提示: 你可以运行以下命令来创建测试用户:')
      console.log('  node scripts/seed-users-direct.js')
      return
    }

    // 获取所有用户
    const usersResult = await client.query(`
      SELECT 
        wallet_address,
        username,
        email,
        is_admin,
        is_reviewer,
        created_at
      FROM public.user_profiles 
      ORDER BY created_at DESC
      LIMIT 20
    `)

    console.log('👥 用户列表 (最近20个):')
    console.log('─'.repeat(100))
    console.log(`${'用户名'.padEnd(20)} ${'钱包地址'.padEnd(44)} ${'邮箱'.padEnd(30)} ${'角色'.padEnd(15)} ${'创建时间'}`)
    console.log('─'.repeat(100))
    
    usersResult.rows.forEach(user => {
      const role = user.is_admin ? '管理员' : (user.is_reviewer ? '审核员' : '普通用户')
      const addr = user.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : 'N/A'
      const createdAt = user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : 'N/A'
      console.log(`${(user.username || 'N/A').padEnd(20)} ${addr.padEnd(44)} ${(user.email || 'N/A').padEnd(30)} ${role.padEnd(15)} ${createdAt}`)
    })
    
    console.log('─'.repeat(100))

    // 统计管理员和审核员
    const adminCount = await client.query('SELECT COUNT(*) as count FROM public.user_profiles WHERE is_admin = true')
    const reviewerCount = await client.query('SELECT COUNT(*) as count FROM public.user_profiles WHERE is_reviewer = true')
    
    console.log(`\n📈 统计:`)
    console.log(`   管理员: ${adminCount.rows[0].count}`)
    console.log(`   审核员: ${reviewerCount.rows[0].count}`)
    console.log(`   普通用户: ${parseInt(countResult.rows[0].total) - parseInt(adminCount.rows[0].count)}`)

  } catch (err) {
    console.error('查询失败:', err?.message || err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()

