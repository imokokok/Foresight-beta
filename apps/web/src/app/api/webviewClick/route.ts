import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { ApiResponses } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (process.env.NODE_ENV === "production") {
      const client = getClient();
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
    } else {
      console.log("[WebviewClick]", body);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error("webviewClick API error:", e);
    return ApiResponses.internalError("webviewClick API error", detail);
  }
}
