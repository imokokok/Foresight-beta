import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

/**
 * 获取用户的粉丝数和关注数
 */

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const { searchParams } = new URL(req.url);
    const address = normalizeAddress(searchParams.get("address") || "");

    if (!address) return ApiResponses.badRequest("Address is required");

    // 并行查询粉丝数和关注数
    const [followersResult, followingResult] = await Promise.all([
      client
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_address", address),
      client
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_address", address),
    ]);

    return successResponse({
      followersCount: followersResult.count || 0,
      followingCount: followingResult.count || 0,
    });
  } catch (error: any) {
    return ApiResponses.internalError(error.message);
  }
}
