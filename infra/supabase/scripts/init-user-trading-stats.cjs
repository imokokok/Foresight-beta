// 初始化用户交易统计表
// 需要先在 Supabase Dashboard 中执行 create_user_trading_stats.sql
// 然后运行此脚本来刷新数据

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
    console.log('正在初始化用户交易统计...\n')

    // 检查表是否存在
    const { data: tableCheck, error: tableError } = await supabase
      .from('user_trading_stats')
      .select('wallet_address')
      .limit(1)

    if (tableError) {
      console.log('❌ user_trading_stats 表不存在')
      console.log('\n请先在 Supabase Dashboard 的 SQL Editor 中执行:')
      console.log('  infra/supabase/sql/create_user_trading_stats.sql')
      console.log('\n或者复制以下 SQL 到 SQL Editor 中执行...\n')
      
      // 打印核心 SQL
      console.log('-- 创建表')
      console.log(`CREATE TABLE IF NOT EXISTS public.user_trading_stats (
  wallet_address TEXT PRIMARY KEY,
  trades_count INTEGER DEFAULT 0,
  total_volume NUMERIC DEFAULT 0,
  buy_volume NUMERIC DEFAULT 0,
  sell_volume NUMERIC DEFAULT 0,
  unique_markets INTEGER DEFAULT 0,
  first_trade_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,
  daily_trades INTEGER DEFAULT 0,
  daily_volume NUMERIC DEFAULT 0,
  weekly_trades INTEGER DEFAULT 0,
  weekly_volume NUMERIC DEFAULT 0,
  monthly_trades INTEGER DEFAULT 0,
  monthly_volume NUMERIC DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_trading_stats_volume 
ON public.user_trading_stats(total_volume DESC);

ALTER TABLE public.user_trading_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_trading_stats_select_all" ON public.user_trading_stats FOR SELECT USING (true);`)
      return
    }

    console.log('✅ user_trading_stats 表已存在')

    // 检查当前数据量
    const { count: statsCount } = await supabase
      .from('user_trading_stats')
      .select('*', { count: 'exact', head: true })

    console.log(`📊 当前统计数据: ${statsCount || 0} 条\n`)

    // 尝试调用刷新函数
    console.log('尝试刷新统计数据...')
    const { error: rpcError } = await supabase.rpc('refresh_user_trading_stats')

    if (rpcError) {
      console.log('⚠️  刷新函数不可用:', rpcError.message)
      console.log('\n将手动计算统计数据...\n')
      
      // 手动计算
      await manualRefresh()
    } else {
      console.log('✅ 统计数据刷新成功!')
    }

    // 显示结果
    const { data: topUsers, error: topError } = await supabase
      .from('user_trading_stats')
      .select('*')
      .order('total_volume', { ascending: false })
      .limit(10)

    if (!topError && topUsers && topUsers.length > 0) {
      console.log('\n🏆 交易量 Top 10:')
      console.log('─'.repeat(80))
      topUsers.forEach((user, i) => {
        const addr = `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`
        const vol = parseFloat(user.total_volume || 0).toFixed(2)
        const trades = user.trades_count || 0
        console.log(`${i + 1}. ${addr.padEnd(14)} 交易量: ${vol.padStart(12)} 交易次数: ${trades}`)
      })
      console.log('─'.repeat(80))
    }

    console.log('\n✅ 初始化完成!')

  } catch (err) {
    console.error('初始化失败:', err?.message || err)
    process.exit(1)
  }
}

