import { NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";
import { SignJWT } from "jose";
import { supabaseAdmin } from "@/lib/supabase";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { logApiError, parseRequestBody } from "@/lib/serverUtils";

const EMAIL_OTP_COOKIE = "fs_email_otp";
const EMAIL_OTP_ISSUER = "foresight-email-otp";
const EMAIL_OTP_AUDIENCE = "foresight-users";

let cachedSmtpTransporter: any | null = null;
let cachedSmtpKey = "";

const recentSendByKey = new Map<string, { lastSentAt: number; sentAtList: number[] }>();

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function resolveEmailOtpSecret(): { secretBytes: Uint8Array; secretString: string } {
  const raw = (process.env.JWT_SECRET || "").trim();
  if (raw) return { secretBytes: new TextEncoder().encode(raw), secretString: raw };
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing JWT_SECRET");
  }
  const fallback = "your-secret-key-change-in-production";
  return { secretBytes: new TextEncoder().encode(fallback), secretString: fallback };
}

function hashEmailOtpCode(code: string, secretString: string): string {
  return createHash("sha256").update(`${code}:${secretString}`, "utf8").digest("hex");
}

async function createEmailOtpToken(payload: { email: string; codeHash: string; mode: "login" }) {
  const { secretBytes } = resolveEmailOtpSecret();
  return new SignJWT({ ...payload, failCount: 0, lockUntil: 0 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(EMAIL_OTP_ISSUER)
    .setAudience(EMAIL_OTP_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretBytes);
}

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

function enforceRateLimit(key: string) {
  const now = Date.now();
  const rec = recentSendByKey.get(key) || { lastSentAt: 0, sentAtList: [] };
  const rateWindowMs = 60 * 60_000;
  const minIntervalMs = 60_000;
  const maxInWindow = 5;
  rec.sentAtList = (rec.sentAtList || []).filter(
    (t) => typeof t === "number" && now - t < rateWindowMs
  );
  if (rec.lastSentAt && now - rec.lastSentAt < minIntervalMs) {
    const waitSec = Math.ceil((minIntervalMs - (now - rec.lastSentAt)) / 1000);
    return { ok: false, message: `请求过于频繁，请 ${waitSec} 秒后重试` };
  }
  if (rec.sentAtList.length >= maxInWindow) {
    return { ok: false, message: "请求过于频繁，请稍后重试" };
  }
  rec.lastSentAt = now;
  rec.sentAtList.push(now);
  recentSendByKey.set(key, rec);
  return { ok: true };
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

export async function POST(req: NextRequest) {
  try {
    const payload = await parseRequestBody(req);
    const email = String(payload?.email || "")
      .trim()
      .toLowerCase();

    if (!isValidEmail(email)) {
      return ApiResponses.invalidParameters("邮箱格式不正确");
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const rateKey = `email:${email}`;
    const limit = enforceRateLimit(rateKey);
    if (!limit.ok) return ApiResponses.rateLimit(limit.message);

    const baseUrl = resolveBaseUrl(req);
    const token = generateToken();
    const tokenHash = hashMagicToken(token, resolveMagicSecret());
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const ua = req.headers.get("user-agent") || "";

    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const { error: insertErr } = await client.from("email_login_tokens").insert({
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_ip: ip || null,
      created_ua: ua || null,
    });
    if (insertErr)
      return ApiResponses.databaseError("Failed to create login token", insertErr.message);

    const loginUrl = `${baseUrl}/login/callback?token=${encodeURIComponent(token)}`;
    const code = genCode();
    const codeHash = hashEmailOtpCode(code, resolveEmailOtpSecret().secretString);
    const otpToken = await createEmailOtpToken({ email, codeHash, mode: "login" });

    const messageId = await sendMailSMTP({ email, loginUrl, code });

    const message =
      process.env.NODE_ENV === "production"
        ? "登录邮件已发送"
        : messageId
          ? "登录邮件已发送"
          : "开发环境：已生成登录链接和验证码（未发送邮件）";

    const res = successResponse(
      process.env.NODE_ENV === "production"
        ? { expiresInSec: 600 }
        : { expiresInSec: 600, magicLinkPreview: loginUrl, codePreview: code },
      message
    );

    res.cookies.set(EMAIL_OTP_COOKIE, otpToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 15 * 60,
    });

    return res;
  } catch (e: unknown) {
    logApiError("POST /api/email-magic-link/request", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("登录邮件发送失败", message);
  }
}
