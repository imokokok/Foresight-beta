import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";

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
  } catch (e) {
    console.error("webviewClick API error:", e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