async function manualRefresh() {
  console.log('从 trades 表聚合数据...')

  // 获取所有交易
  const { data: trades, error: tradesError } = await supabase
    .from('trades')
    .select('taker_address, maker_address, amount, price, is_buy, block_timestamp, market_address')

  if (tradesError) {
    console.error('获取交易数据失败:', tradesError.message)
    return
  }

  if (!trades || trades.length === 0) {
    console.log('没有交易数据')
    return
  }

  console.log(`找到 ${trades.length} 条交易记录`)

  const now = new Date()
  const dailyStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weeklyStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthlyStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // 聚合统计
  const userStats = {}

  for (const trade of trades) {
    // price 已经是小数格式 (如 0.5375)，不需要除以 1000000
    const volume = parseFloat(trade.amount || 0) * parseFloat(trade.price || 0)
    const tradeTime = new Date(trade.block_timestamp)
    const isDaily = tradeTime >= dailyStart
    const isWeekly = tradeTime >= weeklyStart
    const isMonthly = tradeTime >= monthlyStart

    // 处理 taker
    if (trade.taker_address) {
      const addr = trade.taker_address.toLowerCase()
      if (!userStats[addr]) {
        userStats[addr] = {
          wallet_address: addr,
          trades_count: 0,
          total_volume: 0,
          buy_volume: 0,
          sell_volume: 0,
          unique_markets: new Set(),
          first_trade_at: trade.block_timestamp,
          last_trade_at: trade.block_timestamp,
          daily_trades: 0,
          daily_volume: 0,
          weekly_trades: 0,
          weekly_volume: 0,
          monthly_trades: 0,
          monthly_volume: 0,
        }
      }
      const s = userStats[addr]
      s.trades_count++
      s.total_volume += volume
      if (trade.is_buy) s.buy_volume += volume
      else s.sell_volume += volume
      s.unique_markets.add(trade.market_address)
      if (tradeTime < new Date(s.first_trade_at)) s.first_trade_at = trade.block_timestamp
      if (tradeTime > new Date(s.last_trade_at)) s.last_trade_at = trade.block_timestamp
      if (isDaily) { s.daily_trades++; s.daily_volume += volume }
      if (isWeekly) { s.weekly_trades++; s.weekly_volume += volume }
      if (isMonthly) { s.monthly_trades++; s.monthly_volume += volume }
    }

    // 处理 maker
    if (trade.maker_address) {
      const addr = trade.maker_address.toLowerCase()
      if (!userStats[addr]) {
        userStats[addr] = {
          wallet_address: addr,
          trades_count: 0,
          total_volume: 0,
          buy_volume: 0,
          sell_volume: 0,
          unique_markets: new Set(),
          first_trade_at: trade.block_timestamp,
          last_trade_at: trade.block_timestamp,
          daily_trades: 0,
          daily_volume: 0,
          weekly_trades: 0,
          weekly_volume: 0,
          monthly_trades: 0,
          monthly_volume: 0,
        }
      }
      const s = userStats[addr]
      s.trades_count++
      s.total_volume += volume
      if (!trade.is_buy) s.buy_volume += volume
      else s.sell_volume += volume
      s.unique_markets.add(trade.market_address)
      if (tradeTime < new Date(s.first_trade_at)) s.first_trade_at = trade.block_timestamp
      if (tradeTime > new Date(s.last_trade_at)) s.last_trade_at = trade.block_timestamp
      if (isDaily) { s.daily_trades++; s.daily_volume += volume }
      if (isWeekly) { s.weekly_trades++; s.weekly_volume += volume }
      if (isMonthly) { s.monthly_trades++; s.monthly_volume += volume }
    }
  }

  // 转换为数组并插入
  const statsArray = Object.values(userStats).map(s => ({
    ...s,
    unique_markets: s.unique_markets.size,
    last_updated_at: new Date().toISOString()
  }))

  console.log(`聚合了 ${statsArray.length} 个用户的统计数据`)

  // 分批插入
  const batchSize = 100
  for (let i = 0; i < statsArray.length; i += batchSize) {
    const batch = statsArray.slice(i, i + batchSize)
    const { error: upsertError } = await supabase
      .from('user_trading_stats')
      .upsert(batch, { onConflict: 'wallet_address' })

    if (upsertError) {
      console.error(`插入批次 ${i / batchSize + 1} 失败:`, upsertError.message)
    } else {
      process.stdout.write(`\r已处理 ${Math.min(i + batchSize, statsArray.length)}/${statsArray.length} 条...`)
    }
  }

  console.log('\n数据聚合完成!')
}

main()

