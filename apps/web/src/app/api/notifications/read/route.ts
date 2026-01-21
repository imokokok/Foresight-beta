import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses } from "@/lib/apiResponse";
import { checkRateLimit, RateLimits } from "@/lib/rateLimit";
import {
  getSessionAddress,
  normalizeAddress,
  parseRequestBody,
  parseNumericIds,
} from "@/lib/serverUtils";

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized();

    const rl = await checkRateLimit(viewer, RateLimits.moderate, "notifications_read_user");
    if (!rl.success) return ApiResponses.rateLimit("请求过于频繁，请稍后再试");

    const body = await parseRequestBody(req);
    const markAll = body?.all === true || String(body?.all || "") === "true";
    const ids = parseNumericIds((body as any)?.ids).slice(0, 100);

    const now = new Date().toISOString();
    if (markAll) {
      const { error } = await (client as any)
        .from("notifications")
        .update({ read_at: now })
        .eq("recipient_id", viewer)
        .is("archived_at", null)
        .is("read_at", null);
      if (error) return ApiResponses.databaseError("Update failed", error.message);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!ids.length) return ApiResponses.invalidParameters("ids 必填");

    const { error } = await (client as any)
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", viewer)
      .in("id", ids);
    if (error) return ApiResponses.databaseError("Update failed", error.message);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return ApiResponses.internalError(error?.message || "Request failed");
  }
}
