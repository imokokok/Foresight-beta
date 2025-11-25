// 预测事件API路由 - 处理GET和POST请求
import { NextRequest, NextResponse } from 'next/server';
import { getClient, supabaseAdmin, supabase, type Prediction } from '@/lib/supabase';
import { getSessionAddress, normalizeAddress, isAdminAddress } from '@/lib/serverUtils';

export async function GET(request: NextRequest) {
  try {
    // 对于获取预测事件列表，允许匿名访问（不需要登录）
    // 只有创建预测事件等敏感操作才需要登录验证

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');
    const includeOutcomes = (searchParams.get('includeOutcomes') || '0') !== '0';

    // 在缺少服务密钥时使用匿名客户端降级读取
    const client = getClient();
    if (!client) {
      return NextResponse.json({ success: false, message: 'Supabase 未配置' }, { status: 500 })
    }

    // 构建Supabase查询
    let selectExpr = '*';
    if (includeOutcomes) selectExpr = '*, outcomes:prediction_outcomes(*)';
    let query = client
      .from('predictions')
      .select(selectExpr)
      .order('created_at', { ascending: false });
    
    // 添加过滤条件
    if (category) {
      query = query.eq('category', category);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (limit) {
      const limitNum = parseInt(limit);
      query = query.limit(limitNum);
    }
    
    const { data: predictions, error } = await query;
    
    let predictionsWithFollowersCount = [];
    if (!error && predictions) {
      const ids = (predictions || []).map((p: any) => Number(p?.id)).filter((n: number) => Number.isFinite(n));
      let counts: Record<number, number> = {};
      if (ids.length > 0) {
        const { data: rows, error: rowsError } = await client
          .from('event_follows')
          .select('event_id')
          .in('event_id', ids);
        if (!rowsError && Array.isArray(rows)) {
          for (const r of rows as any[]) {
            const eid = Number((r as any)?.event_id);
            if (Number.isFinite(eid)) counts[eid] = (counts[eid] || 0) + 1;
          }
        } else {
          const list = await Promise.all(ids.map(async (eid) => {
            const { count, error: e } = await client
              .from('event_follows')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', eid);
            return [eid, e ? 0 : (count || 0)] as const;
          }));
          counts = Object.fromEntries(list.map(([k, v]) => [Number(k), Number(v)]));
        }
      }
      predictionsWithFollowersCount = (predictions || []).map((p: any) => ({
        ...p,
        followers_count: counts[Number(p?.id)] || 0,
      }));
    }

    if (error) {
      console.error('获取预测事件列表失败:', error);
      return NextResponse.json({ success: false, message: '获取预测事件列表失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: predictionsWithFollowersCount,
      message: '获取预测事件列表成功'
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
  } catch (error) {
    console.error('获取预测事件列表异常:', error);
    return NextResponse.json({ success: false, message: '获取预测事件列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体中的JSON数据
    const body = await request.json();
    
    const sessAddr = getSessionAddress(request);
    let walletAddress: string = normalizeAddress(String(body.walletAddress || ''));
    if (!walletAddress && sessAddr) walletAddress = normalizeAddress(sessAddr);
    
    // 验证钱包地址格式
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(walletAddress)) {
      return NextResponse.json(
        { 
          success: false, 
          message: '无效的钱包地址格式' 
        },
        { status: 400 }
      );
    }

    if (sessAddr && normalizeAddress(sessAddr) !== walletAddress) {
      return NextResponse.json({ success: false, message: '未认证或会话地址不匹配' }, { status: 401 })
    }
    
    // 验证必填字段
    const requiredFields = ['title', 'description', 'category', 'deadline', 'minStake', 'criteria'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: '缺少必填字段', 
          missingFields 
        },
        { status: 400 }
      );
    }
    
    // 验证数据类型
    if (typeof body.minStake !== 'number' || body.minStake <= 0) {
      return NextResponse.json(
        { success: false, message: '最小押注必须是大于0的数字' },
        { status: 400 }
      );
    }
    
    // 选择客户端：优先使用服务端密钥，缺失则回退匿名（需有RLS策略支持写入，否则会失败）
    const client = getClient()
    if (!client) {
      return NextResponse.json({ success: false, message: 'Supabase 未配置' }, { status: 500 })
    }

    const { data: prof, error: profErr } = await (client as any)
      .from('user_profiles')
      .select('is_admin')
      .eq('wallet_address', walletAddress)
      .maybeSingle()
    const isAdmin = (!!prof?.is_admin) || isAdminAddress(walletAddress)
    if (profErr || !isAdmin) {
      return NextResponse.json({ success: false, message: '需要管理员权限' }, { status: 403 })
    }
    // 检查是否已存在相同标题的预测事件
    const { data: existingPredictions, error: checkError } = await client
      .from('predictions')
      .select('id, title, description, category, deadline, status')
      .eq('title', body.title);
    
    if (checkError) {
      console.error('检查重复标题失败:', checkError);
      return NextResponse.json(
        { success: false, message: '检查预测事件失败' },
        { status: 500 }
      );
    }
    
    // 如果存在相同标题的预测事件，返回错误并列出所有重复事件
    if (existingPredictions && existingPredictions.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: '已存在相同标题的预测事件，请修改标题或删除现有事件',
          duplicateEvents: existingPredictions.map(event => ({
            id: event.id,
            title: event.title,
            category: event.category,
            status: event.status,
            deadline: event.deadline
          }))
        },
        { status: 409 } // 409 Conflict 状态码
      );
    }
    
    // 验证图片URL（如果提供了）
    if (body.imageUrl && typeof body.imageUrl !== 'string') {
      return NextResponse.json(
        { success: false, message: '图片URL格式无效' },
        { status: 400 }
      );
    }

    // 优先使用上传的图片URL，如果没有上传则使用生成的图片
    let imageUrl: string;
    if (body.imageUrl) {
      // 如果imageUrl包含supabase.co，说明是上传的图片
      if (body.imageUrl.includes('supabase.co')) {
        imageUrl = body.imageUrl;
      } else if (body.imageUrl.startsWith('https://')) {
        imageUrl = body.imageUrl;
      } else {
        // 生成基于标题的图片URL
        const seed = body.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'prediction';
        imageUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
      }
    } else {
      // 如果没有提供图片URL，根据标题生成图片
      const seed = body.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'prediction';
      imageUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
    }

    // 插入新的预测事件到Supabase数据库
    // 先获取当前最大id，然后手动指定id来避免序列冲突
    const { data: maxIdData, error: maxIdError } = await client
      .from('predictions')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    
    if (maxIdError) {
      console.error('获取最大ID失败:', maxIdError);
      return NextResponse.json(
        { success: false, message: '创建预测事件失败' },
        { status: 500 }
      );
    }
    
    const nextId = maxIdData.length > 0 ? maxIdData[0].id + 1 : 1;
    
    // 事件类型与选项校验
    const type = String(body.type || 'binary');
    const outcomes = Array.isArray(body.outcomes) ? body.outcomes : [];
    if (type === 'multi') {
      if (outcomes.length < 3 || outcomes.length > 8) {
        return NextResponse.json(
          { success: false, message: '多元事件的选项数量需在 3 到 8 之间' },
          { status: 400 }
        );
      }
      if (outcomes.some((o: any) => !String(o?.label || '').trim())) {
        return NextResponse.json(
          { success: false, message: '每个选项都需要非空的 label' },
          { status: 400 }
        );
      }
    }

    const { data: newPrediction, error } = await client
      .from('predictions')
      .insert({
        id: nextId, // 手动指定id，避免序列冲突
        title: body.title,
        description: body.description,
        category: body.category,
        deadline: body.deadline,
        min_stake: body.minStake,
        criteria: body.criteria,
        reference_url: body.reference_url || '',
        image_url: imageUrl,
        status: 'active',
        type: type === 'multi' ? 'multi' : 'binary',
        outcome_count: type === 'multi' ? outcomes.length : 2,
      })
      .select()
      .single();
    
    if (error) {
      console.error('创建预测事件失败:', error);
      return NextResponse.json(
        { success: false, message: '创建预测事件失败' },
        { status: 500 }
      );
    }
    
    // 根据类型插入选项（binary 默认 Yes/No；multi 按用户输入）
    try {
      const items = (type === 'multi')
        ? outcomes.map((o: any, i: number) => ({
            prediction_id: newPrediction.id,
            outcome_index: i,
            label: String(o?.label || '').trim(),
            description: o?.description || null,
            color: o?.color || null,
            image_url: o?.image_url || null,
          }))
        : [
            { prediction_id: newPrediction.id, outcome_index: 0, label: 'Yes' },
            { prediction_id: newPrediction.id, outcome_index: 1, label: 'No' },
          ];
      const { error: outcomesErr } = await client
        .from('prediction_outcomes')
        .insert(items);
      if (outcomesErr) {
        console.warn('插入选项失败：', outcomesErr);
      }
    } catch (e) {
      console.warn('插入选项异常：', e);
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: newPrediction,
      message: '预测事件创建成功'
    }, { status: 201 }); // 201表示资源创建成功
    
  } catch (error) {
    // 错误处理
    console.error('创建预测事件异常:', error);
    return NextResponse.json(
      { success: false, message: '创建预测事件失败', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
