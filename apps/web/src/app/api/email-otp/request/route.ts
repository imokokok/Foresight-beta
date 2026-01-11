import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import {
  normalizeAddress,
  getSessionAddress,
  parseRequestBody,
  logApiError,
} from "@/lib/serverUtils";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
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

async function sendMailSMTP(email: string, code: string) {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || "noreply@localhost";
  if (!host || !port || !user || !pass) throw new Error("SMTP 未配置完整");
  const nodemailerMod = (await import("nodemailer")) as typeof import("nodemailer");
  const transporter = nodemailerMod.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  const subject = "您的验证码";
  const html = `<div style="font-family:system-ui,Segoe UI,Arial">验证码：<b>${code}</b>（15分钟内有效）。如非本人操作请忽略。</div>`;
  const text = `验证码：${code}（15分钟内有效）。如非本人操作请忽略。`;
  const info = await transporter.sendMail({ from, to: email, subject, text, html });
  const messageId =
    typeof (info as { messageId?: unknown }).messageId === "string"
      ? (info as { messageId: string }).messageId
      : "";
  return String(messageId || "");
}

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Missing service key");
    const payload = await parseRequestBody(req);

    const email = String(payload?.email || "")
      .trim()
      .toLowerCase();
    const walletAddress = normalizeAddress(String(payload?.walletAddress || ""));

    const sessAddr = await getSessionAddress(req);
    if (!sessAddr || sessAddr !== walletAddress) {
      return ApiResponses.unauthorized("未认证或会话地址不匹配");
    }
    if (!isValidEmail(email)) {
      return ApiResponses.invalidParameters("邮箱格式不正确");
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const now = new Date();
    const nowMs = now.getTime();

    const { data: existing, error: fetchErr } = await client
      .from("email_otps")
      .select(
        "wallet_address, email, expires_at, last_sent_at, sent_window_start_at, sent_in_window, fail_count, lock_until"
      )
      .eq("wallet_address", walletAddress)
      .eq("email", email)
      .maybeSingle();
    if (fetchErr) {
      return ApiResponses.databaseError("Failed to fetch otp", fetchErr.message);
    }

    const rec = (existing || null) as Database["public"]["Tables"]["email_otps"]["Row"] | null;

    if (rec?.lock_until && new Date(rec.lock_until).getTime() > nowMs) {
      const waitMin = Math.ceil((new Date(rec.lock_until).getTime() - nowMs) / 60000);
      return ApiResponses.rateLimit(`该邮箱已被锁定，请 ${waitMin} 分钟后重试`);
    }

    const lastSentAtMs = rec?.last_sent_at ? new Date(rec.last_sent_at).getTime() : 0;
    const sentWindowStartAtMs = rec?.sent_window_start_at
      ? new Date(rec.sent_window_start_at).getTime()
      : 0;
    const sentInWindow = Number(rec?.sent_in_window || 0);
    const rateWindowMs = 60 * 60_000;
    const minIntervalMs = 60_000;
    const maxInWindow = 5;

    if (lastSentAtMs && nowMs - lastSentAtMs < minIntervalMs) {
      const waitSec = Math.ceil((minIntervalMs - (nowMs - lastSentAtMs)) / 1000);
      return ApiResponses.rateLimit(`请求过于频繁，请 ${waitSec} 秒后重试`);
    }

    const windowReset = !sentWindowStartAtMs || nowMs - sentWindowStartAtMs >= rateWindowMs;
    const nextWindowStartAt = windowReset ? now : new Date(sentWindowStartAtMs);
    const nextSentInWindow = (windowReset ? 0 : sentInWindow) + 1;
    if (nextSentInWindow > maxInWindow) {
      return ApiResponses.rateLimit("请求过于频繁，请稍后重试");
    }

    const code = genCode();
    const expiresAt = new Date(nowMs + 15 * 60_000);
    const codeHash = hashEmailOtpCode(code, resolveEmailOtpSecret().secretString);
    const otpRow: Database["public"]["Tables"]["email_otps"]["Insert"] = {
      wallet_address: walletAddress,
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
      return ApiResponses.databaseError("Failed to store otp", upsertErr.message);
    }

    try {
      await sendMailSMTP(email, code);
      const res = successResponse({ expiresInSec: 900 }, "验证码已发送");
      return res;
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      try {
        const host = process.env.SMTP_HOST || "";
        const port = Number(process.env.SMTP_PORT || 0);
        const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
        const user = process.env.SMTP_USER || "";
        const maskedUser = user ? user.replace(/(^.).*(?=@)/, "$1***") : "";
        console.error("[email-otp] SMTP send error", {
          email,
          address: walletAddress,
          host,
          port,
          secure,
          user: maskedUser,
          error: errMessage,
        });
      } catch {}
      try {
        await client
          .from("email_otps")
          .delete()
          .eq("wallet_address", walletAddress)
          .eq("email", email);
      } catch {}
      if (process.env.NODE_ENV !== "production") {
        const res = successResponse(
          {
            codePreview: code,
            expiresInSec: 900,
          },
          "开发环境：邮件发送失败，已直接返回验证码"
        );
        return res;
      }
      return ApiResponses.internalError("邮件发送失败", errMessage);
    }
  } catch (e: unknown) {
    logApiError("POST /api/email-otp/request", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("邮箱验证码请求失败", message);
  }
}
