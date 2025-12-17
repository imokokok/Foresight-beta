import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getClient } from '@/lib/supabase';
import { successResponse, ApiResponses } from '@/lib/apiResponse';
import { validateOrder } from '@/lib/orderVerification';
import type { EIP712Order } from '@/types/market';

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get('chainId');
    const contract = searchParams.get('contract');
    const maker = searchParams.get('maker');
    const status = searchParams.get('status') || 'open';

    let query = client.from('orders').select('*');

    if (chainId) query = query.eq('chain_id', chainId);
    if (contract) query = query.eq('verifying_contract', contract.toLowerCase());
    if (maker) query = query.eq('maker_address', maker.toLowerCase());
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError('数据库未配置');
    }

    const body = await req.json();
    const { chainId, verifyingContract, contract, order, signature } = body;

    const vcRaw = (verifyingContract || contract || "").toString();
    const vc = vcRaw.trim();

    // 验证必填字段
    if (!chainId || !vc || !order || !signature) {
      return ApiResponses.invalidParameters('缺少必填字段');
    }

    // 验证链 ID
    const chainIdNum = Number(chainId);
    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
      return ApiResponses.badRequest('无效的链 ID');
    }

    // 验证合约地址格式
    if (!ethers.isAddress(vc)) {
      return ApiResponses.badRequest('无效的合约地址');
    }

    // 构造订单对象
    const orderData: EIP712Order = {
      maker: order.maker,
      outcomeIndex: Number(order.outcomeIndex),
      isBuy: Boolean(order.isBuy),
      price: String(order.price),
      amount: String(order.amount),
      salt: String(order.salt),
      expiry: Number(order.expiry || 0),
    };

    // 🔥 关键：验证订单签名和参数
    const validation = await validateOrder(
      orderData,
      signature,
      chainIdNum,
      vc
    );

    if (!validation.valid) {
      console.warn('Order validation failed:', validation.error);
      return ApiResponses.invalidSignature(validation.error || '订单验证失败');
    }

    // 检查订单是否已存在（防止重复提交）
    const { data: existingOrder } = await client
      .from('orders')
      .select('id')
      .eq('maker_address', orderData.maker.toLowerCase())
      .eq('maker_salt', orderData.salt)
      .maybeSingle();

    if (existingOrder) {
      return ApiResponses.conflict('订单已存在（相同的 salt）');
    }

    // 转换过期时间
    const expiryTs = orderData.expiry > 0
      ? new Date(orderData.expiry * 1000)
      : null;

    // 插入订单
    const { error: insertError } = await (client.from('orders') as any).insert({
      chain_id: chainIdNum,
      verifying_contract: vc.toLowerCase(),
      maker_address: orderData.maker.toLowerCase(),
      outcome_index: orderData.outcomeIndex,
      is_buy: orderData.isBuy,
      price: orderData.price,
      amount: orderData.amount,
      remaining: orderData.amount, // 初始剩余量等于总量
      expiry: expiryTs,
      maker_salt: orderData.salt,
      signature: signature,
      status: 'open',
    });

    if (insertError) {
      console.error('Error creating order:', insertError);
      return ApiResponses.databaseError('创建订单失败', insertError.message);
    }

    return successResponse(
      { orderId: orderData.salt },
      '订单创建成功'
    );

  } catch (e: any) {
    console.error('Create Order API error:', e);
    return ApiResponses.internalError(
      '创建订单失败',
      process.env.NODE_ENV === 'development' ? e.message : undefined
    );
  }
}
