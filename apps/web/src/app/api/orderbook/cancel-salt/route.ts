import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase';
import { ethers } from 'ethers';

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
    const { salt, maker, signature, message } = body;

    if (!salt || !maker || !signature || !message) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Verify Signature
    // Message expected: "Cancel Order: <salt>"
    const expectedMessage = `Cancel Order: ${salt}`;
    if (message !== expectedMessage) {
        return NextResponse.json(
            { success: false, message: 'Invalid message format' },
            { status: 400 }
        );
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== maker.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 2. Cancel Order in DB
    const { error } = await client
      .from('orders')
      .update({ status: 'canceled' })
      .eq('maker_address', maker.toLowerCase())
      .eq('maker_salt', salt)
      .select();

    if (error) {
      console.error('Error cancelling order:', error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Order cancelled' });

  } catch (e: any) {
    console.error('Cancel Order API error:', e);
    return NextResponse.json(
      { success: false, message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
