import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getSessionAddress, normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  try {
    const sessionAddress = await getSessionAddress(req);
    if (!sessionAddress) {
      return ApiResponses.unauthorized("Please connect your wallet");
    }
    const address = normalizeAddress(sessionAddress);
    const { searchParams } = new URL(req.url);
    const rawEventId = searchParams.get("eventId");
    const eventId = rawEventId == null ? null : Number(rawEventId);
    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      return ApiResponses.unauthorized("Invalid wallet address");
    }
    if (eventId === null || !Number.isFinite(eventId)) {
      return ApiResponses.invalidParameters("Invalid event ID");
    }
    if (!supabaseAdmin) {
      return ApiResponses.internalError("Database not available");
    }

    const { data, error } = await supabaseAdmin
      .from("forum_votes")
      .select("content_type, content_id, vote_type")
      .eq("user_id", address)
      .eq("event_id", eventId);

    if (error) {
      return ApiResponses.databaseError("Failed to fetch votes", error.message);
    }
    return NextResponse.json({ votes: data || [] }, { status: 200 });
  } catch (e: any) {
    return ApiResponses.internalError("Failed to fetch user votes", e.message);
  }
}
