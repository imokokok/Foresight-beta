import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { ApiResponses } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { event, properties } = body;

    // 在生产环境记录自定义事件
    if (process.env.NODE_ENV === "production") {
      console.log("Custom Event:", event, properties);

      // 可以发送到分析服务或记录到数据库
      const client = getClient();
      if (client) {
        await (client as any)
          .from("analytics_events")
          .insert({
            event_name: event,
            event_properties: properties,
            created_at: new Date(properties.timestamp || Date.now()).toISOString(),
          })
          .catch(() => {
            // 表不存在时静默失败
          });
      }
    } else {
      console.log(`[Event] ${event}:`, properties);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error("Analytics event error:", e);
    return ApiResponses.internalError("Analytics event error", detail);
  }
}
