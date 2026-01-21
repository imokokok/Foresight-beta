import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import {
  normalizeAddress,
  getSessionAddress,
  isAdminAddress,
  logApiError,
  parseRequestBody,
} from "@/lib/serverUtils";
import { Database } from "@/lib/database.types";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";

function isEthAddress(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

function isValidUsername(name: string) {
  if (!name) return false;
  if (name.length < 3 || name.length > 20) return false;
  return /^\w+$/.test(name);
}

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Missing service key");
    const sess = await getSessionAddress(req);
    const viewer = normalizeAddress(String(sess || ""));
    const viewerIsAdmin = !!viewer && (isAdminAddress(viewer) || false);

    const { searchParams } = new URL(req.url);
    let address = normalizeAddress(String(searchParams.get("address") || ""));
    const addressesStr = String(searchParams.get("addresses") || "");
    const list = addressesStr
      .split(",")
      .map((s) => normalizeAddress(s.trim()))
      .filter((s) => s && isEthAddress(s))
      .slice(0, 200);

    if (list.length > 0) {
      const { data, error } = await client
        .from("user_profiles")
        .select(
          "wallet_address, username, email, is_admin, is_reviewer, proxy_wallet_address, proxy_wallet_type, embedded_wallet_provider, embedded_wallet_address"
        )
        .in("wallet_address", list);
      if (error) {
        return ApiResponses.databaseError("Failed to fetch profiles", error.message);
      }
      const rows = (data || []).map((p: Database["public"]["Tables"]["user_profiles"]["Row"]) => {
        const canViewSensitive =
          viewerIsAdmin || (viewer && normalizeAddress(p?.wallet_address || "") === viewer);
        return {
          ...p,
          proxy_wallet_address: canViewSensitive ? (p?.proxy_wallet_address ?? null) : null,
          proxy_wallet_type: canViewSensitive ? (p?.proxy_wallet_type ?? null) : null,
          embedded_wallet_provider: canViewSensitive ? (p?.embedded_wallet_provider ?? null) : null,
          embedded_wallet_address: canViewSensitive ? (p?.embedded_wallet_address ?? null) : null,
          email: canViewSensitive ? p?.email || "" : "",
          is_admin: !!p?.is_admin || isAdminAddress(p?.wallet_address || ""),
        };
      });
      return successResponse(
        {
          profile: null,
          profiles: rows,
        },
        "Profiles fetched successfully"
      );
    }

    if (!address) {
      address = viewer;
    }
    if (!address) {
      const emptyProfile = {
        wallet_address: "",
        username: "",
        email: "",
        is_admin: false,
        is_reviewer: false,
        proxy_wallet_address: null,
        proxy_wallet_type: null,
        embedded_wallet_provider: null,
        embedded_wallet_address: null,
      };
      return successResponse(
        {
          profile: emptyProfile,
          profiles: [],
        },
        "Anonymous profile"
      );
    }
    const { data: rawData, error } = await client
      .from("user_profiles")
      .select(
        "wallet_address, username, email, is_admin, is_reviewer, proxy_wallet_address, proxy_wallet_type, embedded_wallet_provider, embedded_wallet_address"
      )
      .eq("wallet_address", address)
      .maybeSingle();

    const data = rawData as Database["public"]["Tables"]["user_profiles"]["Row"] | null;

    if (error) {
      const fallback = {
        wallet_address: address,
        username: "",
        email: "",
        is_admin: isAdminAddress(address),
        is_reviewer: false,
        proxy_wallet_address: null,
        proxy_wallet_type: null,
        embedded_wallet_provider: null,
        embedded_wallet_address: null,
      };
      return successResponse(
        {
          profile: fallback,
          profiles: [],
        },
        "Profile not found, using fallback"
      );
    }
    const canViewSensitive = viewerIsAdmin || (viewer && address === viewer);
    const profile = data
      ? {
          ...data,
          proxy_wallet_address: canViewSensitive ? (data?.proxy_wallet_address ?? null) : null,
          proxy_wallet_type: canViewSensitive ? (data?.proxy_wallet_type ?? null) : null,
          embedded_wallet_provider: canViewSensitive
            ? (data?.embedded_wallet_provider ?? null)
            : null,
          embedded_wallet_address: canViewSensitive
            ? (data?.embedded_wallet_address ?? null)
            : null,
          email: canViewSensitive ? String(data?.email || "") : "",
          is_admin: !!data?.is_admin || isAdminAddress(address),
        }
      : {
          wallet_address: address,
          username: "",
          email: "",
          is_admin: isAdminAddress(address),
          is_reviewer: false,
          proxy_wallet_address: null,
          proxy_wallet_type: null,
          embedded_wallet_provider: null,
          embedded_wallet_address: null,
        };
    return successResponse(
      {
        profile,
        profiles: [],
      },
      "Profile fetched successfully"
    );
  } catch (e: any) {
    logApiError("GET /api/user-profiles unhandled error", e);
    return ApiResponses.internalError(
      "Failed to fetch profile",
      process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Missing service key");
    }
    const payload = await parseRequestBody(req);
    const walletAddress = normalizeAddress(String(payload?.walletAddress || ""));
    const username = String(payload?.username || "")
      .trim()
      .slice(0, 20);
    const email = String(payload?.email || "")
      .trim()
      .slice(0, 254);
    const remember = !!payload?.rememberMe;

    const sessAddr = await getSessionAddress(req);
    if (!sessAddr || sessAddr !== walletAddress) {
      return ApiResponses.unauthorized("Not authenticated or wallet address mismatch");
    }

    const ip = getIP(req);
    const rl = await checkRateLimit(
      `user_profiles:update:${walletAddress.toLowerCase()}:${ip || "unknown"}`,
      RateLimits.strict,
      "user_profiles_update"
    );
    if (!rl.success) return ApiResponses.rateLimit("操作过于频繁，请稍后再试");

    if (!isEthAddress(walletAddress)) {
      return ApiResponses.badRequest("Invalid wallet address");
    }
    if (!username || !email) {
      return ApiResponses.invalidParameters("Username and email are required");
    }
    if (!isValidEmail(email)) {
      return ApiResponses.badRequest("Invalid email format");
    }
    if (!isValidUsername(username)) {
      return ApiResponses.badRequest("Invalid username");
    }

    const { data: existing, error: existError } = await client
      .from("user_profiles")
      .select("wallet_address, username, email")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existError) {
      return ApiResponses.databaseError("Failed to fetch existing profile", existError.message);
    }
    if (!existing) {
      return ApiResponses.invalidParameters("请先完成邮箱验证");
    }
    if (String(existing?.email || "").trim() !== email) {
      return ApiResponses.forbidden("邮箱未验证或不匹配");
    }
    const { data: usernameTaken, error: usernameTakenError } = await client
      .from("user_profiles")
      .select("wallet_address")
      .ilike("username", username)
      .neq("wallet_address", walletAddress)
      .limit(1);
    if (usernameTakenError) {
      return ApiResponses.databaseError("Failed to check username", usernameTakenError.message);
    }
    if (Array.isArray(usernameTaken) && usernameTaken.length > 0) {
      return ApiResponses.conflict("用户名已被占用");
    }
    const { error: updError } = await client
      .from("user_profiles")
      .update({ username } as Database["public"]["Tables"]["user_profiles"]["Update"])
      .eq("wallet_address", walletAddress);
    if (updError) {
      return ApiResponses.databaseError("Failed to update profile", updError.message);
    }

    const res = successResponse({ ok: true }, "Profile saved successfully");
    if (remember) {
      res.cookies.set("fs_remember", "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  } catch (e: any) {
    logApiError("POST /api/user-profiles unhandled error", e);
    return ApiResponses.internalError(
      "Failed to save profile",
      process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
    );
  }
}
