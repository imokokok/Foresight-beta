import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse, errorResponse } from "@/lib/apiResponse";
import { ApiErrorCode } from "@/types/api";
import { createSession, markDeviceVerified, setStepUpCookie } from "@/lib/session";
import { verifyToken } from "@/lib/jwt";
import {
  logApiError,
  logApiEvent,
  normalizeAddress,
  parseRequestBody,
  getRequestId,
} from "@/lib/serverUtils";

function isValidEthAddress(addr: string) {
  return /^0x[a-f0-9]{40}$/.test(normalizeAddress(String(addr || "")));
}

function findMissingUserProfilesColumn(message: string): string | null {
  const msg = String(message || "");
  const m1 = msg.match(/could not find the '([^']+)' column of 'user_profiles'/i);
  if (m1 && m1[1]) return String(m1[1]);
  const m2 = msg.match(/column "?([a-z0-9_]+)"? of relation "?user_profiles"? does not exist/i);
  if (m2 && m2[1]) return String(m2[1]);
  return null;
}

async function upsertUserProfileWithColumnFallback(
  client: any,
  payload: Record<string, any>,
  options: { onConflict: string }
) {
  const removable = new Set([
    "proxy_wallet_type",
    "proxy_wallet_address",
    "embedded_wallet_provider",
    "embedded_wallet_address",
  ]);
  let lastError: any = null;
  for (let i = 0; i < 6; i++) {
    const { error } = await client.from("user_profiles").upsert(payload, options);
    if (!error) return { ok: true as const, error: null };
    lastError = error;
    const missing = findMissingUserProfilesColumn(String(error?.message || ""));
    if (missing && removable.has(missing) && missing in payload) {
      delete payload[missing];
      continue;
    }
    return { ok: false as const, error };
  }
  return { ok: false as const, error: lastError };
}

export async function POST(req: NextRequest) {
  try {
    const payload = await parseRequestBody(req);
    const signupToken = String(payload?.signupToken || "");
    const username = String(payload?.username || "").trim();

    if (!signupToken) {
      return errorResponse("Token is required", ApiErrorCode.INVALID_PARAMETERS, 400);
    }
    if (!username) {
      return errorResponse("用户名不能为空", ApiErrorCode.INVALID_PARAMETERS, 400);
    }
    // 简单的用户名校验
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return errorResponse(
        "用户名格式不正确（3-20位字母数字下划线）",
        ApiErrorCode.INVALID_PARAMETERS,
        400
      );
    }

    const decoded = await verifyToken(signupToken);
    if (!decoded || decoded.tokenType !== "signup") {
      return errorResponse("Invalid or expired signup token", ApiErrorCode.INVALID_PARAMETERS, 401);
    }

    const walletAddress = String(decoded.address || "");
    const email = String((decoded as any).email || "");

    if (!isValidEthAddress(walletAddress) || !email) {
      return errorResponse("Invalid token payload", ApiErrorCode.INVALID_PARAMETERS, 400);
    }

    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Missing service key");
    }
    const nowIso = new Date().toISOString();

    // 检查用户名是否重复
    const { data: usernameTaken, error: usernameTakenError } = await client
      .from("user_profiles")
      .select("wallet_address")
      .ilike("username", username)
      .limit(1);

    if (usernameTakenError) {
      return ApiResponses.databaseError("Failed to check username", usernameTakenError.message);
    }
    if (Array.isArray(usernameTaken) && usernameTaken.length > 0) {
      return ApiResponses.conflict("用户名已被占用");
    }

    const payloadRow: Record<string, any> = {
      wallet_address: walletAddress,
      email,
      username,
      proxy_wallet_type: "email",
      created_at: nowIso,
      updated_at: nowIso,
    };

    const createRes = await upsertUserProfileWithColumnFallback(client, payloadRow, {
      onConflict: "wallet_address",
    });

    if (!createRes.ok) {
      return ApiResponses.databaseError("Failed to create user profile", createRes.error?.message);
    }

    const res = successResponse({ ok: true, address: walletAddress, email }, "注册成功");
    await createSession(res, walletAddress, undefined, { req, authMethod: "email_otp" });
    await setStepUpCookie(res, walletAddress, undefined, { purpose: "login", req });
    await markDeviceVerified(req, walletAddress);

    try {
      await logApiEvent("email_login_new_user_created", {
        addr: walletAddress.slice(0, 8),
        emailDomain: email.split("@")[1] || "",
        requestId: getRequestId(req),
      });
    } catch {}

    return res;
  } catch (e: any) {
    logApiError("POST /api/email-otp/complete-signup unhandled error", e);
    return ApiResponses.internalError("Failed to complete signup", String(e?.message || e));
  }
}
