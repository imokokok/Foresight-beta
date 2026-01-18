import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import {
  getSessionAddress,
  isAdminAddress,
  logApiError,
  normalizeAddress,
} from "@/lib/serverUtils";

function isMissingRelation(error?: { message?: string }) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("relation") && msg.includes("does not exist");
}

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin as any;
    if (!client) {
      if (process.env.NODE_ENV !== "production") {
        return successResponse({ address: null, balance: "0", reserved: "0" });
      }
      return ApiResponses.internalError("Supabase not configured");
    }

    const url = new URL(req.url);
    const address = normalizeAddress(String(url.searchParams.get("address") || ""));
    if (!address) {
      return ApiResponses.badRequest("Invalid address");
    }

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) {
      return ApiResponses.unauthorized("未登录");
    }
    if (viewer !== address && !isAdminAddress(viewer)) {
      return ApiResponses.forbidden("无权限");
    }

    const { data, error } = await client
      .from("user_balances")
      .select("balance,reserved")
      .eq("user_address", address)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV !== "production" && isMissingRelation(error)) {
        return successResponse({ address, balance: "0", reserved: "0" });
      }
      return ApiResponses.databaseError("Failed to fetch user balance", error.message);
    }

    const row = (data || {}) as any;
    return successResponse({
      address,
      balance: String(row.balance ?? "0"),
      reserved: String(row.reserved ?? "0"),
    });
  } catch (e: any) {
    logApiError("GET /api/user-balance unhandled error", e);
    return ApiResponses.internalError("Failed to fetch user balance", e?.message || String(e));
  }
}
