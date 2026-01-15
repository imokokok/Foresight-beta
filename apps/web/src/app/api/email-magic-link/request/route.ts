import { NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase.server";
import { Database } from "@/lib/database.types";
import { ApiResponses, successResponse, errorResponse } from "@/lib/apiResponse";
import { ApiErrorCode } from "@/types/api";
import {
  getRequestId,
  logApiError,
  logApiEvent,
  normalizeAddress,
  parseRequestBody,
} from "@/lib/serverUtils";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { genCode, hashEmailOtpCode, isValidEmail, resolveEmailOtpSecret } from "@/lib/otpUtils";
import { getFeatureFlags } from "@/lib/runtimeConfig";

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

let cachedSmtpTransporter: any | null = null;
let cachedSmtpKey = "";

function computeSmtpKey() {
  const smtpUrl = (process.env.SMTP_URL || "").trim();
  const host = process.env.SMTP_HOST || "";
  const port = String(process.env.SMTP_PORT || "");
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase();
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || "";
  const pool = String(process.env.SMTP_POOL || "");
  const maxConnections = String(process.env.SMTP_POOL_MAX_CONNECTIONS || "");
  const maxMessages = String(process.env.SMTP_POOL_MAX_MESSAGES || "");
  const connectionTimeoutMs = String(process.env.SMTP_CONNECTION_TIMEOUT_MS || "");
  const greetingTimeoutMs = String(process.env.SMTP_GREETING_TIMEOUT_MS || "");
  const socketTimeoutMs = String(process.env.SMTP_SOCKET_TIMEOUT_MS || "");
  const raw = `${smtpUrl}|${host}|${port}|${secure}|${user}|${pass}|${from}|${pool}|${maxConnections}|${maxMessages}|${connectionTimeoutMs}|${greetingTimeoutMs}|${socketTimeoutMs}`;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function getMissingSmtpEnv(params: {
  smtpUrl: string;
  host: string;
  port: number;
  user: string;
  pass: string;
}) {
  if (params.smtpUrl.trim()) return [];
  const missing: string[] = [];
  if (!params.host.trim()) missing.push("SMTP_HOST");
  if (!Number.isFinite(params.port) || params.port <= 0) missing.push("SMTP_PORT");
  if (!params.user.trim()) missing.push("SMTP_USER");
  if (!params.pass.trim()) missing.push("SMTP_PASS");
  return missing;
}

function isRetryableSmtpError(err: unknown) {
  const e = err as any;
  const code = typeof e?.code === "string" ? e.code : "";
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EPIPE" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }
  const responseCode = typeof e?.responseCode === "number" ? e.responseCode : 0;
  if ([421, 450, 451, 452, 454].includes(responseCode)) return true;
  const message = typeof e?.message === "string" ? e.message : "";
  if (/timeout|timed out|Connection closed|read ECONNRESET/i.test(message)) return true;
  return false;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getSmtpTransporter() {
  const key = computeSmtpKey();
  if (cachedSmtpTransporter && cachedSmtpKey === key) return cachedSmtpTransporter;

  const smtpUrl = (process.env.SMTP_URL || "").trim();
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const missing = getMissingSmtpEnv({ smtpUrl, host, port, user, pass });
  if (missing.length) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`SMTP 未配置完整：缺少 ${missing.join(", ")}`);
    }
    cachedSmtpTransporter = null;
    cachedSmtpKey = key;
    return null;
  }

  const pool = String(process.env.SMTP_POOL || "").toLowerCase() !== "false";
  const maxConnections = Math.max(
    1,
    Math.min(20, Number(process.env.SMTP_POOL_MAX_CONNECTIONS || 5))
  );
  const maxMessages = Math.max(
    1,
    Math.min(1000, Number(process.env.SMTP_POOL_MAX_MESSAGES || 100))
  );
  const connectionTimeout = Math.max(
    1000,
    Math.min(120_000, Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10_000))
  );
  const greetingTimeout = Math.max(
    1000,
    Math.min(120_000, Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10_000))
  );
  const socketTimeout = Math.max(
    1000,
    Math.min(300_000, Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20_000))
  );

  const nodemailerMod = (await import("nodemailer")) as typeof import("nodemailer");
  const transporter = smtpUrl
    ? nodemailerMod.createTransport(smtpUrl, {
        pool,
        maxConnections,
        maxMessages,
        connectionTimeout,
        greetingTimeout,
        socketTimeout,
      } as any)
    : nodemailerMod.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        pool,
        maxConnections,
        maxMessages,
        connectionTimeout,
        greetingTimeout,
        socketTimeout,
      } as any);

  cachedSmtpTransporter = transporter;
  cachedSmtpKey = key;
  return transporter;
}

