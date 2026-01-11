import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import {
  normalizeAddress,
  getSessionAddress,
  parseRequestBody,
  logApiError,
} from "@/lib/serverUtils";
import { Database } from "@/lib/database.types";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

function resolveEmailOtpSecret(): { secretString: string } {
  const raw = (process.env.JWT_SECRET || "").trim();
  if (raw) return { secretString: raw };
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing JWT_SECRET");
  }
  const fallback = "your-secret-key-change-in-production";
  return { secretString: fallback };
}

function hashEmailOtpCode(code: string, secretString: string): string {
  return createHash("sha256").update(`${code}:${secretString}`, "utf8").digest("hex");
}

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
      return ApiResponses.unauthorized("未认证或会话地址不匹配");
    }
    if (!isValidEmail(email)) {
      return ApiResponses.invalidParameters("邮箱格式不正确");
    }
    if (!/^\d{6}$/.test(code)) {
      return ApiResponses.invalidParameters("验证码格式不正确");
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
      return ApiResponses.invalidParameters("验证码未发送或已失效");
    }
    if (rec.lock_until && new Date(rec.lock_until).getTime() > nowMs) {
      const waitMin = Math.ceil((new Date(rec.lock_until).getTime() - nowMs) / 60000);
      return ApiResponses.rateLimit(`该邮箱已被锁定，请 ${waitMin} 分钟后重试`);
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
      return nextFail >= 3 ? ApiResponses.rateLimit(msg) : ApiResponses.invalidParameters(msg);
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
    return ApiResponses.internalError(
      "邮箱验证码验证失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
