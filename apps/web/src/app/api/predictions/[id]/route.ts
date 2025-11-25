// 预测事件详情API路由 - 处理单个预测事件的GET请求
import { NextRequest, NextResponse } from "next/server";
import { getClient, type Prediction } from "@/lib/supabase";
import { getSessionAddress, normalizeAddress, isAdminAddress } from "@/lib/serverUtils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const url = new URL(request.url);
    const includeStatsParam = url.searchParams.get("includeStats");
    const includeStats = includeStatsParam !== "0";
    const includeOutcomes = (url.searchParams.get("includeOutcomes") || '0') !== '0';

    // 验证ID参数
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, message: "无效的预测事件ID" },
        { status: 400 }
      );
    }

    const predictionId = parseInt(id);

    // 选择客户端：优先使用服务端密钥，缺失则回退匿名（需有RLS读取策略）
    const client = getClient();
    if (!client) {
      return NextResponse.json({ success: false, message: "Supabase 未配置" }, { status: 500 });
    }

    // 查询预测详情
    const sel = includeOutcomes ? '*, outcomes:prediction_outcomes(*)' : '*';
    const { data: prediction, error } = await (client as any)
      .from("predictions")
      .select(sel)
      .eq("id", predictionId)
      .single();

    if (error) {
      if ((error as any)?.code === "PGRST116") {
        return NextResponse.json(
          { success: false, message: "预测事件不存在" },
          { status: 404 }
        );
      }
      console.error("获取预测事件详情失败:", error);
      return NextResponse.json(
        { success: false, message: "获取预测事件详情失败" },
        { status: 500 }
      );
    }

    let yesAmount = 0;
    let noAmount = 0;
    let totalAmount = 0;
    let participantCount = 0;
    let betCount = 0;

    if (includeStats) {
      const { data: betsStats, error: betsError } = await client
        .from("bets")
        .select("outcome, amount, user_id")
        .eq("prediction_id", predictionId);
      if (!betsError && betsStats) {
        const uniqueParticipants = new Set<string>();
        for (const bet of betsStats as any[]) {
          const amt = Number((bet as any)?.amount || 0);
          if ((bet as any)?.outcome === "yes") yesAmount += amt; else if ((bet as any)?.outcome === "no") noAmount += amt;
          totalAmount += amt;
          const uid = String((bet as any)?.user_id || "");
          if (uid) uniqueParticipants.add(uid);
        }
        participantCount = uniqueParticipants.size;
        betCount = (betsStats as any[]).length;
      }
    }

    // 计算当前概率（基于CPMM恒定乘积做市商模型）
    let yesProbability = 0;
    let noProbability = 0;

    if (totalAmount > 0) {
      // 简单的概率计算：基于押注金额比例
      yesProbability = yesAmount / totalAmount;
      noProbability = noAmount / totalAmount;
    } else {
      // 如果没有押注，默认各50%
      yesProbability = 0.5;
      noProbability = 0.5;
    }

    // 构建响应数据
    const predictionDetail = {
      id: prediction.id,
      title: prediction.title,
      description: prediction.description,
      category: prediction.category,
      deadline: prediction.deadline,
      minStake: prediction.min_stake, // 注意字段名映射
      criteria: prediction.criteria,
      referenceUrl: prediction.reference_url, // 注意字段名映射
      status: prediction.status,
      createdAt: prediction.created_at,
      updatedAt: prediction.updated_at,
      stats: {
        yesAmount: parseFloat(yesAmount.toFixed(4)),
        noAmount: parseFloat(noAmount.toFixed(4)),
        totalAmount: parseFloat(totalAmount.toFixed(4)),
        participantCount,
        yesProbability: parseFloat(yesProbability.toFixed(4)),
        noProbability: parseFloat(noProbability.toFixed(4)),
        betCount,
      },
      // 添加时间信息
      timeInfo: {
        createdAgo: getTimeAgo(prediction.created_at),
        deadlineIn: getTimeRemaining(prediction.deadline),
        isExpired: new Date(prediction.deadline) < new Date(),
      },
      type: prediction.type,
      outcome_count: prediction.outcome_count,
      outcomes: includeOutcomes ? (prediction as any)?.outcomes || [] : undefined,
    };

    return NextResponse.json(
      {
        success: true,
        data: predictionDetail,
        message: "获取预测事件详情成功",
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=5, stale-while-revalidate=20"
        },
      }
    );
  } catch (error) {
    console.error("获取预测事件详情异常:", error);
    return NextResponse.json(
      { success: false, message: "获取预测事件详情失败" },
      { status: 500 }
    );
  }
}

