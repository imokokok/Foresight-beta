import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";

export const revalidate = 5; // 5 seconds cache

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId");
    const contract = searchParams.get("contract");
    const marketKey = searchParams.get("marketKey"); // Optional, if we want to filter by marketKey directly
    const limit = parseInt(searchParams.get("limit") || "50");

    let query = client
      .from("trades")
      .select("*")
      .order("block_timestamp", { ascending: false })
      .limit(limit);

    if (chainId) {
      query = query.eq("network_id", chainId);
    }
    if (contract) {
      query = query.eq("market_address", contract);
    }
    // Note: trades table currently uses network_id and market_address.
    // It does not seem to have 'market_key' column based on previous sql file reading.
    // But let's check if we can filter by market_address and network_id effectively.

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || String(e) }, { status: 500 });
  }
}
