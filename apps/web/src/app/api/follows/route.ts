import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeAddress } from '@/lib/serverUtils'

// Helper: detect missing relation error for graceful setup message
function isMissingRelation(error?: { message?: string }) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist') || 
         msg.includes('could not find') && (msg.includes('column') && (msg.includes('user_address') || msg.includes('user_wallet') || msg.includes('user_id')))
}

// Helper: detect FK constraint errors
function isUserIdForeignKeyViolation(error?: { message?: string }) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('violates foreign key constraint') && msg.includes('event_follows_user_id_fkey')
}

// Helper: detect event_id → predictions(id) foreign key violation
function isEventIdForeignKeyViolation(error?: { message?: string }) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  // 默认约束名为 event_follows_event_id_fkey；兼容部分环境错误信息仅提到 predictions
  return msg.includes('violates foreign key constraint') && (msg.includes('event_follows_event_id_fkey') || msg.includes('predictions'))
}

// Helper: detect integer type mismatch on user_id column
function isUserIdTypeIntegerError(error?: { message?: string }) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('out of range for type integer') || msg.includes('invalid input syntax for type integer')
}

// Helper: detect missing unique/exclusion constraint for ON CONFLICT
function isOnConflictNoUniqueConstraint(error?: { message?: string }) {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('no unique or exclusion constraint') && msg.includes('on conflict')
}

// 使用共享包中的地址规范化与校验

// 取消所有本地降级，仅使用 Supabase

// Robust body parser to handle various client payloads (single-read)
async function parseRequestBody(req: Request) {
  const contentType = req.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      const text = await req.text()
      try { return JSON.parse(text) } catch { return {} }
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      const params = new URLSearchParams(text)
      return Object.fromEntries(params.entries())
    }
    if (contentType.includes('multipart/form-data')) {
      const form = await (req as any).formData?.()
      if (form && typeof (form as any).entries === 'function') {
        const obj: Record<string, any> = {}
        for (const [k, v] of (form as any).entries()) {
          obj[k] = v as any
        }
        return obj
      }
      return {}
    }
    // Fallback: try text->JSON
    const text = await req.text()
    if (text) {
      try { return JSON.parse(text) } catch { return {} }
    }
    return {}
  } catch (_) {
    return {}
  }
}

