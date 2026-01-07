import { NextRequest } from "next/server";
import { verifyToken, decodeToken } from "./jwt";

export type OtpRecord = {
  email: string;
  address: string;
  code: string;
  expiresAt: number;
  sentAtList: number[];
  failCount: number;
  lockUntil: number;
  createdIp: string;
  createdAt: number;
};

export type LogItem = {
  email: string;
  address: string;
  status: "queued" | "sent" | "error" | "verified";
  messageId?: string;
  error?: string;
  sentAt: number;
};

export function normalizeAddress(addr: string) {
  const a = String(addr || "");
  return a.startsWith("0x") ? a.toLowerCase() : a;
}

export async function getSessionAddress(req: NextRequest) {
  const raw = req.cookies.get("fs_session")?.value || "";
  if (!raw) return "";

  try {
    const obj = JSON.parse(raw) as unknown;
    if (obj && typeof obj === "object" && "address" in obj) {
      const addr = String((obj as { address?: unknown }).address || "");
      if (addr) return normalizeAddress(addr);
    }
  } catch {}

  const payload = await verifyToken(raw);
  if (payload?.address) {
    return normalizeAddress(String(payload.address));
  }

  const decoded = decodeToken(raw);
  if (decoded?.address) {
    return normalizeAddress(String(decoded.address));
  }

  return "";
}

export function getEmailOtpShared() {
  const g = globalThis as unknown as {
    __emailOtpStore?: Map<string, OtpRecord>;
    __emailOtpLogs?: LogItem[];
  };
  if (!g.__emailOtpStore) g.__emailOtpStore = new Map<string, OtpRecord>();
  if (!g.__emailOtpLogs) g.__emailOtpLogs = [] as LogItem[];
  return {
    store: g.__emailOtpStore as Map<string, OtpRecord>,
    logs: g.__emailOtpLogs as LogItem[],
  };
}

export function isAdminAddress(addr: string) {
  const raw = (process.env.ADMIN_ADDRESSES || "").toLowerCase();
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const a = normalizeAddress(String(addr || "").toLowerCase());
  return list.includes(a);
}

export async function parseRequestBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const text = await req.text();
      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      return Object.fromEntries(params.entries());
    }
    if (contentType.includes("multipart/form-data")) {
      const form = await (req as any).formData?.();
      if (form && typeof form.entries === "function") {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of form.entries()) {
          obj[k] = v;
        }
        return obj;
      }
      return {};
    }
    const text = await req.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    }
    return {};
  } catch {
    return {};
  }
}

export function parseNumericIds(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const ids: number[] = [];
  for (const x of raw) {
    const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
    if (Number.isFinite(n) && n > 0) ids.push(n);
  }
  return Array.from(new Set(ids));
}

export function logApiError(scope: string, error: unknown) {
  try {
    console.error(scope, error);
  } catch {}
}
