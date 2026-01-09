import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { getSessionAddress, normalizeAddress } from "@/lib/serverUtils";

// POST /api/history  body: { eventId: number, walletAddress: string }
// GET /api/history?address=0x...

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return ApiResponses.internalError("Supabase client not initialized");
    }

    const body = await req.json().catch(() => ({}) as any);
    const eventIdRaw = (body as any)?.eventId;
    const walletAddressRaw = String((body as any)?.walletAddress || "");
    const eventId =
      typeof eventIdRaw === "number" || typeof eventIdRaw === "string" ? Number(eventIdRaw) : NaN;

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) {
      return ApiResponses.unauthorized("未登录或会话失效");
    }

    const walletAddress = walletAddressRaw ? normalizeAddress(walletAddressRaw) : viewer;
    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
      return ApiResponses.badRequest("walletAddress 无效");
    }
    if (walletAddress !== viewer) {
      return ApiResponses.forbidden("walletAddress mismatch");
    }

    if (!Number.isFinite(eventId) || eventId <= 0) {
      return ApiResponses.badRequest("Missing required fields");
    }

    // 使用 upsert 确保每个用户对每个事件只记录一次，并更新时间
    const { error } = await supabaseAdmin.from("event_views").upsert(
      {
        user_id: walletAddress.toLowerCase(),
        event_id: eventId,
        viewed_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id,event_id" }
    );

    if (error) {
      console.error("Failed to record view history:", error);
      return ApiResponses.databaseError("Failed to record history", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return ApiResponses.internalError("Failed to record history", error.message);
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return ApiResponses.internalError("Supabase client not initialized");
    }

    const { searchParams } = new URL(req.url);
    const addressRaw = searchParams.get("address") || "";

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) {
      return ApiResponses.unauthorized("未登录或会话失效");
    }

    const address = addressRaw ? normalizeAddress(addressRaw) : viewer;
    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      return ApiResponses.badRequest("Address is required");
    }
    if (address !== viewer) {
      return ApiResponses.forbidden("address mismatch");
    }

    const { data, error } = await supabaseAdmin
      .from("event_views")
      .select(
        `
        viewed_at,
        predictions (
          id,
          title,
          image_url,
          category
        )
      `
      )
      .eq("user_id", address.toLowerCase())
      .order("viewed_at", { ascending: false })
      .limit(50); // 限制最近 50 条

    if (error) {
      console.error("Failed to fetch history:", error);
      return ApiResponses.databaseError("Failed to fetch history", error.message);
    }

    // 格式化数据
    const history = (data || [])
      .map((item: any) => ({
        id: item.predictions?.id,
        title: item.predictions?.title,
        image_url: item.predictions?.image_url,
        category: item.predictions?.category,
        viewed_at: item.viewed_at,
      }))
      .filter((item: any) => item.id); // 过滤掉关联查询为空的记录（例如事件已被删除）

    return successResponse(history, "History fetched successfully");
  } catch (error: any) {
    return ApiResponses.internalError("Failed to fetch history", error.message);
  }
}