// POST /api/follows  body: { predictionId: number, walletAddress: string }
export async function POST(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { message: '服务端未配置 SUPABASE_SERVICE_ROLE_KEY，请在 .env.local 中设置后重启开发服务器' },
        { status: 500 }
      )
    }
    const body = await parseRequestBody(req)
    const rawPredictionId = body?.predictionId
    const rawWallet = body?.walletAddress
    const predictionId = Number(rawPredictionId)
    const wa = normalizeAddress(String(rawWallet || ''))
    const walletAddress = /^0x[a-f0-9]{40}$/.test(wa) ? wa : ''

    if (!predictionId) {
      return NextResponse.json({ message: 'predictionId 必填且需为数字', received: String(rawPredictionId ?? '') }, { status: 400 })
    }
    if (!rawWallet) {
      return NextResponse.json({ message: 'walletAddress 必填', received: '' }, { status: 400 })
    }
    if (!walletAddress) {
      return NextResponse.json({ message: 'walletAddress 格式无效，需 0x + 40 位十六进制', received: String(rawWallet) }, { status: 422 })
    }

    // 前置校验：确认预测事件是否存在，避免外键冲突造成的迷惑性错误
    const { count: pidCount, error: pidCheckError } = await supabaseAdmin
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('id', predictionId)

    if (pidCheckError) {
      // 读取预测事件失败，多半是环境密钥或RLS问题，返回通用错误
      try { console.error('POST /api/follows check prediction error', { predictionId, message: pidCheckError?.message }) } catch {}
      return NextResponse.json({ message: '服务端读取预测事件失败，请稍后重试' }, { status: 500 })
    }
    if (!pidCount) {
      return NextResponse.json({ message: 'predictionId 不存在，预测事件已删除或未创建' }, { status: 404 })
    }

    // 首先尝试插入（若缺表或结构错误按策略处理）
    const { data, error } = await supabaseAdmin
      .from('event_follows')
      .upsert({ user_id: walletAddress, event_id: predictionId }, { onConflict: 'user_id,event_id' })
      .select()
      .maybeSingle()

    if (error) {
      // 记录未分类错误，便于诊断（出现在开发服务器终端）
      try { console.error('POST /api/follows upsert error', { predictionId, walletAddress, message: error?.message }) } catch {}
      if (isMissingRelation(error) || isUserIdForeignKeyViolation(error) || isUserIdTypeIntegerError(error)) {
        // 明确给出修复指引
        if (isMissingRelation(error)) {
          return NextResponse.json({
            message: '缺少 event_follows 表，请在 Supabase 控制台执行以下 SQL 并重试',
            setupRequired: true,
            sql: `
CREATE TABLE IF NOT EXISTS public.event_follows (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id BIGINT NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);
ALTER TABLE public.event_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on event_follows" ON public.event_follows
FOR ALL USING (true) WITH CHECK (true);`
          }, { status: 501 })
        }
        if (isUserIdForeignKeyViolation(error)) {
          return NextResponse.json({
            message: 'event_follows.user_id 外键约束错误，请修复为 TEXT 唯一键',
            setupRequired: true,
            detail: error.message,
            sql: `
ALTER TABLE public.event_follows DROP CONSTRAINT IF EXISTS event_follows_user_id_fkey;
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`
          }, { status: 501 })
        }
        if (isUserIdTypeIntegerError(error)) {
          return NextResponse.json({
            message: 'event_follows.user_id 列类型错误，请改为 TEXT 并添加唯一索引',
            setupRequired: true,
            detail: error.message,
            sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`
          }, { status: 501 })
        }
      }
      // 针对缺少唯一约束的情况，回退为“存在性检查 + 普通插入”，避免接口 500
      if (isOnConflictNoUniqueConstraint(error)) {
        // 检查是否已存在记录
        const { count: existCount, error: existError } = await supabaseAdmin
          .from('event_follows')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', walletAddress)
          .eq('event_id', predictionId)

        if (existError) {
          if (isMissingRelation(existError) || isUserIdForeignKeyViolation(existError) || isUserIdTypeIntegerError(existError)) {
            return NextResponse.json({
              message: '关注失败，需要修复表结构后重试',
              setupRequired: true,
              detail: existError.message,
              sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`
            }, { status: 500 })
          }
          return NextResponse.json({ message: '关注失败', detail: existError.message }, { status: 500 })
        }

        if (existCount && existCount > 0) {
          return NextResponse.json({ message: '已关注', follow: { user_id: walletAddress, event_id: predictionId } }, { status: 200 })
        }

        // 尝试普通插入
        const { data: insData, error: insError } = await supabaseAdmin
          .from('event_follows')
          .insert({ user_id: walletAddress, event_id: predictionId })
          .select()
          .maybeSingle()

        if (insError) {
          if (isMissingRelation(insError) || isUserIdForeignKeyViolation(insError) || isUserIdTypeIntegerError(insError)) {
            return NextResponse.json({
              message: '关注失败，需要修复表结构后重试',
              setupRequired: true,
              detail: insError.message,
              sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`
            }, { status: 500 })
          }
          if (isEventIdForeignKeyViolation(insError)) {
            return NextResponse.json({
              message: 'predictionId 无效，预测事件不存在或已删除（外键）',
              detail: insError.message
            }, { status: 400 })
          }
          return NextResponse.json({ message: '关注失败', detail: insError.message }, { status: 500 })
        }

        return NextResponse.json({ message: '已关注', follow: insData }, { status: 200 })
      }

      // 针对 event_id 外键冲突返回明确的 400
      if (isEventIdForeignKeyViolation(error)) {
        // 如果预检确认存在但仍发生外键冲突，极可能是 Supabase 表约束指向了错误的表或环境不一致
        return NextResponse.json({
          message: 'predictionId 无效，预测事件不存在或已删除（外键）',
          detail: error.message,
          hint: '若该 predictionId 在列表中存在但仍提示无效，请检查 Supabase 中 event_follows.event_id 的外键是否指向 public.predictions(id)，以及 .env.local 的 SUPABASE_* 配置是否与前端一致。'
        }, { status: 400 })
      }
      return NextResponse.json({ message: '关注失败', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: '已关注', follow: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '请求处理失败', detail: String(e?.message || e) }, { status: 500 })
  }
}

// DELETE /api/follows  body: { predictionId: number, walletAddress: string }
export async function DELETE(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { message: '服务端未配置 SUPABASE_SERVICE_ROLE_KEY，请在 .env.local 中设置后重启开发服务器' },
        { status: 500 }
      )
    }
    const body = await parseRequestBody(req)
    const predictionId = Number(body?.predictionId)
    const walletAddress = normalizeAddress(String(body?.walletAddress || ''))

    if (!predictionId || !walletAddress) {
      return NextResponse.json({ message: 'predictionId 与 walletAddress 必填' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('event_follows')
      .delete()
      .eq('user_id', walletAddress)
      .eq('event_id', predictionId)

    if (error) {
      if (isMissingRelation(error) || isUserIdForeignKeyViolation(error) || isUserIdTypeIntegerError(error)) {
        if (isMissingRelation(error)) {
          return NextResponse.json({
            message: '缺少 event_follows 表，请创建后重试',
            setupRequired: true,
            sql: `
CREATE TABLE IF NOT EXISTS public.event_follows (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id BIGINT NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);`
          }, { status: 501 })
        }
        if (isUserIdForeignKeyViolation(error)) {
          return NextResponse.json({
            message: 'event_follows.user_id 外键约束错误，请删除约束并改为 TEXT',
            setupRequired: true,
            detail: error.message,
            sql: `
ALTER TABLE public.event_follows DROP CONSTRAINT IF EXISTS event_follows_user_id_fkey;`
          }, { status: 501 })
        }
        if (isUserIdTypeIntegerError(error)) {
          return NextResponse.json({
            message: 'event_follows.user_id 列类型为整数，需改为 TEXT',
            setupRequired: true,
            detail: error.message,
            sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;`
          }, { status: 501 })
        }
      }
      return NextResponse.json({ message: '取消关注失败', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: '已取消关注' }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '请求处理失败', detail: String(e?.message || e) }, { status: 500 })
  }
}

