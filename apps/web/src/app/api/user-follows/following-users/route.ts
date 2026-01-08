import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

/**
 * 获取我关注的用户列表
 */

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const { searchParams } = new URL(req.url);
    const address = normalizeAddress(searchParams.get("address") || "");

    if (!address) return ApiResponses.badRequest("Address is required");

    // 查询我关注的用户地址列表
    const { data: followData, error: followError } = await client
      .from("user_follows")
      .select("following_address")
      .eq("follower_address", address);

    if (followError)
      return ApiResponses.databaseError("Failed to fetch follows", followError.message);

    const followRows = (followData ?? []) as { following_address: string }[];
    const followingAddresses = followRows.map((f) => f.following_address);

    if (followingAddresses.length === 0) return successResponse({ users: [] });

    // 获取这些用户的资料
    const { data: profiles, error: profileError } = await client
      .from("user_profiles")
      .select("wallet_address, username, created_at")
      .in("wallet_address", followingAddresses);

    if (profileError)
      return ApiResponses.databaseError("Failed to fetch profiles", profileError.message);

    // 获取这些用户的统计数据（如粉丝数、交易量等）
    // 为了性能，先简单返回资料
    const profileRows = (profiles ?? []) as { wallet_address: string; username: string | null }[];

    const users = profileRows.map((p) => ({
      wallet_address: p.wallet_address,
      username: p.username || `User_${p.wallet_address.slice(2, 8)}`,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${p.wallet_address}`,
    }));

    return successResponse({ users });
  } catch (error: any) {
    return ApiResponses.internalError(error.message);
  }
}
