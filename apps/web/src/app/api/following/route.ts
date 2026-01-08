import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { logApiError, normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

// GET /api/following?address=0x...
export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return ApiResponses.internalError("Supabase client not initialized");
    }

    const { searchParams } = new URL(req.url);
    const rawAddress = searchParams.get("address");
    const address = normalizeAddress(String(rawAddress || ""));

    if (!address) {
      return ApiResponses.badRequest("Address is required");
    }

    // 1. 获取关注的事件 ID 列表
    const { data: rawFollowData, error: followError } = await supabaseAdmin
      .from("event_follows")
      .select("event_id, created_at")
      .eq("user_id", address)
      .order("created_at", { ascending: false });

    const followData = (rawFollowData || null) as
      | Database["public"]["Tables"]["event_follows"]["Row"][]
      | null;

    if (followError) {
      logApiError("GET /api/following fetch ids failed", followError);
      return ApiResponses.databaseError("Failed to fetch following", followError.message);
    }

    if (!followData || followData.length === 0) {
      return NextResponse.json({ following: [] });
    }

    const eventIds = followData.map((item) => item.event_id);
    const followMap = new Map(followData.map((item) => [item.event_id, item.created_at]));

    // 2. 根据 ID 获取预测事件详情
    const { data: predictionsData, error: predictionsError } = await supabaseAdmin
      .from("predictions")
      .select("id, title, image_url, category, deadline")
      .in("id", eventIds);

    if (predictionsError) {
      logApiError("GET /api/following fetch predictions failed", predictionsError);
      return ApiResponses.databaseError("Failed to fetch predictions", predictionsError.message);
    }

    // 3. 获取这些事件的总关注数
    const { data: allFollows, error: allFollowsError } = await supabaseAdmin
      .from("event_follows")
      .select("event_id")
      .in("event_id", eventIds);

    const counts: Record<number, number> = {};
    if (!allFollowsError && allFollows) {
      const allFollowRows = (allFollows ||
        []) as Database["public"]["Tables"]["event_follows"]["Row"][];
      for (const f of allFollowRows) {
        const eid = f.event_id;
        counts[eid] = (counts[eid] || 0) + 1;
      }
    }

    // 4. 组装数据
    type FollowingItem = {
      id: number;
      title: string;
      image_url: string | null;
      category: string;
      deadline: string;
      followers_count: number;
      followed_at: string | undefined;
    };

    const predictionRows = (predictionsData ||
      []) as Database["public"]["Tables"]["predictions"]["Row"][];

    const following: FollowingItem[] = predictionRows.map((prediction) => ({
      id: prediction.id,
      title: prediction.title,
      image_url: prediction.image_url,
      category: prediction.category,
      deadline: prediction.deadline,
      followers_count: counts[prediction.id] || 0,
      followed_at: followMap.get(prediction.id),
    }));

    // 保持原来的排序（按关注时间倒序）
    following.sort((a, b) => {
      const timeA = a.followed_at ? new Date(a.followed_at).getTime() : 0;
      const timeB = b.followed_at ? new Date(b.followed_at).getTime() : 0;
      return timeB - timeA;
    });

    return NextResponse.json({ following });
  } catch (error: any) {
    logApiError("GET /api/following unhandled error", error);
    return ApiResponses.internalError("Failed to fetch following", error.message);
  }
}
