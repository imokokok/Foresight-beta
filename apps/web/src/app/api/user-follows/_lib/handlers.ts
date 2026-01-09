import type { NextRequest } from "next/server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { getClient, supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { getSessionAddress, logApiError } from "@/lib/serverUtils";
import { parseRequestBody } from "@/lib/serverUtils";
import { parseLimitQuery, parsePageQuery, parseWalletAddressQuery } from "./validators";
import type {
  UserFollowsCountsResponse,
  UserFollowsUsersResponse,
  UserFollowsEventsResponse,
  UserFollowsEvent,
  UserFollowStatusResponse,
  UserFollowToggleResponse,
} from "./types";

type UserFollowsRow = {
  follower_address: string;
  following_address: string;
};

function getUserFollowsClient() {
  if (!supabaseAdmin) return null;
  return supabaseAdmin as unknown as {
    from: (table: "user_follows") => any;
  };
}

function toUserSummaryRowsInAddressOrder(args: {
  addresses: string[];
  profiles: Database["public"]["Tables"]["user_profiles"]["Row"][];
}): UserFollowsUsersResponse["users"] {
  const { addresses, profiles } = args;
  const byAddress = new Map<string, Database["public"]["Tables"]["user_profiles"]["Row"]>();
  for (const p of profiles) {
    const key = String(p.wallet_address || "").toLowerCase();
    if (key) byAddress.set(key, p);
  }

  return addresses
    .map((addr) => {
      const key = String(addr || "").toLowerCase();
      if (!key) return null;
      const p = byAddress.get(key);
      const wallet_address = String(p?.wallet_address || addr);
      const username = String(p?.username || `User_${wallet_address.slice(2, 8)}`);
      return {
        wallet_address,
        username,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet_address}`,
      };
    })
    .filter((v): v is UserFollowsUsersResponse["users"][number] => !!v);
}

export async function handleUserFollowsCountsGet(req: NextRequest) {
  try {
    if (!supabaseAdmin) return ApiResponses.internalError("Supabase not configured");

    const { searchParams } = new URL(req.url);
    const address = parseWalletAddressQuery(searchParams.get("address"));
    if (!address) return ApiResponses.badRequest("Address is required");

    const client = getUserFollowsClient();
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const [followersResult, followingResult] = await Promise.all([
      client
        .from("user_follows")
        .select("follower_address", { count: "exact", head: true })
        .eq("following_address", address),
      client
        .from("user_follows")
        .select("following_address", { count: "exact", head: true })
        .eq("follower_address", address),
    ]);

    if (followersResult?.error) {
      logApiError("GET /api/user-follows/counts followers query failed", followersResult.error);
      const detail = String(followersResult.error?.message || followersResult.error);
      return ApiResponses.databaseError("Failed to fetch followers count", detail);
    }
    if (followingResult?.error) {
      logApiError("GET /api/user-follows/counts following query failed", followingResult.error);
      const detail = String(followingResult.error?.message || followingResult.error);
      return ApiResponses.databaseError("Failed to fetch following count", detail);
    }

    const data: UserFollowsCountsResponse = {
      followersCount: Number(followersResult?.count || 0),
      followingCount: Number(followingResult?.count || 0),
    };

    return successResponse<UserFollowsCountsResponse>(data);
  } catch (error: any) {
    logApiError("GET /api/user-follows/counts unhandled error", error);
    return ApiResponses.internalError(
      "Failed to fetch follow counts",
      error?.message || String(error)
    );
  }
}

export async function handleUserFollowsFollowersUsersGet(req: NextRequest) {
  try {
    if (!supabaseAdmin) return ApiResponses.internalError("Supabase not configured");

    const { searchParams } = new URL(req.url);
    const address = parseWalletAddressQuery(searchParams.get("address"));
    if (!address) return ApiResponses.badRequest("Address is required");
    const page = parsePageQuery(searchParams.get("page"));
    const limit = parseLimitQuery(searchParams.get("limit"));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const client = getUserFollowsClient();
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const {
      data: rawFollowRows,
      error: followError,
      count,
    } = await client
      .from("user_follows")
      .select("follower_address", { count: "exact" })
      .eq("following_address", address)
      .range(from, to);

    if (followError) {
      logApiError("GET /api/user-follows/followers-users follow query failed", followError);
      return ApiResponses.databaseError(
        "Failed to fetch followers",
        String(followError.message || followError)
      );
    }

    const followRows = (rawFollowRows ?? []) as Array<Pick<UserFollowsRow, "follower_address">>;
    const followerAddresses = followRows.map((f) => String(f.follower_address)).filter(Boolean);
    const total = Number(count || 0);
    if (followerAddresses.length === 0) {
      return successResponse<UserFollowsUsersResponse>({ users: [], total, page, limit });
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("wallet_address, username")
      .in("wallet_address", followerAddresses);

    if (profileError) {
      logApiError("GET /api/user-follows/followers-users profiles query failed", profileError);
      return ApiResponses.databaseError("Failed to fetch profiles", profileError.message);
    }

    const profileRows = (profiles ?? []) as Database["public"]["Tables"]["user_profiles"]["Row"][];

    return successResponse<UserFollowsUsersResponse>({
      users: toUserSummaryRowsInAddressOrder({
        addresses: followerAddresses,
        profiles: profileRows,
      }),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    logApiError("GET /api/user-follows/followers-users unhandled error", error);
    return ApiResponses.internalError(
      "Failed to fetch followers users",
      error?.message || String(error)
    );
  }
}

export async function handleUserFollowsFollowingUsersGet(req: NextRequest) {
  try {
    if (!supabaseAdmin) return ApiResponses.internalError("Supabase not configured");

    const { searchParams } = new URL(req.url);
    const address = parseWalletAddressQuery(searchParams.get("address"));
    if (!address) return ApiResponses.badRequest("Address is required");
    const page = parsePageQuery(searchParams.get("page"));
    const limit = parseLimitQuery(searchParams.get("limit"));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const client = getUserFollowsClient();
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const {
      data: rawFollowRows,
      error: followError,
      count,
    } = await client
      .from("user_follows")
      .select("following_address", { count: "exact" })
      .eq("follower_address", address)
      .range(from, to);

    if (followError) {
      logApiError("GET /api/user-follows/following-users follow query failed", followError);
      return ApiResponses.databaseError(
        "Failed to fetch follows",
        String(followError.message || followError)
      );
    }

    const followRows = (rawFollowRows ?? []) as Array<Pick<UserFollowsRow, "following_address">>;
    const followingAddresses = followRows.map((f) => String(f.following_address)).filter(Boolean);
    const total = Number(count || 0);
    if (followingAddresses.length === 0) {
      return successResponse<UserFollowsUsersResponse>({ users: [], total, page, limit });
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("wallet_address, username")
      .in("wallet_address", followingAddresses);

    if (profileError) {
      logApiError("GET /api/user-follows/following-users profiles query failed", profileError);
      return ApiResponses.databaseError("Failed to fetch profiles", profileError.message);
    }

    const profileRows = (profiles ?? []) as Database["public"]["Tables"]["user_profiles"]["Row"][];

    return successResponse<UserFollowsUsersResponse>({
      users: toUserSummaryRowsInAddressOrder({
        addresses: followingAddresses,
        profiles: profileRows,
      }),
      total,
      page,
      limit,
    });
  } catch (error: any) {
    logApiError("GET /api/user-follows/following-users unhandled error", error);
    return ApiResponses.internalError(
      "Failed to fetch following users",
      error?.message || String(error)
    );
  }
}

export async function handleUserFollowsUserPost(req: NextRequest) {
  try {
    if (!supabaseAdmin) return ApiResponses.internalError("Supabase not configured");

    const followerAddress = await getSessionAddress(req);
    const follower = parseWalletAddressQuery(followerAddress);
    if (!follower) return ApiResponses.unauthorized();

    const body = await parseRequestBody(req);
    const target = parseWalletAddressQuery((body as any)?.targetAddress);
    if (!target) return ApiResponses.badRequest("Target address is required");
    if (target === follower) return ApiResponses.badRequest("Cannot follow yourself");

    const client = getUserFollowsClient();
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const { data: existing, error: existError } = await client
      .from("user_follows")
      .select("follower_address, following_address")
      .eq("follower_address", follower)
      .eq("following_address", target)
      .maybeSingle();

    if (existError) {
      logApiError("POST /api/user-follows/user existing query failed", existError);
      return ApiResponses.databaseError("Query failed", String(existError.message || existError));
    }

    if (existing) {
      const { error: delError } = await client
        .from("user_follows")
        .delete()
        .eq("follower_address", follower)
        .eq("following_address", target);

      if (delError) {
        logApiError("POST /api/user-follows/user unfollow failed", delError);
        return ApiResponses.databaseError(
          "Failed to unfollow",
          String(delError.message || delError)
        );
      }

      return successResponse<UserFollowToggleResponse>({ followed: false });
    }

    const { error: insError } = await client.from("user_follows").insert({
      follower_address: follower,
      following_address: target,
    });

    if (insError) {
      logApiError("POST /api/user-follows/user follow failed", insError);
      return ApiResponses.databaseError("Failed to follow", String(insError.message || insError));
    }

    return successResponse<UserFollowToggleResponse>({ followed: true });
  } catch (error: any) {
    logApiError("POST /api/user-follows/user unhandled error", error);
    return ApiResponses.internalError("Failed to toggle follow", error?.message || String(error));
  }
}

export async function handleUserFollowsUserGet(req: NextRequest) {
  try {
    if (!supabaseAdmin) return ApiResponses.internalError("Supabase not configured");

    const { searchParams } = new URL(req.url);
    const target = parseWalletAddressQuery(searchParams.get("targetAddress"));
    const follower = parseWalletAddressQuery(searchParams.get("followerAddress"));
    if (!target || !follower) return ApiResponses.badRequest("Both addresses are required");

    const client = getUserFollowsClient();
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const { data, error } = await client
      .from("user_follows")
      .select("follower_address, following_address")
      .eq("follower_address", follower)
      .eq("following_address", target)
      .maybeSingle();

    if (error) {
      logApiError("GET /api/user-follows/user query failed", error);
      return ApiResponses.databaseError("Query failed", String(error.message || error));
    }

    const res: UserFollowStatusResponse = { followed: !!data };
    return successResponse<UserFollowStatusResponse>(res);
  } catch (error: any) {
    logApiError("GET /api/user-follows/user unhandled error", error);
    return ApiResponses.internalError(
      "Failed to fetch follow status",
      error?.message || String(error)
    );
  }
}

export async function handleUserFollowsGet(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const { searchParams } = new URL(req.url);
    const address = parseWalletAddressQuery(searchParams.get("address"));
    if (!address) {
      return ApiResponses.badRequest("缺少用户地址参数");
    }

    const { data: rawFollowedEventIds, error: followsError } = await client
      .from("event_follows")
      .select("event_id")
      .eq("user_id", address);

    if (followsError) {
      logApiError("GET /api/user-follows event_follows query failed", followsError);
      return ApiResponses.databaseError("Failed to fetch follows", followsError.message);
    }

    const followedEventIds = (rawFollowedEventIds || []) as Array<{ event_id: number }>;
    const eventIds = followedEventIds
      .map((row) => Number(row.event_id))
      .filter((id): id is number => Number.isFinite(id) && id > 0);

    if (eventIds.length === 0) {
      return successResponse<UserFollowsEventsResponse>({ follows: [], total: 0 });
    }

    const { data: rawEventsData, error: eventsError } = await client
      .from("predictions")
      .select(
        "id, title, description, category, image_url, deadline, min_stake, status, created_at"
      )
      .in("id", eventIds)
      .order("created_at", { ascending: false });

    if (eventsError) {
      logApiError("GET /api/user-follows predictions query failed", eventsError);
      return ApiResponses.databaseError("Failed to fetch followed events", eventsError.message);
    }

    const eventsData = (rawEventsData || []) as Array<
      Pick<
        Database["public"]["Tables"]["predictions"]["Row"],
        | "id"
        | "title"
        | "description"
        | "category"
        | "image_url"
        | "deadline"
        | "min_stake"
        | "status"
        | "created_at"
      >
    >;

    const { data: followRows, error: followRowsError } = await client
      .from("event_follows")
      .select("event_id")
      .in("event_id", eventIds);

    const counts: Record<number, number> = {};
    if (!followRowsError && Array.isArray(followRows)) {
      const rows = followRows as Array<{ event_id?: number | string }>;
      for (const r of rows) {
        const eid = Number(r?.event_id);
        if (Number.isFinite(eid) && eid > 0) counts[eid] = (counts[eid] || 0) + 1;
      }
    }

    const follows: UserFollowsEvent[] = eventsData.map((event) => ({
      ...event,
      followers_count: counts[Number(event.id)] || 0,
    }));

    return successResponse<UserFollowsEventsResponse>({
      follows,
      total: follows.length,
    });
  } catch (error: any) {
    logApiError("GET /api/user-follows unhandled error", error);
    return ApiResponses.internalError("服务器内部错误", error?.message || String(error));
  }
}