// 辅助函数：计算相对时间
function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 30) return `${diffDays}天前`;
  return "超过一个月前";
}

// 辅助函数：计算剩余时间
function getTimeRemaining(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "已截止";

  const diffDays = Math.floor(diffMs / 86400000);
  const diffHours = Math.floor((diffMs % 86400000) / 3600000);

  if (diffDays > 0) return `${diffDays}天${diffHours}小时后截止`;
  if (diffHours > 0) return `${diffHours}小时后截止`;
  return "即将截止";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const predictionId = parseInt(String(id));
    if (!Number.isFinite(predictionId)) {
      return NextResponse.json({ success: false, message: "无效的预测事件ID" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const sessAddr = getSessionAddress(request);
    const addr = normalizeAddress(String(sessAddr || body.walletAddress || ''));
    if (!/^0x[a-f0-9]{40}$/.test(addr)) {
      return NextResponse.json({ success: false, message: "未认证或钱包地址无效" }, { status: 401 });
    }
    const client = getClient();
    if (!client) {
      return NextResponse.json({ success: false, message: "Supabase 未配置" }, { status: 500 });
    }
    const { data: prof } = await (client as any)
      .from('user_profiles')
      .select('is_admin')
      .eq('wallet_address', addr)
      .maybeSingle();
    const isAdmin = (!!prof?.is_admin) || isAdminAddress(addr);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "需要管理员权限" }, { status: 403 });
    }
    const upd: any = {};
    if (typeof body.title === 'string') upd.title = body.title;
    if (typeof body.description === 'string') upd.description = body.description;
    if (typeof body.category === 'string') upd.category = body.category;
    if (typeof body.deadline === 'string') upd.deadline = body.deadline;
    if (typeof body.minStake !== 'undefined') upd.min_stake = Number(body.minStake);
    if (typeof body.criteria === 'string') upd.criteria = body.criteria;
    if (typeof body.reference_url === 'string') upd.reference_url = body.reference_url;
    if (typeof body.image_url === 'string') upd.image_url = body.image_url;
    if (typeof body.status === 'string') upd.status = body.status;
    if (Object.keys(upd).length === 0) {
      return NextResponse.json({ success: false, message: "无可更新字段" }, { status: 400 });
    }
    const { data, error } = await client
      .from('predictions')
      .update(upd)
      .eq('id', predictionId)
      .select('*')
      .maybeSingle();
    if (error) {
      return NextResponse.json({ success: false, message: '更新失败', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data, message: '更新成功' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: String(e?.message || e) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const predictionId = parseInt(String(id));
    if (!Number.isFinite(predictionId)) {
      return NextResponse.json({ success: false, message: "无效的预测事件ID" }, { status: 400 });
    }
    const sessAddr = getSessionAddress(request);
    const addr = normalizeAddress(String(sessAddr || ''));
    if (!/^0x[a-f0-9]{40}$/.test(addr)) {
      return NextResponse.json({ success: false, message: "未认证或钱包地址无效" }, { status: 401 });
    }
    const client = getClient();
    if (!client) {
      return NextResponse.json({ success: false, message: "Supabase 未配置" }, { status: 500 });
    }
    const { data: prof } = await (client as any)
      .from('user_profiles')
      .select('is_admin')
      .eq('wallet_address', addr)
      .maybeSingle();
    const isAdmin = (!!prof?.is_admin) || isAdminAddress(addr);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "需要管理员权限" }, { status: 403 });
    }
    const { error } = await client
      .from('predictions')
      .delete()
      .eq('id', predictionId);
    if (error) {
      return NextResponse.json({ success: false, message: '删除失败', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: '已删除' }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: String(e?.message || e) }, { status: 500 });
  }
}
