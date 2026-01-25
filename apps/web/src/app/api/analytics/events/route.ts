import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { getSessionAddress, isAdminAddress, normalizeAddress } from "@/lib/serverUtils";

function safeJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Infinity;
  }
}

function safeIsoFromTimestamp(value: unknown): string {
  const nowIso = new Date().toISOString();
  try {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      const d = new Date(value);
      return Number.isFinite(d.getTime()) ? d.toISOString() : nowIso;
    }
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return nowIso;
      const ms = Date.parse(s);
      if (Number.isFinite(ms)) {
        const d = new Date(ms);
        return Number.isFinite(d.getTime()) ? d.toISOString() : nowIso;
      }
      const asNum = Number(s);
      if (Number.isFinite(asNum) && asNum > 0) {
        const d = new Date(asNum);
        return Number.isFinite(d.getTime()) ? d.toISOString() : nowIso;
      }
    }
    return nowIso;
  } catch {
    return nowIso;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const rl = await checkRateLimit(
      ip || "unknown",
      RateLimits.lenient,
      "analytics_events_post_ip"
    );
    if (!rl.success) {
      return ApiResponses.rateLimit("Too many custom analytics events");
    }
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > 32 * 1024) {
      return ApiResponses.badRequest("Payload too large");
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return ApiResponses.invalidParameters("Invalid payload");
    }

    const raw = body as any;
    const event = typeof raw?.event === "string" ? raw.event.trim() : "";
    const properties = raw?.properties;
    const props =
      properties && typeof properties === "object" && !Array.isArray(properties) ? properties : {};

    if (!event || event.length > 64 || !/^[a-zA-Z0-9._:-]{1,64}$/.test(event)) {
      return ApiResponses.invalidParameters("Invalid event");
    }
    if (safeJsonSize(props) > 10_000) {
      return ApiResponses.invalidParameters("payload too large");
    }

    // 在生产环境记录自定义事件
    if (process.env.NODE_ENV === "production") {
      // 可以发送到分析服务或记录到数据库
      const client = supabaseAdmin as any;
      if (client) {
        await (client as any)
          .from("analytics_events")
          .insert({
            event_name: event,
            event_properties: props,
            created_at: safeIsoFromTimestamp((props as any)?.timestamp),
          })
          .catch(() => {
            // 表不存在时静默失败
          });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const error = e as Error;
    const detail = String(error?.message || error);
    console.error("Analytics event error:", error);
    return ApiResponses.internalError("Analytics event error", detail);
  }
}

/**
 * 管理员可查询事件 RED 视图
 * GET /api/analytics/events?minutes=60&event=siwe_verify_success
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getIP(req);
    const rl = await checkRateLimit(
      ip || "unknown",
      RateLimits.moderate,
      "analytics_events_get_ip"
    );
    if (!rl.success) {
      return ApiResponses.rateLimit("Too many requests");
    }
    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Database not configured");
    }
    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized();
    const { data: prof, error: profErr } = await (client as any)
      .from("user_profiles")
      .select("is_admin")
      .eq("wallet_address", viewer)
      .maybeSingle();
    if (profErr) return ApiResponses.databaseError("Query failed", profErr.message);
    const viewerIsAdmin = !!prof?.is_admin || isAdminAddress(viewer);
    if (!viewerIsAdmin) return ApiResponses.forbidden("无权限");

    const { searchParams } = new URL(req.url);
    const minutesRaw = Number(searchParams.get("minutes") || 60);
    const minutes = Math.max(1, Math.min(24 * 60, Number.isFinite(minutesRaw) ? minutesRaw : 60));
    const eventName = String(searchParams.get("event") || "").trim();

    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    let q = (client as any)
      .from("analytics_events")
      .select("event_name, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000); // 保护性上限
    if (eventName) q = q.eq("event_name", eventName);

    const { data, error } = await q;
    if (error) return ApiResponses.databaseError("Failed to fetch events", error.message);

    const rows = (data || []) as Array<{ event_name: string; created_at: string }>;

    // 汇总 RED：Rate（总次数/分钟条形），按事件名分组统计
    const byEvent: Record<
      string,
      {
        count: number;
        perMinute: Record<number, number>;
      }
    > = {};
    const nowBucket = Math.floor(Date.now() / 60000);
    for (const r of rows) {
      const name = r.event_name || "unknown";
      const t = Math.floor(new Date(r.created_at).getTime() / 60000);
      if (!Number.isFinite(t)) continue;
      if (!byEvent[name]) byEvent[name] = { count: 0, perMinute: {} };
      byEvent[name].count++;
      byEvent[name].perMinute[t] = (byEvent[name].perMinute[t] || 0) + 1;
    }

    // 生成时间序列（最近 N 分钟）
    const timeline = Array.from({ length: minutes }, (_, i) => nowBucket - (minutes - 1 - i));
    const series: Record<string, number[]> = {};
    for (const [name, agg] of Object.entries(byEvent)) {
      series[name] = timeline.map((b) => agg.perMinute[b] || 0);
    }
    const totals = Object.fromEntries(
      Object.entries(byEvent).map(([k, v]) => [k, v.count as number])
    );

    return NextResponse.json({
      success: true,
      data: {
        minutes,
        event: eventName || null,
        timelineUnixMinutes: timeline,
        totals,
        series,
      },
    });
  } catch (e) {
    const error = e as Error;
    const detail = String(error?.message || error);
    console.error("Analytics events GET error:", error);
    return ApiResponses.internalError("Analytics events error", detail);
  }
}