// GET /api/follows?predictionId=xx&walletAddress=xx
export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { message: '服务端未配置 SUPABASE_SERVICE_ROLE_KEY，请在 .env.local 中设置后重启开发服务器' },
        { status: 500 }
      )
    }
    const { searchParams } = new URL(req.url)
    const predictionId = Number(searchParams.get('predictionId'))
    const wa = normalizeAddress(String(searchParams.get('walletAddress') || ''))
    const walletAddress = /^0x[a-f0-9]{40}$/.test(wa) ? wa : ''

    if (!predictionId) {
      return NextResponse.json({ message: 'predictionId 必填' }, { status: 400 })
    }

    const { count, error: countError } = await supabaseAdmin
      .from('event_follows')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', predictionId)

    if (countError) {
      if (isMissingRelation(countError) || isUserIdForeignKeyViolation(countError) || isUserIdTypeIntegerError(countError)) {
        return NextResponse.json({
          message: '计数查询失败，需要修复表结构',
          setupRequired: true,
          detail: countError.message,
          sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`
        }, { status: 500 })
      }
      return NextResponse.json({ message: '查询失败', detail: countError.message }, { status: 500 })
    }

    // 检查当前用户是否已关注
    let following = false
    if (walletAddress) {
      const { data: followData, error: followError } = await supabaseAdmin
        .from('event_follows')
        .select('*')
        .eq('user_id', walletAddress)
        .eq('event_id', predictionId)
        .maybeSingle()

      if (followError) {
        if (isMissingRelation(followError) || isUserIdForeignKeyViolation(followError) || isUserIdTypeIntegerError(followError)) {
          return NextResponse.json({
            message: '查询失败，需要修复表结构',
            setupRequired: true,
            detail: followError.message,
            sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;`
          }, { status: 500 })
        } else {
          return NextResponse.json({ message: '查询失败', detail: followError.message }, { status: 500 })
        }
      } else {
        following = !!followData
      }
    }

    return NextResponse.json({ following, followersCount: count || 0 }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ message: '请求处理失败', detail: String(e?.message || e) }, { status: 500 })
  }
}