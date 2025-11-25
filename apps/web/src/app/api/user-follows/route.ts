import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/supabase'

function isMissingRelation(error?: { message?: string }) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
}
function isUserIdForeignKeyViolation(error?: { message?: string }) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('violates foreign key constraint') && msg.includes('event_follows_user_id_fkey')
}
function isUserIdTypeIntegerError(error?: { message?: string }) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('out of range for type integer') || msg.includes('invalid input syntax for type integer')
}

// 移除本地降级逻辑，强制仅使用 Supabase

export async function GET(request: NextRequest) {
  try {
    const client = getClient()
    if (!client) {
      return NextResponse.json({ follows: [], total: 0 })
    }
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { error: '缺少用户地址参数' },
        { status: 400 }
      )
    }

    // 获取用户关注的事件ID列表（仅 Supabase）
    const { data: followedEventIds, error: followsError } = await client
      .from('event_follows')
      .select('event_id')
      .eq('user_id', address)
    
    // 若在匿名模式下受RLS限制，返回空结果而非报错
    if (followsError) {
      return NextResponse.json({ follows: [], total: 0 })
    }

    const eventIds: number[] = (followedEventIds || []).map(follow => follow.event_id)
    if (!eventIds.length) {
      return NextResponse.json({ follows: [], total: 0 })
    }

    // 获取事件详细信息
    const { data: eventsData, error: eventsError } = await client
      .from('predictions')
      .select(`
        id,
        title,
        description,
        category,
        image_url,
        deadline,
        min_stake,
        status,
        created_at
      `)
      .in('id', eventIds)
      .order('created_at', { ascending: false })

    if (eventsError) {
      return NextResponse.json({ follows: [], total: 0 })
    }

    const { data: followRows, error: followRowsError } = await client
      .from('event_follows')
      .select('event_id')
      .in('event_id', eventIds)

    const counts: Record<number, number> = {}
    if (!followRowsError && Array.isArray(followRows)) {
      for (const r of followRows as any[]) {
        const eid = Number((r as any)?.event_id)
        if (Number.isFinite(eid)) counts[eid] = (counts[eid] || 0) + 1
      }
    }

    const eventsWithFollowersCount = (eventsData || []).map((event) => ({
      ...event,
      followers_count: counts[Number(event.id)] || 0
    }))

    return NextResponse.json({
      follows: eventsWithFollowersCount,
      total: eventsWithFollowersCount.length
    })

  } catch (error) {
    console.error('获取用户关注数据失败:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}