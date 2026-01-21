import { NextRequest } from "next/server";
import { normalizeAddress } from "./address";
import { getSession } from "./session";
import { getFeatureFlags } from "./runtimeConfig";
import { supabaseAdmin } from "./supabase.server";

export { normalizeAddress } from "./address";

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

export async function getSessionAddress(req: NextRequest) {
  const session = await getSession(req);
  const address = typeof session?.address === "string" ? normalizeAddress(session.address) : "";
  return address || "";
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

export function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "");
  }
  return String(error || "");
}

export function logApiError(scope: string, error: unknown) {
  try {
    if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
    console.error(scope, error);
  } catch {}
}

export function getRelayerBaseUrl(): string | undefined {
  const raw = (process.env.RELAYER_URL || process.env.NEXT_PUBLIC_RELAYER_URL || "").trim();
  if (!raw) return undefined;
  if (!/^https?:\/\//i.test(raw)) return undefined;
  return raw;
}

export async function logApiEvent(event: string, properties?: Record<string, unknown>) {
  try {
    if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
    if (process.env.NODE_ENV !== "production") {
      console.info(JSON.stringify({ evt: event, ...((properties as any) || {}) }));
      return;
    }
    if (!supabaseAdmin) return;
    await (supabaseAdmin as any)
      .from("analytics_events")
      .insert({
        event_name: event,
        event_properties: properties || {},
        created_at: new Date().toISOString(),
      })
      .catch(() => {});
  } catch {}
}

export function getRequestId(req: Request): string {
  try {
    const h = (req as any).headers as Headers | undefined;
    return h?.get("x-request-id") || "";
  } catch {
    return "";
  }
}

export type ProxyWalletType = "safe" | "safe4337" | "proxy";

export type ProxyWalletConfig = {
  type: ProxyWalletType;
  proxyWalletFactoryAddress?: string;
  safeFactoryAddress?: string;
  safeSingletonAddress?: string;
  safeFallbackHandlerAddress?: string;
};

export type GaslessConfig = {
  enabled: boolean;
  signerPrivateKeyConfigured: boolean;
  paymasterUrl?: string;
};

function isEthAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/.test(addr);
}

function normalizeEthAddressMaybe(raw: unknown): string | undefined {
  const norm = normalizeAddress(String(raw || ""));
  if (!norm) return undefined;
  const lower = norm.toLowerCase();
  if (!isEthAddress(lower)) return undefined;
  return lower;
}

function parseBoolEnv(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return undefined;
}

export function getProxyWalletConfig(): {
  ok: boolean;
  config?: ProxyWalletConfig;
  error?: string;
} {
  const rawType = String(process.env.NEXT_PUBLIC_PROXY_WALLET_TYPE || "")
    .trim()
    .toLowerCase();
  if (!rawType) return { ok: true, config: undefined };
  if (rawType !== "safe" && rawType !== "safe4337" && rawType !== "proxy") {
    return { ok: false, error: "Invalid NEXT_PUBLIC_PROXY_WALLET_TYPE" };
  }

  const proxyWalletFactoryAddress = normalizeEthAddressMaybe(
    process.env.PROXY_WALLET_FACTORY_ADDRESS || process.env.NEXT_PUBLIC_PROXY_WALLET_FACTORY_ADDRESS
  );
  const safeFactoryAddress = normalizeEthAddressMaybe(
    process.env.SAFE_FACTORY_ADDRESS || process.env.NEXT_PUBLIC_SAFE_FACTORY_ADDRESS
  );
  const safeSingletonAddress = normalizeEthAddressMaybe(
    process.env.SAFE_SINGLETON_ADDRESS || process.env.NEXT_PUBLIC_SAFE_SINGLETON_ADDRESS
  );
  const safeFallbackHandlerAddress = normalizeEthAddressMaybe(
    process.env.SAFE_FALLBACK_HANDLER_ADDRESS ||
      process.env.NEXT_PUBLIC_SAFE_FALLBACK_HANDLER_ADDRESS
  );

  const config: ProxyWalletConfig = {
    type: rawType as ProxyWalletType,
    ...(proxyWalletFactoryAddress ? { proxyWalletFactoryAddress } : {}),
    ...(safeFactoryAddress ? { safeFactoryAddress } : {}),
    ...(safeSingletonAddress ? { safeSingletonAddress } : {}),
    ...(safeFallbackHandlerAddress ? { safeFallbackHandlerAddress } : {}),
  };

  if (rawType === "safe" || rawType === "safe4337") {
    if (!config.safeFactoryAddress || !config.safeSingletonAddress) {
      return {
        ok: false,
        error: "Safe proxy wallet requires SAFE_FACTORY_ADDRESS and SAFE_SINGLETON_ADDRESS",
      };
    }
  }

  return { ok: true, config };
}

export function getGaslessConfig(): { ok: boolean; config: GaslessConfig; error?: string } {
  const flags = getFeatureFlags();
  let enabled = parseBoolEnv(process.env.GASLESS_ENABLED) ?? false;
  if (!flags.aa_enabled) enabled = false;
  const paymasterUrlRaw = String(process.env.RELAYER_GASLESS_PAYMASTER_URL || "").trim();
  let paymasterUrl: string | undefined;
  if (paymasterUrlRaw) {
    try {
      const u = new URL(paymasterUrlRaw);
      if (!["http:", "https:"].includes(u.protocol)) {
        return {
          ok: false,
          config: { enabled, signerPrivateKeyConfigured: false },
          error: "Invalid RELAYER_GASLESS_PAYMASTER_URL",
        };
      }
      paymasterUrl = u.toString();
    } catch {
      return {
        ok: false,
        config: { enabled, signerPrivateKeyConfigured: false },
        error: "Invalid RELAYER_GASLESS_PAYMASTER_URL",
      };
    }
  }

  const signerKey = String(process.env.RELAYER_GASLESS_SIGNER_PRIVATE_KEY || "").trim();
  const signerPrivateKeyConfigured =
    /^0x[0-9a-fA-F]{64}$/.test(signerKey) || /^[0-9a-fA-F]{64}$/.test(signerKey);

  if (enabled && !signerPrivateKeyConfigured) {
    return {
      ok: false,
      config: { enabled, signerPrivateKeyConfigured, ...(paymasterUrl ? { paymasterUrl } : {}) },
      error: "GASLESS_ENABLED requires RELAYER_GASLESS_SIGNER_PRIVATE_KEY",
    };
  }

  return {
    ok: true,
    config: { enabled, signerPrivateKeyConfigured, ...(paymasterUrl ? { paymasterUrl } : {}) },
  };
}

/**
 * 生成随机API密钥
 * @returns 长度为64的随机API密钥
 */
export function generateApiKey(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}

/**
 * 对API密钥进行哈希处理
 * @param apiKey - 原始API密钥
 * @returns 哈希后的API密钥
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const crypto = require("crypto");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await crypto.promises.scrypt(apiKey, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

/**
 * 比较API密钥与哈希值
 * @param apiKey - 原始API密钥
 * @param hashedKey - 哈希后的API密钥
 * @returns 是否匹配
 */
export async function compareApiKey(apiKey: string, hashedKey: string): Promise<boolean> {
  const crypto = require("crypto");
  const [salt, keyHash] = hashedKey.split(":");
  const hash = await crypto.promises.scrypt(apiKey, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(keyHash, "hex"), hash);
}
