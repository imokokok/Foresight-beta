import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase';

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
      return NextResponse.json(
        { success: false, message: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { chainId, verifyingContract, order, signature } = body;

    if (!chainId || !verifyingContract || !order || !signature) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: Verify signature using ethers.verifyTypedData
    // For now, we trust the client (Development Mode)

    const expirySec = Number(order.expiry);
    const expiryTs = Number.isFinite(expirySec) && expirySec > 0
      ? new Date(expirySec * 1000)
      : null;

    const { error } = await (client.from('orders') as any).insert({
      chain_id: chainId,
      verifying_contract: verifyingContract.toLowerCase(),
      maker_address: order.maker.toLowerCase(),
      outcome_index: Number(order.outcomeIndex),
      is_buy: order.isBuy,
      price: order.price,
      amount: order.amount,
      remaining: order.amount, // Initially, remaining equals amount
      expiry: expiryTs,
      maker_salt: order.salt,
      signature: signature,
      status: 'open',
    });

    if (error) {
      console.error('Error creating order:', error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Order created' });

  } catch (e: any) {
    console.error('Create Order API error:', e);
    return NextResponse.json(
      { success: false, message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
