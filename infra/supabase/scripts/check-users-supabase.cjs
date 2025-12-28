// 使用 Supabase 客户端检查 user_profiles 表中的用户数据
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

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少 Supabase 配置:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌')
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  try {
    console.log('正在连接 Supabase...')
    console.log('URL:', supabaseUrl)
    console.log('')

    // 获取用户总数
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.log('❌ 查询失败:', countError.message)
      if (countError.message.includes('does not exist')) {
        console.log('\n⚠️  user_profiles 表可能不存在')
        console.log('提示: 你可以运行以下命令来创建表:')
        console.log('  node infra/supabase/scripts/create-user-profiles.cjs')
      }
      return
    }

    console.log(`📊 用户总数: ${count || 0}\n`)

    if (count === 0) {
      console.log('⚠️  目前没有用户数据')
      console.log('\n提示: 你可以运行以下命令来创建测试用户:')
      console.log('  node scripts/seed-users-direct.js')
      return
    }

    // 获取所有用户
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('wallet_address, username, email, is_admin, is_reviewer, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (usersError) {
      console.log('❌ 获取用户列表失败:', usersError.message)
      return
    }

    console.log('👥 用户列表 (最近20个):')
    console.log('─'.repeat(100))
    console.log(`${'用户名'.padEnd(22)} ${'钱包地址'.padEnd(16)} ${'邮箱'.padEnd(30)} ${'角色'.padEnd(10)} ${'创建时间'}`)
    console.log('─'.repeat(100))
    
    users.forEach(user => {
      const role = user.is_admin ? '管理员' : (user.is_reviewer ? '审核员' : '普通')
      const addr = user.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : 'N/A'
      const createdAt = user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : 'N/A'
      console.log(`${(user.username || 'N/A').padEnd(22)} ${addr.padEnd(16)} ${(user.email || 'N/A').padEnd(30)} ${role.padEnd(10)} ${createdAt}`)
    })
    
    console.log('─'.repeat(100))

    // 统计管理员和审核员
    const { count: adminCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', true)

    const { count: reviewerCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_reviewer', true)
    
    console.log(`\n📈 统计:`)
    console.log(`   管理员: ${adminCount || 0}`)
    console.log(`   审核员: ${reviewerCount || 0}`)
    console.log(`   普通用户: ${(count || 0) - (adminCount || 0)}`)

  } catch (err) {
    console.error('查询失败:', err?.message || err)
    process.exit(1)
  }
}

main()

