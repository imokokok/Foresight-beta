import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses } from "@/lib/apiResponse";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const rl = await checkRateLimit(ip || "unknown", RateLimits.lenient, "webview_click_post_ip");
    if (!rl.success) {
      return ApiResponses.rateLimit("Too many requests");
    }
    const body = await req.json().catch(() => null);
    try {
      if (body && typeof body === "object") {
        const size = JSON.stringify(body).length;
        if (size > 10_000) {
          return ApiResponses.invalidParameters("payload too large");
        }
      }
    } catch {}

    if (process.env.NODE_ENV === "production") {
      const client = supabaseAdmin;
      if (client) {
        await (client as any)
          .from("analytics_events")
          .insert({
            event_name: "webview_click",
            event_properties: body,
            created_at: new Date().toISOString(),
          })
          .catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error("webviewClick API error:", e);
    return ApiResponses.internalError("webviewClick API error", detail);
  }
}
