import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function isoAfterDays(days: number) {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()
}

function imageFor(title: string) {
  const seed = (title || 'prediction').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`
}

const seeds = [
  {
    title: '美联储下次议息利率变动幅度',
    description: '预测下一次FOMC会议的联邦基金目标利率变动区间',
    category: '时政',
    deadline: isoAfterDays(20),
    minStake: 1,
    criteria: '以FOMC官方声明与路透/彭博报道为准',
    outcomes: [
      { label: '50+ bps decrease' },
      { label: '25 bps decrease' },
      { label: 'No change' },
      { label: '25+ bps increase' }
    ]
  },
  {
    title: 'BTC 月末收盘价区间（USDT）',
    description: '预测本月最后一个自然日UTC 23:59:59时BTC收盘价所处区间',
    category: '科技',
    deadline: isoAfterDays(12),
    minStake: 1,
    criteria: '以Binance现货价格为准，USD(T)计价，收盘价取分时均价',
    outcomes: [
      { label: '< 50,000' },
      { label: '50,000 - 60,000' },
      { label: '60,000 - 70,000' },
      { label: '>= 70,000' }
    ]
  },
  {
    title: '英超2025赛季冠军归属',
    description: '预测2025赛季英超最终冠军球队',
    category: '娱乐',
    deadline: isoAfterDays(60),
    minStake: 1,
    criteria: '以英超官方最终积分榜为准',
    outcomes: [
      { label: 'Manchester City' },
      { label: 'Liverpool' },
      { label: 'Arsenal' },
      { label: 'Other' }
    ]
  },
  {
    title: '中国新能源乘用车月度销量同比增速',
    description: '预测下一个自然月中国新能源乘用车零售销量同比增速区间',
    category: '科技',
    deadline: isoAfterDays(25),
    minStake: 1,
    criteria: '以乘联会零售数据为准',
    outcomes: [
      { label: '< 0%' },
      { label: '0% - 10%' },
      { label: '10% - 20%' },
      { label: '>= 20%' }
    ]
  },
  {
    title: '登陆中国的下一次台风强度等级',
    description: '预测下一次登陆中国大陆的台风强度等级',
    category: '天气',
    deadline: isoAfterDays(15),
    minStake: 1,
    criteria: '以中国气象局发布的等级为准',
    outcomes: [
      { label: '热带风暴' },
      { label: '强热带风暴' },
      { label: '台风' },
      { label: '强台风' },
      { label: '超强台风' }
    ]
  }
]

export async function POST() {
  try {
    const client = supabaseAdmin
    if (!client) {
      return NextResponse.json({ success: false, message: 'Supabase 未配置服务端密钥' }, { status: 500 })
    }

    const { data: maxIdRows, error: maxErr } = await client
      .from('predictions')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)

    if (maxErr) {
      return NextResponse.json({ success: false, message: '读取最大ID失败' }, { status: 500 })
    }

    let nextId = (maxIdRows && maxIdRows[0]) ? Number(maxIdRows[0].id) + 1 : 1
    const created: any[] = []
    const skipped: any[] = []

    for (const s of seeds) {
      const { data: dup, error: dupErr } = await client
        .from('predictions')
        .select('id')
        .eq('title', s.title)
      if (!dupErr && Array.isArray(dup) && dup.length > 0) {
        skipped.push({ title: s.title, id: dup[0].id })
        continue
      }
      const { data: pred, error: createErr } = await client
        .from('predictions')
        .insert({
          id: nextId,
          title: s.title,
          description: s.description,
          category: s.category,
          deadline: s.deadline,
          min_stake: s.minStake,
          criteria: s.criteria,
          reference_url: '',
          image_url: imageFor(s.title),
          status: 'active',
          type: 'multi',
          outcome_count: s.outcomes.length
        })
        .select()
        .single()
      if (createErr || !pred) {
        skipped.push({ title: s.title, error: createErr?.message || 'create failed' })
        continue
      }
      const items = s.outcomes.map((o: any, i: number) => ({
        prediction_id: pred.id,
        outcome_index: i,
        label: String(o.label || ''),
        description: o.description || null,
        color: o.color || null,
        image_url: o.image_url || null
      }))
      const { error: outErr } = await client
        .from('prediction_outcomes')
        .insert(items)
      if (outErr) {
        skipped.push({ title: s.title, error: outErr.message })
      } else {
        created.push(pred)
        nextId += 1
      }
    }

    return NextResponse.json({ success: true, createdCount: created.length, skippedCount: skipped.length, created, skipped }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: String(e?.message || e) }, { status: 500 })
  }
}