async function sendMailSMTP(params: { email: string; loginUrl: string; code: string }) {
  const from = process.env.SMTP_FROM || "noreply@localhost";
  const transporter = await getSmtpTransporter();
  if (!transporter) return "";
  const subject = "登录 Foresight";
  const safeUrl = params.loginUrl.replace(/"/g, "%22");
  const html = `<div style="font-family:system-ui,Segoe UI,Arial;line-height:1.5"><p>点击按钮一键登录：</p><p><a href="${safeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px">一键登录</a></p><p>若按钮不可用，可在页面输入验证码：<b>${params.code}</b>（15分钟内有效）。</p><p>如非本人操作请忽略。</p></div>`;
  const text = `一键登录：${params.loginUrl}\n验证码：${params.code}（15分钟内有效）。如非本人操作请忽略。`;
  const maxAttempts = Math.max(1, Math.min(5, Number(process.env.SMTP_SEND_MAX_ATTEMPTS || 2)));
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await transporter.sendMail({
        from,
        to: params.email,
        subject,
        text,
        html,
      });
      const messageId =
        typeof (info as { messageId?: unknown }).messageId === "string"
          ? (info as { messageId: string }).messageId
          : "";
      return String(messageId || "");
    } catch (err: unknown) {
      lastErr = err;
      if (attempt >= maxAttempts || !isRetryableSmtpError(err)) break;
      const baseDelay = Math.max(
        50,
        Math.min(5000, Number(process.env.SMTP_SEND_RETRY_BASE_DELAY_MS || 250))
      );
      const delay = Math.min(10_000, baseDelay * Math.pow(2, attempt - 1));
      await sleep(delay);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function resolveBaseUrl(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (base) return base.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");
  return "http://localhost:3000";
}

function hashMagicToken(token: string, secret: string) {
  return createHash("sha256").update(`${token}:${secret}`, "utf8").digest("hex");
}

function resolveMagicSecret() {
  const raw = (process.env.MAGIC_LINK_SECRET || process.env.JWT_SECRET || "").trim();
  if (raw) return raw;
  if (process.env.NODE_ENV === "production") throw new Error("Missing MAGIC_LINK_SECRET");
  return "dev-magic-link-secret";
}

function generateToken() {
  return randomBytes(32).toString("base64url");
}

function sanitizeRedirect(raw: unknown) {
  const redirectRaw = typeof raw === "string" ? raw.trim() : "";
  if (!redirectRaw) return "";
  if (redirectRaw.length > 2048) return "";
  if (!redirectRaw.startsWith("/")) return "";
  if (redirectRaw.startsWith("//")) return "";
  if (redirectRaw.includes("://")) return "";
  return redirectRaw;
}

function isValidEthAddress(addr: string) {
  return /^0x[a-f0-9]{40}$/.test(normalizeAddress(String(addr || "")));
}

function deriveDeterministicAddressFromEmail(email: string, secretString: string) {
  const h = createHash("sha256")
    .update(`email-login:${email}:${secretString}`, "utf8")
    .digest("hex");
  return normalizeAddress(`0x${h.slice(0, 40)}`);
}

export async function POST(req: NextRequest) {
  try {
    if (!getFeatureFlags().embedded_auth_enabled) {
      return ApiResponses.forbidden("邮箱登录已关闭");
    }
    const payload = await parseRequestBody(req);
    const email = String(payload?.email || "")
      .trim()
      .toLowerCase();

    if (!isValidEmail(email)) {
      return ApiResponses.invalidParameters("邮箱格式不正确");
    }

    const baseUrl = resolveBaseUrl(req);
    const redirect = sanitizeRedirect(payload?.redirect);

    const token = generateToken();
    const tokenHash = hashMagicToken(token, resolveMagicSecret());
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const expiresAtIso = expiresAt.toISOString();
    const ua = req.headers.get("user-agent") || "";

    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const ip = getIP(req);
    const reqId = getRequestId(req);
    const now = new Date();
    const nowMs = now.getTime();
    const secretString = resolveEmailOtpSecret().secretString;
    const walletKey = deriveDeterministicAddressFromEmail(email, secretString);

    if (!walletKey || !isValidEthAddress(walletKey)) {
      return ApiResponses.internalError("无法生成登录标识");
    }

    const rlKey = `${walletKey || "unknown"}:${ip || "unknown"}`;
    const rl = await checkRateLimit(rlKey, RateLimits.strict, "email-magic-link-request");
    if (!rl.success) {
      const waitSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      try {
        await logApiEvent("email_login_rate_limited", {
          reason: "GLOBAL_RL_UPSTASH",
          addr: walletKey ? walletKey.slice(0, 8) : "",
          emailDomain: email.split("@")[1] || "",
          resetAt: rl.resetAt,
          requestId: reqId || undefined,
        });
      } catch {}
      return errorResponse(`请求过于频繁，请 ${waitSec} 秒后重试`, ApiErrorCode.RATE_LIMIT, 429, {
        reason: "GLOBAL_RL_UPSTASH",
        resetAt: rl.resetAt,
        waitSeconds: waitSec,
      });
    }

    const { data: allWalletOtps, error: fetchAllErr } = await client
      .from("email_otps")
      .select("last_sent_at, sent_in_window")
      .eq("wallet_address", walletKey);
    if (fetchAllErr) {
      if (isMissingEmailOtpsTable(fetchAllErr)) {
        return ApiResponses.databaseError("邮箱登录未初始化：缺少 email_otps 表", {
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
          return ApiResponses.databaseError("邮箱登录未初始化：缺少 email_otps 表", {
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

    const maxEmailsInWindow = 10;

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
        return ApiResponses.databaseError("邮箱登录未初始化：缺少 email_otps 表", {
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
        await logApiEvent("email_login_rate_limited", {
          reason: "EMAIL_LOCKED",
          addr: walletKey ? walletKey.slice(0, 8) : "",
          emailDomain: email.split("@")[1] || "",
          waitMinutes: waitMin,
          requestId: reqId || undefined,
        });
      } catch {}
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

    try {
      const { data: stale, error: staleErr } = await client
        .from("email_login_tokens")
        .select("id")
        .lt("expires_at", now.toISOString())
        .limit(200);
      const list = Array.isArray(stale) ? stale : [];
      if (!staleErr && list.length) {
        await client
          .from("email_login_tokens")
          .delete()
          .in(
            "id",
            list.map((r: any) => Number(r?.id)).filter((id: any) => Number.isFinite(id))
          );
      }
    } catch {}

    try {
      await client
        .from("email_login_tokens")
        .delete()
        .eq("email", email)
        .lt("expires_at", now.toISOString());
    } catch {}

    try {
      await client
        .from("email_otps")
        .delete()
        .eq("wallet_address", walletKey)
        .eq("email", email)
        .lt("expires_at", now.toISOString());
    } catch {}

    const { error: insertErr } = await client.from("email_login_tokens").insert({
      email,
      token_hash: tokenHash,
      expires_at: expiresAtIso,
      created_ip: ip ? String(ip) : null,
      created_ua: ua || null,
    });
    if (insertErr)
      return ApiResponses.databaseError("Failed to create login token", insertErr.message);

    const code = genCode();
    const codeHash = hashEmailOtpCode(code, secretString);
    const otpRow: Database["public"]["Tables"]["email_otps"]["Insert"] = {
      wallet_address: walletKey,
      email,
      code_hash: codeHash,
      expires_at: new Date(nowMs + 15 * 60_000).toISOString(),
      last_sent_at: now.toISOString(),
      sent_window_start_at: nextWindowStartAt.toISOString(),
      sent_in_window: nextSentInWindow,
      fail_count: 0,
      lock_until: null,
      created_ip: ip ? String(ip) : null,
    };

    const { error: upsertErr } = await client
      .from("email_otps")
      .upsert(otpRow, { onConflict: "wallet_address,email" });
    if (upsertErr) {
      if (isMissingEmailOtpsTable(upsertErr)) {
        return ApiResponses.databaseError("邮箱登录未初始化：缺少 email_otps 表", {
          setupRequired: true,
          sql: SQL_CREATE_EMAIL_OTPS_TABLE,
          detail: upsertErr.message,
        });
      }
      return ApiResponses.databaseError("Failed to store otp", upsertErr.message);
    }

    const loginUrlParams = new URLSearchParams();
    loginUrlParams.set("token", token);
    if (redirect) {
      loginUrlParams.set("redirect", redirect);
    }
    const loginUrl = `${baseUrl}/login/callback?${loginUrlParams.toString()}`;

    const smtpUrl = (process.env.SMTP_URL || "").trim();
    const smtpHost = process.env.SMTP_HOST || "";
    const smtpPort = Number(process.env.SMTP_PORT || 0);
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    const smtpMissingEnv = getMissingSmtpEnv({
      smtpUrl,
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
    });

    const messageId = await sendMailSMTP({ email, loginUrl, code });
    try {
      await logApiEvent("email_login_requested", {
        channel: "magic_link",
        addr: walletKey ? walletKey.slice(0, 8) : "",
        emailDomain: email.split("@")[1] || "",
        requestId: reqId || undefined,
        redirect: redirect || undefined,
        hasSmtp: !!messageId,
      });
    } catch {}

    const message =
      process.env.NODE_ENV === "production"
        ? "登录邮件已发送"
        : messageId
          ? "登录邮件已发送"
          : "开发环境：已生成登录链接和验证码（未发送邮件）";

    const res = successResponse(
      process.env.NODE_ENV === "production"
        ? { expiresInSec: 600, resendAfterSec: 60 }
        : {
            expiresInSec: 600,
            resendAfterSec: 60,
            magicLinkPreview: loginUrl,
            codePreview: code,
            smtpConfigured: smtpMissingEnv.length === 0,
            smtpMissingEnv,
          },
      message
    );

    return res;
  } catch (e: unknown) {
    logApiError("POST /api/email-magic-link/request", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("登录邮件发送失败", message);
  }
}
