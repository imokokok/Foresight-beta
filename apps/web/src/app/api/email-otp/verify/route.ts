import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  normalizeAddress,
  getSessionAddress,
  parseRequestBody,
  logApiError,
} from "@/lib/serverUtils";
import { Database } from "@/lib/database.types";
import { ApiResponses, successResponse, errorResponse } from "@/lib/apiResponse";
import { isValidEmail, resolveEmailOtpSecret, hashEmailOtpCode } from "@/lib/otpUtils";
import { ApiErrorCode } from "@/types/api";

export async function POST(req: NextRequest) {
  try {
    const payload = await parseRequestBody(req);

    const email = String(payload?.email || "")
      .trim()
      .toLowerCase();
    const code = String(payload?.code || "").trim();
    const walletAddress = normalizeAddress(String(payload?.walletAddress || ""));

    const sessAddr = await getSessionAddress(req);
    if (!sessAddr || sessAddr !== walletAddress) {
      return errorResponse("未认证或会话地址不匹配", ApiErrorCode.UNAUTHORIZED, 401);
    }
    if (!isValidEmail(email)) {
      return errorResponse("邮箱格式不正确", ApiErrorCode.INVALID_PARAMETERS, 400);
    }
    if (!/^\d{6}$/.test(code)) {
      return errorResponse("验证码格式不正确", ApiErrorCode.INVALID_PARAMETERS, 400);
    }

    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Missing service key");

    const now = new Date();
    const nowMs = now.getTime();
    const { data: recRaw, error: fetchErr } = await client
      .from("email_otps")
      .select("wallet_address, email, code_hash, expires_at, fail_count, lock_until")
      .eq("wallet_address", walletAddress)
      .eq("email", email)
      .maybeSingle();
    if (fetchErr) {
      return ApiResponses.databaseError("Failed to fetch otp", fetchErr.message);
    }
    const rec = (recRaw || null) as Database["public"]["Tables"]["email_otps"]["Row"] | null;
    if (!rec) {
      return errorResponse("验证码未发送或已失效", ApiErrorCode.INVALID_PARAMETERS, 400, {
        reason: "OTP_NOT_FOUND",
      });
    }
    if (rec.lock_until && new Date(rec.lock_until).getTime() > nowMs) {
      const waitMin = Math.ceil((new Date(rec.lock_until).getTime() - nowMs) / 60000);
      return errorResponse(
        `该邮箱已被锁定，请 ${waitMin} 分钟后重试`,
        ApiErrorCode.RATE_LIMIT,
        429,
        { reason: "EMAIL_LOCKED", waitMinutes: waitMin }
      );
    }
    if (new Date(rec.expires_at).getTime() < nowMs) {
      return ApiResponses.invalidParameters("验证码已过期");
    }

    const inputHash = hashEmailOtpCode(code, resolveEmailOtpSecret().secretString);
    if (inputHash !== String(rec.code_hash || "")) {
      const nextFail = Number(rec.fail_count || 0) + 1;
      const nextLockUntil = nextFail >= 3 ? new Date(nowMs + 60 * 60_000).toISOString() : null;
      const { error: updErr } = await client
        .from("email_otps")
        .update({
          fail_count: nextFail,
          lock_until: nextLockUntil,
        } satisfies Database["public"]["Tables"]["email_otps"]["Update"])
        .eq("wallet_address", walletAddress)
        .eq("email", email);
      if (updErr) {
        return ApiResponses.databaseError("Failed to update otp", updErr.message);
      }
      const remain = Math.max(0, 3 - nextFail);
      const msg =
        remain > 0 ? `验证码不正确，剩余 ${remain} 次尝试` : "连续失败次数过多，已锁定 1 小时";
      return nextFail >= 3
        ? errorResponse(msg, ApiErrorCode.RATE_LIMIT, 429, {
            reason: "OTP_TOO_MANY_ATTEMPTS",
            remaining: remain,
          })
        : errorResponse(msg, ApiErrorCode.INVALID_PARAMETERS, 400, {
            reason: "OTP_INCORRECT",
            remaining: remain,
          });
    }

    // 通过验证：绑定邮箱到钱包地址
    const { error: upsertErr } = await client.from("user_profiles").upsert(
      {
        wallet_address: walletAddress,
        email,
      } as Database["public"]["Tables"]["user_profiles"]["Insert"],
      { onConflict: "wallet_address" }
    );
    if (upsertErr) {
      return ApiResponses.databaseError("Failed to bind email", upsertErr.message);
    }

    const { error: delErr } = await client
      .from("email_otps")
      .delete()
      .eq("wallet_address", walletAddress)
      .eq("email", email);
    if (delErr) {
      return ApiResponses.databaseError("Failed to clear otp", delErr.message);
    }

    const res = successResponse({ ok: true }, "验证成功");
    return res;
  } catch (e: any) {
    const detail = String(e?.message || e);
    logApiError("POST /api/email-otp/verify unhandled error", e);
    return errorResponse(
      "邮箱验证码验证失败",
      ApiErrorCode.INTERNAL_ERROR,
      500,
      process.env.NODE_ENV === "development" ? { error: detail } : undefined
    );
  }
}
