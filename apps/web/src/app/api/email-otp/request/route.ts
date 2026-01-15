import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { Database } from "@/lib/database.types";
import {
  normalizeAddress,
  getSessionAddress,
  parseRequestBody,
  logApiError,
  logApiEvent,
  getRequestId,
} from "@/lib/serverUtils";
import { ApiResponses, successResponse, errorResponse } from "@/lib/apiResponse";
import { ApiErrorCode } from "@/types/api";
import { sendMailSMTP } from "@/lib/emailService";
import { isValidEmail, genCode, resolveEmailOtpSecret, hashEmailOtpCode } from "@/lib/otpUtils";
import { checkRateLimit, RateLimits, getIP } from "@/lib/rateLimit";
import { verifyToken } from "@/lib/jwt";
import { getFeatureFlags } from "@/lib/runtimeConfig";

const EMAIL_CHANGE_COOKIE_NAME = "fs_email_change";

function isValidEthAddress(addr: string) {
  return /^0x[a-f0-9]{40}$/.test(normalizeAddress(String(addr || "")));
}

function deriveDeterministicAddressFromEmail(email: string, secretString: string) {
  const h = createHash("sha256")
    .update(`email-login:${email}:${secretString}`, "utf8")
    .digest("hex");
  return normalizeAddress(`0x${h.slice(0, 40)}`);
}

const SQL_CREATE_EMAIL_OTPS_TABLE = `
CREATE TABLE IF NOT EXISTS public.email_otps (
  wallet_address TEXT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_window_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_in_window INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  lock_until TIMESTAMPTZ,
  created_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet_address, email)
);

ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
`.trim();

