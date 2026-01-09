// 检查 trades 和 orders 表中的交易数据
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
  console.error('缺少 Supabase 配置')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  try {
    console.log('正在查询交易数据...\n')

    // ========== 1. 查询 trades 表 ==========
    const { count: tradesCount, error: tradesCountError } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })

    if (tradesCountError) {
      console.log('❌ trades 表查询失败:', tradesCountError.message)
      if (tradesCountError.message.includes('does not exist')) {
        console.log('   trades 表可能不存在')
      }
    } else {
      console.log(`📊 Trades (成交记录) 总数: ${tradesCount || 0}`)
      
      if (tradesCount > 0) {
        // 获取最近的交易
        const { data: recentTrades, error: recentError } = await supabase
          .from('trades')
          .select('*')
          .order('block_timestamp', { ascending: false })
          .limit(10)

        if (!recentError && recentTrades) {
          console.log('\n最近 10 笔交易:')
          console.log('─'.repeat(120))
          console.log(`${'Taker'.padEnd(14)} ${'Maker'.padEnd(14)} ${'价格'.padEnd(10)} ${'数量'.padEnd(12)} ${'方向'.padEnd(6)} ${'时间'.padEnd(20)} ${'市场地址'}`)
          console.log('─'.repeat(120))
          
          recentTrades.forEach(t => {
            const taker = t.taker_address ? `${t.taker_address.slice(0, 6)}...${t.taker_address.slice(-4)}` : 'N/A'
            const maker = t.maker_address ? `${t.maker_address.slice(0, 6)}...${t.maker_address.slice(-4)}` : 'N/A'
            const price = parseFloat(t.price || 0).toFixed(4)
            const amount = parseFloat(t.amount || 0).toFixed(2)
            const direction = t.is_buy ? '买入' : '卖出'
            const time = t.block_timestamp ? new Date(t.block_timestamp).toLocaleString('zh-CN') : 'N/A'
            const market = t.market_address ? `${t.market_address.slice(0, 10)}...` : 'N/A'
            console.log(`${taker.padEnd(14)} ${maker.padEnd(14)} ${price.padEnd(10)} ${amount.padEnd(12)} ${direction.padEnd(6)} ${time.padEnd(20)} ${market}`)
          })
          console.log('─'.repeat(120))
        }

        // 按用户统计交易次数
        const { data: userTrades, error: userTradesError } = await supabase
          .from('trades')
          .select('taker_address, maker_address')

        if (!userTradesError && userTrades) {
          const userTradeCount = {}
          userTrades.forEach(t => {
            if (t.taker_address) {
              userTradeCount[t.taker_address] = (userTradeCount[t.taker_address] || 0) + 1
            }
            if (t.maker_address) {
              userTradeCount[t.maker_address] = (userTradeCount[t.maker_address] || 0) + 1
            }
          })
          
          const sortedUsers = Object.entries(userTradeCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
          
          console.log('\n🏆 交易最活跃的用户 (Top 10):')
          sortedUsers.forEach(([addr, count], i) => {
            const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`
            console.log(`   ${i + 1}. ${shortAddr}: ${count} 笔交易`)
          })
        }
      }
    }

    // ========== 2. 查询 orders 表 ==========
    console.log('\n' + '='.repeat(60) + '\n')
    
    const { count: ordersCount, error: ordersCountError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    if (ordersCountError) {
      console.log('❌ orders 表查询失败:', ordersCountError.message)
    } else {
      console.log(`📊 Orders (订单) 总数: ${ordersCount || 0}`)

      // 按状态统计
      const { data: openOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')

      const { data: filledOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'filled')

      const { data: partialOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['partially_filled', 'filled_partial'])

      // 分别查询获取数量
      const { count: openCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')

      const { count: filledCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'filled')

      const { count: partialCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['partially_filled', 'filled_partial'])

      console.log('\n📈 订单状态统计:')
      console.log(`   开放中 (open): ${openCount || 0}`)
      console.log(`   已成交 (filled): ${filledCount || 0}`)
      console.log(`   部分成交 (partially_filled): ${partialCount || 0}`)

      // 买卖单统计
      const { count: buyCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('is_buy', true)

      const { count: sellCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('is_buy', false)

      console.log('\n📊 买卖方向统计:')
      console.log(`   买单: ${buyCount || 0}`)
      console.log(`   卖单: ${sellCount || 0}`)
    }

    // ========== 3. 查询 prediction_stats 表 ==========
    console.log('\n' + '='.repeat(60) + '\n')

    const { count: statsCount, error: statsError } = await supabase
      .from('prediction_stats')
      .select('*', { count: 'exact', head: true })

    if (statsError) {
      console.log('❌ prediction_stats 表查询失败:', statsError.message)
    } else {
      console.log(`📊 Prediction Stats (预测统计) 总数: ${statsCount || 0}`)

      if (statsCount > 0) {
        const { data: stats } = await supabase
          .from('prediction_stats')
          .select('*')
          .order('total_amount', { ascending: false })
          .limit(5)

        if (stats && stats.length > 0) {
          console.log('\n🔥 交易量最大的预测事件 (Top 5):')
          stats.forEach((s, i) => {
            const total = parseFloat(s.total_amount || 0).toFixed(2)
            const yes = parseFloat(s.yes_amount || 0).toFixed(2)
            const no = parseFloat(s.no_amount || 0).toFixed(2)
            console.log(`   ${i + 1}. 事件ID: ${s.prediction_id}`)
            console.log(`      总交易量: ${total} | YES: ${yes} | NO: ${no} | 下注次数: ${s.bet_count}`)
          })
        }
      }
    }

    console.log('\n✅ 查询完成!')

  } catch (err) {
    console.error('查询失败:', err?.message || err)
    process.exit(1)
  }
}

main()
