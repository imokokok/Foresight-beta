import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import {
  getSessionAddress,
  isAdminAddress,
  logApiError,
  normalizeAddress,
} from "@/lib/serverUtils";
import { getChainAddresses, getConfiguredChainId, getConfiguredRpcUrl } from "@/lib/runtimeConfig";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import type { PostgrestError } from "@supabase/supabase-js";

interface UserBalanceRow {
  balance: string | null;
  reserved: string | null;
}

interface UserProfileRow {
  proxy_wallet_address: string | null;
  is_admin: boolean | null;
}

function isMissingRelation(error?: { message?: string }) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("relation") && msg.includes("does not exist");
}

async function canAccessUserBalance(
  client: NonNullable<Awaited<typeof supabaseAdmin>>,
  viewer: string,
  address: string
): Promise<boolean> {
  if (viewer === address) return true;
  if (isAdminAddress(viewer)) return true;

  try {
    const { data, error } = await client
      .from("user_profiles")
      .select("proxy_wallet_address,is_admin")
      .eq("wallet_address", viewer)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV !== "production" && isMissingRelation(error)) return false;
      return false;
    }

    const profile = data as UserProfileRow | null;
    if (profile?.is_admin) return true;
    const proxy = normalizeAddress(String(profile?.proxy_wallet_address || ""));
    return proxy === address;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin;
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
    if (!(await canAccessUserBalance(client, viewer, address))) {
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

    const row = data as UserBalanceRow | null;
    return successResponse({
      address,
      balance: String(row?.balance ?? "0"),
      reserved: String(row?.reserved ?? "0"),
    });
  } catch (e) {
    const error = e as Error;
    logApiError("GET /api/user-balance unhandled error", error);
    return ApiResponses.internalError(
      "Failed to fetch user balance",
      error?.message || String(error)
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) {
      if (process.env.NODE_ENV !== "production") {
        return successResponse({ address: null, balance: "0", reserved: "0" });
      }
      return ApiResponses.internalError("Supabase not configured");
    }

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) {
      return ApiResponses.unauthorized("未登录");
    }

    const ip = getIP(req);
    const rl = await checkRateLimit(
      `user_balance:sync:${viewer.toLowerCase()}:${ip || "unknown"}`,
      RateLimits.moderate,
      "user_balance_sync"
    );
    if (!rl.success) return ApiResponses.rateLimit("请求过于频繁，请稍后再试");

    const rawBody = await req.json().catch(() => ({}));
    const body = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>) : {};
    const address = normalizeAddress(String(body.address || body.userAddress || viewer || ""));
    if (!address) {
      return ApiResponses.badRequest("Invalid address");
    }

    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      return ApiResponses.badRequest("Invalid address");
    }

    if (!(await canAccessUserBalance(client, viewer, address))) {
      return ApiResponses.forbidden("无权限");
    }

    const configuredChainId = getConfiguredChainId();
    const chainIdRaw = body.chainId;
    const chainIdParsed =
      typeof chainIdRaw === "number"
        ? chainIdRaw
        : typeof chainIdRaw === "string"
          ? Number(chainIdRaw)
          : null;
    const chainId =
      typeof chainIdParsed === "number" && Number.isFinite(chainIdParsed)
        ? Math.trunc(chainIdParsed)
        : null;
    if (chainId != null && chainId !== configuredChainId) {
      return ApiResponses.badRequest("Invalid chainId");
    }

    const rpcUrl = getConfiguredRpcUrl(configuredChainId);
    const usdcAddress = getChainAddresses(configuredChainId).usdc || "";
    if (!ethers.isAddress(usdcAddress)) {
      return ApiResponses.internalError("USDC address not configured");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const token = new ethers.Contract(
      usdcAddress,
      ["function balanceOf(address) view returns (uint256)"],
      provider
    );
    const bal = BigInt(await token.balanceOf(address));
    const balance = ethers.formatUnits(bal, 6);

    const nowIso = new Date().toISOString();
    const { error } = await (client.from("user_balances") as any).upsert(
      { user_address: address, balance, updated_at: nowIso },
      { onConflict: "user_address" }
    );

    if (error) {
      if (process.env.NODE_ENV !== "production" && isMissingRelation(error)) {
        return successResponse({ address, balance: "0", reserved: "0" });
      }
      return ApiResponses.databaseError("Failed to sync user balance", error.message);
    }

    const { data: row, error: fetchErr } = await client
      .from("user_balances")
      .select("balance,reserved")
      .eq("user_address", address)
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      if (process.env.NODE_ENV !== "production" && isMissingRelation(fetchErr)) {
        return successResponse({ address, balance, reserved: "0" });
      }
      return ApiResponses.databaseError("Failed to fetch synced user balance", fetchErr.message);
    }

    const balanceRow = row as UserBalanceRow | null;
    return successResponse({
      address,
      balance: String(balanceRow?.balance ?? balance ?? "0"),
      reserved: String(balanceRow?.reserved ?? "0"),
    });
  } catch (e) {
    const error = e as Error;
    logApiError("POST /api/user-balance unhandled error", error);
    return ApiResponses.internalError(
      "Failed to sync user balance",
      error?.message || String(error)
    );
  }
}