function isMissingEmailOtpsTable(error?: { message?: string | null; code?: string | null }) {
  const msg = String(error?.message || "").toLowerCase();
  if (!msg) return false;
  return (
    (msg.includes("relation") && msg.includes("email_otps") && msg.includes("does not exist")) ||
    (msg.includes("could not find the table") && msg.includes("email_otps"))
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!getFeatureFlags().embedded_auth_enabled) {
      return ApiResponses.forbidden("邮箱登录已关闭");
    }
    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Missing service key");
    const payload = await parseRequestBody(req);

    const email = String(payload?.email || "")
      .trim()
      .toLowerCase();
    const walletAddressRaw = String(payload?.walletAddress || "");
    const walletAddress = normalizeAddress(walletAddressRaw);
    const requestedMode = typeof payload?.mode === "string" ? String(payload.mode) : "";
    const mode: "login" | "bind" | "change_old" | "change_new" =
      requestedMode === "login" ||
      requestedMode === "bind" ||
      requestedMode === "change_old" ||
      requestedMode === "change_new"
        ? (requestedMode as any)
        : isValidEthAddress(walletAddress)
          ? "bind"
          : "login";
    const secretString = resolveEmailOtpSecret().secretString;
    const walletKey =
      mode === "login" ? deriveDeterministicAddressFromEmail(email, secretString) : walletAddress;

    if (mode === "bind" || mode === "change_old" || mode === "change_new") {
      const sessAddr = await getSessionAddress(req);
      if (!sessAddr || sessAddr !== walletAddress) {
        return errorResponse("未认证或会话地址不匹配", ApiErrorCode.UNAUTHORIZED, 401);
      }
      if (!isValidEthAddress(walletAddress)) {
        return ApiResponses.invalidParameters("钱包地址无效");
      }
    }
    if (!isValidEmail(email)) {
      return errorResponse("邮箱格式不正确", ApiErrorCode.INVALID_PARAMETERS, 400);
    }

    if (mode === "change_old" || mode === "change_new") {
      const { data: prof, error: profErr } = await client
        .from("user_profiles")
        .select("email")
        .eq("wallet_address", walletAddress)
        .maybeSingle();
      if (profErr) {
        return ApiResponses.databaseError("Failed to load user profile", profErr.message);
      }
      const currentEmail = String((prof as any)?.email || "")
        .trim()
        .toLowerCase();
      if (!currentEmail) {
        return errorResponse("请先完成邮箱验证", ApiErrorCode.INVALID_PARAMETERS, 400);
      }

      if (mode === "change_old") {
        if (email !== currentEmail) {
          return errorResponse("邮箱不匹配", ApiErrorCode.FORBIDDEN, 403);
        }
      }

      if (mode === "change_new") {
        const raw = req.cookies.get(EMAIL_CHANGE_COOKIE_NAME)?.value || "";
        const cookiePayload = raw ? await verifyToken(raw) : null;
        const cookieAddr = typeof cookiePayload?.address === "string" ? cookiePayload.address : "";
        const tokenType =
          typeof (cookiePayload as any)?.tokenType === "string"
            ? String((cookiePayload as any).tokenType)
            : "";
        const oldEmail =
          typeof (cookiePayload as any)?.ecOldEmail === "string"
            ? String((cookiePayload as any).ecOldEmail)
            : "";
        const stage =
          typeof (cookiePayload as any)?.ecStage === "string"
            ? String((cookiePayload as any).ecStage)
            : "";

        if (!cookiePayload || tokenType !== "email_change" || stage !== "old_verified") {
          return errorResponse("请先验证当前邮箱", ApiErrorCode.INVALID_PARAMETERS, 400);
        }
        if (!cookieAddr || cookieAddr.toLowerCase() !== walletAddress.toLowerCase()) {
          return errorResponse("请先验证当前邮箱", ApiErrorCode.INVALID_PARAMETERS, 400);
        }
        if (!oldEmail || oldEmail.toLowerCase() !== currentEmail.toLowerCase()) {
          return errorResponse("请先验证当前邮箱", ApiErrorCode.INVALID_PARAMETERS, 400);
        }
        if (email === currentEmail) {
          return errorResponse("新邮箱不能与当前邮箱相同", ApiErrorCode.INVALID_PARAMETERS, 400);
        }
      }
    }

    const ip = getIP(req);
    const reqId = getRequestId(req);
    const rlKey = `${walletKey || "unknown"}:${ip || "unknown"}`;
    const rl = await checkRateLimit(rlKey, RateLimits.strict, "email-otp-request");
    if (!rl.success) {
      const waitSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      try {
        await logApiEvent("email_login_rate_limited", {
          reason: "GLOBAL_RL_UPSTASH",
          addr: walletKey ? walletKey.slice(0, 8) : "",
          emailDomain: email.split("@")[1] || "",
          resetAt: rl.resetAt,
          waitSeconds: waitSec,
          requestId: reqId || undefined,
        });
      } catch {}
      return errorResponse(`请求过于频繁，请 ${waitSec} 秒后重试`, ApiErrorCode.RATE_LIMIT, 429, {
        reason: "GLOBAL_RL_UPSTASH",
        resetAt: rl.resetAt,
        waitSeconds: waitSec,
      });
    }

    const now = new Date();
    const nowMs = now.getTime();

    // 1. Global Rate Limit (Per Wallet)
    const { data: allWalletOtps, error: fetchAllErr } = await client
      .from("email_otps")
      .select("last_sent_at, sent_in_window")
      .eq("wallet_address", walletKey);

    if (fetchAllErr) {
      if (isMissingEmailOtpsTable(fetchAllErr)) {
        return ApiResponses.databaseError("邮箱验证码未初始化：缺少 email_otps 表", {
          setupRequired: true,
          sql: SQL_CREATE_EMAIL_OTPS_TABLE,
          detail: fetchAllErr.message,
        });
      }
      return ApiResponses.databaseError("Failed to fetch wallet otps", fetchAllErr.message);
    }

    const minIntervalMs = 60_000;
    let globalLastSentMs = 0;
    let activeEmailsInWindow = 0;
    const rateWindowMs = 60 * 60_000;

    if (allWalletOtps && Array.isArray(allWalletOtps)) {
      for (const r of allWalletOtps) {
        const t = r.last_sent_at ? new Date(r.last_sent_at).getTime() : 0;
        if (t > globalLastSentMs) {
          globalLastSentMs = t;
        }
        if (nowMs - t < rateWindowMs) {
          activeEmailsInWindow++;
        }
      }
    }

    if (globalLastSentMs && nowMs - globalLastSentMs < minIntervalMs) {
      const waitSec = Math.ceil((minIntervalMs - (nowMs - globalLastSentMs)) / 1000);
      try {
        await logApiEvent("email_login_rate_limited", {
          reason: "GLOBAL_MIN_INTERVAL",
          addr: walletKey ? walletKey.slice(0, 8) : "",
          emailDomain: email.split("@")[1] || "",
          waitSeconds: waitSec,
          requestId: reqId || undefined,
        });
      } catch {}
      return errorResponse(`请求过于频繁，请 ${waitSec} 秒后重试`, ApiErrorCode.RATE_LIMIT, 429, {
        reason: "GLOBAL_MIN_INTERVAL",
        waitSeconds: waitSec,
      });
    }

    const ipWindowMs = 10 * 60_000;
    const maxIpRequests = 30;
    if (ip) {
      const { data: ipRows, error: ipErr } = await client
        .from("email_otps")
        .select("last_sent_at, created_ip")
        .eq("created_ip", ip);
      if (ipErr) {
        if (isMissingEmailOtpsTable(ipErr)) {
          return ApiResponses.databaseError("邮箱验证码未初始化：缺少 email_otps 表", {
            setupRequired: true,
            sql: SQL_CREATE_EMAIL_OTPS_TABLE,
            detail: ipErr.message,
          });
        }
        return ApiResponses.databaseError("Failed to check ip rate limit", ipErr.message);
      }
      const rows = Array.isArray(ipRows) ? ipRows : [];
      let ipCount = 0;
      for (const r of rows) {
        const t = r.last_sent_at ? new Date(r.last_sent_at).getTime() : 0;
        if (t && nowMs - t <= ipWindowMs) {
          ipCount++;
        }
      }
      if (ipCount >= maxIpRequests) {
        try {
          await logApiEvent("email_login_rate_limited", {
            reason: "IP_RATE_LIMIT",
            addr: walletKey ? walletKey.slice(0, 8) : "",
            emailDomain: email.split("@")[1] || "",
            windowMinutes: ipWindowMs / 60000,
            requestId: reqId || undefined,
          });
        } catch {}
        return errorResponse("当前 IP 请求过于频繁，请稍后重试", ApiErrorCode.RATE_LIMIT, 429, {
          reason: "IP_RATE_LIMIT",
          windowMinutes: ipWindowMs / 60000,
        });
      }
    }

    // Limit number of distinct emails targeted in the last hour
    const maxEmailsInWindow = 10;
    if (activeEmailsInWindow >= maxEmailsInWindow) {
      // Check if we are retrying an existing active email (which is allowed under this limit, but caught by per-email limit)
      // Actually, if we are updating an existing one, the count doesn't increase.
      // But we haven't fetched the specific record yet.
      // If we are adding a NEW email, count increases.
      // Let's rely on the count of rows logic.
    }

    // 2. Specific Email Logic
    const { data: existing, error: fetchErr } = await client
      .from("email_otps")
      .select(
        "wallet_address, email, expires_at, last_sent_at, sent_window_start_at, sent_in_window, fail_count, lock_until"
      )
      .eq("wallet_address", walletKey)
      .eq("email", email)
      .maybeSingle();
    if (fetchErr) {
      if (isMissingEmailOtpsTable(fetchErr)) {
        return ApiResponses.databaseError("邮箱验证码未初始化：缺少 email_otps 表", {
          setupRequired: true,
          sql: SQL_CREATE_EMAIL_OTPS_TABLE,
          detail: fetchErr.message,
        });
      }
      return ApiResponses.databaseError("Failed to fetch otp", fetchErr.message);
    }

    const rec = (existing || null) as Database["public"]["Tables"]["email_otps"]["Row"] | null;

    if (!rec && activeEmailsInWindow >= maxEmailsInWindow) {
      try {
        await logApiEvent("email_login_rate_limited", {
          reason: "TOO_MANY_DISTINCT_EMAILS",
          addr: walletKey ? walletKey.slice(0, 8) : "",
          emailDomain: email.split("@")[1] || "",
          requestId: reqId || undefined,
        });
      } catch {}
      return errorResponse("近期请求的邮箱数量过多，请稍后重试", ApiErrorCode.RATE_LIMIT, 429, {
        reason: "TOO_MANY_DISTINCT_EMAILS",
      });
    }

    if (rec?.lock_until && new Date(rec.lock_until).getTime() > nowMs) {
      const waitMin = Math.ceil((new Date(rec.lock_until).getTime() - nowMs) / 60000);
      try {
        await logApiEvent("email_login_locked", {
          reason: "EMAIL_LOCKED",
          addr: walletKey ? walletKey.slice(0, 8) : "",
          emailDomain: email.split("@")[1] || "",
          waitMinutes: waitMin,
          requestId: reqId || undefined,
        });
      } catch {}
      return errorResponse(
        `该邮箱已被锁定，请 ${waitMin} 分钟后重试`,
        ApiErrorCode.RATE_LIMIT,
        429,
        { reason: "EMAIL_LOCKED", waitMinutes: waitMin }
      );
    }

    // Per-email frequency limit (redundant with global if sending to same email, but good to keep)
    // Actually global check covers the "too fast" part.
    // We just need to check the "max retries per hour" part for this email.

    const sentWindowStartAtMs = rec?.sent_window_start_at
      ? new Date(rec.sent_window_start_at).getTime()
      : 0;
    const sentInWindow = Number(rec?.sent_in_window || 0);
    const maxInWindow = 5;

    const windowReset = !sentWindowStartAtMs || nowMs - sentWindowStartAtMs >= rateWindowMs;
    const nextWindowStartAt = windowReset ? now : new Date(sentWindowStartAtMs);
    const nextSentInWindow = (windowReset ? 0 : sentInWindow) + 1;
    if (nextSentInWindow > maxInWindow) {
      try {
        await logApiEvent("email_login_rate_limited", {
          reason: "EMAIL_TOO_FREQUENT",
          addr: walletKey ? walletKey.slice(0, 8) : "",
          emailDomain: email.split("@")[1] || "",
          windowMinutes: rateWindowMs / 60000,
          requestId: reqId || undefined,
        });
      } catch {}
      return errorResponse("该邮箱请求过于频繁，请稍后重试", ApiErrorCode.RATE_LIMIT, 429, {
        reason: "EMAIL_TOO_FREQUENT",
        windowMinutes: rateWindowMs / 60000,
      });
    }

    const code = genCode();
    const expiresAt = new Date(nowMs + 15 * 60_000);
    const codeHash = hashEmailOtpCode(code, secretString);
    const otpRow: Database["public"]["Tables"]["email_otps"]["Insert"] = {
      wallet_address: walletKey,
      email,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
      last_sent_at: now.toISOString(),
      sent_window_start_at: nextWindowStartAt.toISOString(),
      sent_in_window: nextSentInWindow,
      fail_count: 0,
      lock_until: null,
      created_ip: ip || null,
    };

    const { error: upsertErr } = await client
      .from("email_otps")
      .upsert(otpRow, { onConflict: "wallet_address,email" });
    if (upsertErr) {
      if (isMissingEmailOtpsTable(upsertErr)) {
        return ApiResponses.databaseError("邮箱验证码未初始化：缺少 email_otps 表", {
          setupRequired: true,
          sql: SQL_CREATE_EMAIL_OTPS_TABLE,
          detail: upsertErr.message,
        });
      }
      return ApiResponses.databaseError("Failed to store otp", upsertErr.message);
    }

    try {
      await sendMailSMTP(email, code);
      try {
        await logApiEvent("email_login_requested", {
          channel: "otp",
          mode,
          addr: walletKey ? walletKey.slice(0, 8) : "",
          emailDomain: email.split("@")[1] || "",
          requestId: reqId || undefined,
        });
      } catch {}
      const res = successResponse({ expiresInSec: 900 }, "验证码已发送");
      return res;
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      try {
        const smtpUrl = (process.env.SMTP_URL || "").trim();
        const host = process.env.SMTP_HOST || "";
        const port = Number(process.env.SMTP_PORT || 0);
        const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
        const user = process.env.SMTP_USER || "";
        const maskedUser = user ? user.replace(/(^.).*(?=@)/, "$1***") : "";
        const maskedUrl = smtpUrl ? smtpUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@") : "";
        console.error("[email-otp] SMTP send error", {
          email,
          address: walletAddress,
          url: maskedUrl,
          host,
          port,
          secure,
          user: maskedUser,
          error: errMessage,
        });
      } catch {}
      const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
      if (!isDev) {
        try {
          await client
            .from("email_otps")
            .delete()
            .eq("wallet_address", walletKey)
            .eq("email", email);
        } catch {}
      }
      if (isDev) {
        try {
          await logApiEvent("email_login_requested", {
            channel: "otp",
            mode,
            hasSmtp: false,
            addr: walletKey ? walletKey.slice(0, 8) : "",
            emailDomain: email.split("@")[1] || "",
            requestId: reqId || undefined,
          });
        } catch {}
        const res = successResponse(
          {
            codePreview: code,
            expiresInSec: 900,
          },
          "开发环境：邮件发送失败，已直接返回验证码"
        );
        return res;
      }
      return errorResponse("邮件发送失败", ApiErrorCode.INTERNAL_ERROR, 500, {
        reason: "SMTP_FAILED",
        error: errMessage,
      });
    }
  } catch (e: unknown) {
    logApiError("POST /api/email-otp/request", e);
    const message = e instanceof Error ? e.message : String(e);
    return errorResponse("邮箱验证码请求失败", ApiErrorCode.INTERNAL_ERROR, 500, {
      error: message,
    });
  }
}
