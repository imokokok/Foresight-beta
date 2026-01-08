import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getEmailOtpShared,
  normalizeAddress,
  getSessionAddress,
  LogItem,
  parseRequestBody,
  logApiError,
} from "@/lib/serverUtils";
import { Database } from "@/lib/database.types";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const { store, logs } = getEmailOtpShared();
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

    const rec = store.get(email);
    const now = Date.now();
    if (!rec) {
      return ApiResponses.invalidParameters("验证码未发送或已失效");
    }
    if (rec.lockUntil && now < rec.lockUntil) {
      const waitMin = Math.ceil((rec.lockUntil - now) / 60000);
      return ApiResponses.rateLimit(`该邮箱已被锁定，请 ${waitMin} 分钟后重试`);
    }
    if (now > rec.expiresAt) {
      return ApiResponses.invalidParameters("验证码已过期");
    }
    if (code !== rec.code) {
      rec.failCount = (rec.failCount || 0) + 1;
      if (rec.failCount >= 3) {
        rec.lockUntil = now + 60 * 60_000;
      }
      store.set(email, rec);
      const remain = Math.max(0, 3 - rec.failCount);
      const msg =
        remain > 0 ? `验证码不正确，剩余 ${remain} 次尝试` : "连续失败次数过多，已锁定 1 小时";
      return ApiResponses.invalidParameters(msg);
    }

    // 通过验证：绑定邮箱到钱包地址
    const client = supabaseAdmin as any;
    if (client) {
      const { data: existing } = await client
        .from("user_profiles")
        .select("wallet_address, email")
        .eq("wallet_address", walletAddress)
        .maybeSingle();
      if (!existing) {
        await client.from("user_profiles").insert({
          wallet_address: walletAddress,
          email,
        } as Database["public"]["Tables"]["user_profiles"]["Insert"]);
      } else {
        await client
          .from("user_profiles")
          .update({ email } as Database["public"]["Tables"]["user_profiles"]["Update"])
          .eq("wallet_address", walletAddress);
      }
    }

    // 审计记录（内存）：时间戳与 IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    console.log(
      `[email-otp] verified email=${email} addr=${walletAddress} ip=${ip} at=${new Date().toISOString()}`
    );
    try {
      logs.push({
        email,
        address: walletAddress,
        status: "verified",
        sentAt: Date.now(),
      } as LogItem);
      if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    } catch (e) {
      logApiError("[email-otp] push verified log failed", e);
    }

    // 清理使用过的记录
    store.delete(email);

    return successResponse({ ok: true }, "验证成功");
  } catch (e: any) {
    const detail = String(e?.message || e);
    logApiError("POST /api/email-otp/verify unhandled error", e);
    return ApiResponses.internalError("邮箱验证码验证失败", detail);
  }
}
