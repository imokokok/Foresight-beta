import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSessionAddress, normalizeAddress } from "@/lib/serverUtils";

export async function GET(req: NextRequest) {
  try {
    const address = normalizeAddress(await getSessionAddress(req));
    const { searchParams } = new URL(req.url);
    const rawEventId = searchParams.get("eventId");
    const eventId = rawEventId == null ? null : Number(rawEventId);
    if (!/^0x[a-f0-9]{40}$/.test(address)) return NextResponse.json({ votes: [] }, { status: 200 });
    if (eventId === null || !Number.isFinite(eventId))
      return NextResponse.json({ votes: [] }, { status: 200 });
    if (!supabaseAdmin) return NextResponse.json({ votes: [] }, { status: 200 });

    const { data, error } = await supabaseAdmin
      .from("forum_votes")
      .select("content_type, content_id, vote_type")
      .eq("user_id", address)
      .eq("event_id", eventId);

    if (error) return NextResponse.json({ votes: [] }, { status: 200 });
    return NextResponse.json({ votes: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ votes: [] }, { status: 200 });
  }
}
