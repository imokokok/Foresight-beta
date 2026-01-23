import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses } from "@/lib/apiResponse";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { getSessionAddress, normalizeAddress } from "@/lib/serverUtils";

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

// 获取设备类型
function getDeviceType(userAgent: string): string {
  if (/mobile/i.test(userAgent)) return "mobile";
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  return "desktop";
}

// 获取浏览器信息
function getBrowser(userAgent: string): string {
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "Unknown";
}

// 获取操作系统
function getOS(userAgent: string): string {
  if (userAgent.includes("Win")) return "Windows";
  if (userAgent.includes("Mac")) return "macOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iOS")) return "iOS";
  return "Unknown";
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const rl = await checkRateLimit(ip || "unknown", RateLimits.lenient, "analytics_post_ip");
    if (!rl.success) {
      return ApiResponses.rateLimit("Too many analytics events");
    }
    const body = await req.json();

    const {
      name,
      value,
      rating,
      delta,
      id,
      navigationType,
      url,
      timestamp,
      device,
      connection,
      viewport,
    } = body;

    // 获取用户信息
    const userAgent = req.headers.get("user-agent") || "";
    const deviceType = device?.type || getDeviceType(userAgent);
    const browser = getBrowser(userAgent);
    const os = getOS(userAgent);

    // 在生产环境记录到数据库
    if (process.env.NODE_ENV === "production") {
      const client = supabaseAdmin as any;
      if (client) {
        const sessAddr = await getSessionAddress(req);
        const sessionId = sessAddr ? normalizeAddress(String(sessAddr || "")) : null;

        await (client as any)
          .from("web_vitals")
          .insert({
            metric_name: name,
            metric_value: value,
            metric_rating: rating,
            metric_delta: delta,
            metric_id: id,
            navigation_type: navigationType,
            page_url: url,
            user_id: null,
            session_id: sessionId,
            device_type: deviceType,
            browser,
            os,
            screen_resolution:
              viewport?.width && viewport?.height ? `${viewport.width}x${viewport.height}` : null,
            connection_type: connection?.type || null,
            connection_effective_type: connection?.effectiveType || null,
            created_at: safeIsoFromTimestamp(timestamp),
          })
          .catch((error: any) => {
            // 静默失败，但记录错误
            console.error("Failed to insert web_vitals:", error);
          });
      }

      // 同时发送到 Vercel Analytics（如果配置了）
    } else {
      // 开发环境输出到控制台
      console.log(`[Web Vital] ${name}:`, {
        value: Math.round(value),
        rating,
        delta: Math.round(delta),
        device: deviceType,
        page: url,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error("Analytics error:", e);
    return ApiResponses.internalError("Analytics error", detail);
  }
}
