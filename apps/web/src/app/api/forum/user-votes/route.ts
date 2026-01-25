import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getSessionAddress, normalizeAddress, logApiError } from "@/lib/serverUtils";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

interface ForumVoteRow {
  content_type: string | null;
  content_id: number | null;
  vote_type: string | null;
}

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
    const client = supabaseAdmin;
    if (!client) {
      return ApiResponses.internalError("Database not available");
    }

    const { data, error } = await client
      .from("forum_votes")
      .select("content_type, content_id, vote_type")
      .eq("user_id", address)
      .eq("event_id", eventId);

    if (error) {
      logApiError("GET /api/forum/user-votes query failed", error);
      return ApiResponses.databaseError("Failed to fetch votes", error.message);
    }
    const votes = (data || []) as ForumVoteRow[];
    return successResponse({ votes });
  } catch (e) {
    const error = e as Error;
    logApiError("GET /api/forum/user-votes unhandled error", error);
    return ApiResponses.internalError("Failed to fetch user votes", error.message);
  }
}
