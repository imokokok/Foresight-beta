import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses } from "@/lib/apiResponse";
import { getSessionAddress, normalizeAddress } from "@/lib/serverUtils";
import { getPendingReviewCountForWitness, getTodayPendingCheckins } from "@/lib/flagRewards";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  try {
    const ip = getIP(req);
    const rl = await checkRateLimit(ip || "unknown", RateLimits.lenient, "notifications_unread_ip");
    if (!rl.success) {
      return ApiResponses.rateLimit("Too many requests");
    }
    const client = supabaseAdmin;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized();

    const unreadDb = await client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", viewer)
      .is("archived_at", null)
      .is("read_at", null);

    if (unreadDb.error) return ApiResponses.databaseError("Query failed", unreadDb.error.message);

    const pendingReviewCount = await getPendingReviewCountForWitness({
      client,
      witnessId: viewer,
    });

    const { count: todayPendingCheckins } = await getTodayPendingCheckins({
      client,
      userId: viewer,
    });

    const dbCount = Number(unreadDb.count || 0);
    const count = dbCount + pendingReviewCount + todayPendingCheckins;

    return NextResponse.json(
      { count, dbCount, pendingReviewCount, todayPendingCheckins },
      { status: 200 }
    );
  } catch (error: any) {
    return ApiResponses.internalError(error?.message || "Request failed");
  }
}
