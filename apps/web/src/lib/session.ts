import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash, randomUUID } from "crypto";
import { createToken, verifyToken, createRefreshToken, type JWTPayload } from "./jwt";
import { supabaseAdmin } from "./supabase.server";

const SESSION_COOKIE_NAME = "fs_session";
const REFRESH_COOKIE_NAME = "fs_refresh";
const STEPUP_COOKIE_NAME = "fs_stepup";

const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function resolveCookieDomain(req?: NextRequest): string | undefined {
  try {
    if (process.env.NODE_ENV !== "production") return undefined;

    const base = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
    if (!base) return undefined;

    let appHost = "";
    try {
      appHost = new URL(base).hostname || "";
    } catch {
      return undefined;
    }
    const parts = appHost
      .toLowerCase()
      .split(".")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) return undefined;
    const root = parts.slice(-2).join(".");
    if (!root) return undefined;
    if (root === "localhost" || root.endsWith(".localhost")) return undefined;
    if (root === "vercel.app") return undefined;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(root)) return undefined;

    const reqHostRaw = String(
      (req?.headers?.get("x-forwarded-host") ||
        req?.headers?.get("host") ||
        req?.nextUrl?.host ||
        "") as any
    )
      .split(",")[0]
      .trim()
      .toLowerCase();
    if (reqHostRaw && reqHostRaw !== root && !reqHostRaw.endsWith(`.${root}`)) return undefined;

    return `.${root}`;
  } catch {
    return undefined;
  }
}

function getCookieOptions(req?: NextRequest) {
  const domain = resolveCookieDomain(req);
  return domain ? { ...BASE_COOKIE_OPTIONS, domain } : BASE_COOKIE_OPTIONS;
}

function computeDeviceId(req?: NextRequest): string | null {
  try {
    if (!req) return null;
    const ua = String(req.headers.get("user-agent") || "").slice(0, 512);
    const al = String(req.headers.get("accept-language") || "").slice(0, 256);
    const chUa = String(req.headers.get("sec-ch-ua") || "").slice(0, 256);
    const chPlatform = String(req.headers.get("sec-ch-ua-platform") || "").slice(0, 128);
    const chMobile = String(req.headers.get("sec-ch-ua-mobile") || "").slice(0, 32);
    const seed = [ua, al, chUa, chPlatform, chMobile].join("|");
    if (!seed.trim()) return null;
    const h = createHash("sha256").update(seed, "utf8").digest("hex");
    return `d_${h.slice(0, 32)}`;
  } catch {
    return null;
  }
}

function getIpPrefixFromRequest(req?: NextRequest): string | null {
  try {
    if (!req) return null;
    const ipRaw = String(req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "");
    const ip = String(ipRaw || "")
      .split(",")[0]
      .trim();
    return ip ? ip.split(".").slice(0, 2).join(".") + ".*.*" : null;
  } catch {
    return null;
  }
}

function isMissingRelation(err: unknown) {
  const msg = String((err as any)?.message || "").toLowerCase();
  return msg.includes("relation") && msg.includes("does not exist");
}

async function isSessionRevoked(address: string, sessionId: string): Promise<boolean> {
  try {
    const client = supabaseAdmin as any;
    if (!client) return false;
    const a = String(address || "").toLowerCase();
    const sid = String(sessionId || "");
    if (!a || !sid) return false;
    const { data, error } = await client
      .from("user_sessions")
      .select("revoked_at")
      .eq("wallet_address", a)
      .eq("session_id", sid)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error)) return false;
      return false;
    }
    return !!(data as any)?.revoked_at;
  } catch {
    return false;
  }
}

/**
 * 创建会话并设置 Cookie
 */
export async function createSession(
  response: NextResponse,
  address: string,
  chainId?: number,
  options?: { req?: NextRequest; sessionId?: string; authMethod?: string }
): Promise<void> {
  const sessionId = options?.sessionId || randomUUID();
  const token = await createToken(address, chainId, 7 * 24 * 60 * 60, {
    sessionId,
    tokenType: "session",
  });
  const refreshToken = await createRefreshToken(address, chainId, { sessionId });
  const cookieOptions = getCookieOptions(options?.req);

  // 设置访问 token（7天）
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60, // 7 天
  });

  // 设置刷新 token（30天）
  response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60, // 30 天
  });

  try {
    const client = supabaseAdmin as any;
    if (!client) return;
    const nowIso = new Date().toISOString();
    const ua =
      options?.req && typeof options.req.headers?.get === "function"
        ? String(options.req.headers.get("user-agent") || "").slice(0, 512)
        : "";
    const ipPrefix = getIpPrefixFromRequest(options?.req);
    const deviceId = computeDeviceId(options?.req);

    let riskScore: number | null = null;
    let riskReason: string | null = null;
    if (deviceId) {
      try {
        const { data: deviceRow, error: deviceErr } = await client
          .from("user_devices")
          .select("verified_at")
          .eq("wallet_address", String(address || "").toLowerCase())
          .eq("device_id", deviceId)
          .maybeSingle();
        if (!deviceErr) {
          if (!deviceRow) {
            riskScore = 80;
            riskReason = "new_device";
          } else if (!(deviceRow as any)?.verified_at) {
            riskScore = 50;
            riskReason = "device_unverified";
          } else {
            riskScore = 0;
            riskReason = "device_verified";
          }
        }
      } catch {}
    }

    if (deviceId) {
      try {
        await client
          .from("user_devices")
          .upsert(
            {
              wallet_address: String(address || "").toLowerCase(),
              device_id: deviceId,
              first_seen_at: nowIso,
              last_seen_at: nowIso,
              last_ip_prefix: ipPrefix,
              last_user_agent: ua || null,
            },
            { onConflict: "wallet_address,device_id" }
          )
          .catch(() => {});
      } catch {}
    }

    await client.from("user_sessions").upsert(
      {
        wallet_address: String(address || "").toLowerCase(),
        session_id: sessionId,
        chain_id: typeof chainId === "number" ? chainId : null,
        auth_method: options?.authMethod ? String(options.authMethod).slice(0, 32) : null,
        ip_prefix: ipPrefix,
        user_agent: ua || null,
        device_id: deviceId,
        last_seen_at: nowIso,
        created_at: nowIso,
        revoked_at: null,
      },
      { onConflict: "session_id" }
    );

    await client
      .from("login_audit_events")
      .insert({
        wallet_address: String(address || "").toLowerCase(),
        method: options?.authMethod ? String(options.authMethod).slice(0, 32) : "unknown",
        ip_prefix: ipPrefix,
        user_agent: ua || null,
        device_id: deviceId,
        risk_score: riskScore,
        risk_reason: riskReason,
        created_at: nowIso,
      })
      .catch(() => {});
  } catch {}
}

export async function hasValidStepUp(req: NextRequest, expectedAddress?: string): Promise<boolean> {
  try {
    const raw = req.cookies.get(STEPUP_COOKIE_NAME)?.value || "";
    if (!raw) return false;
    const payload = await verifyToken(raw);
    if (!payload) return false;
    if (payload.tokenType !== "stepup") return false;
    if (expectedAddress) {
      const addr = String(payload.address || "").toLowerCase();
      if (addr !== String(expectedAddress || "").toLowerCase()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function setStepUpCookie(
  response: NextResponse,
  address: string,
  chainId?: number,
  options?: { expiresInSeconds?: number; purpose?: string; req?: NextRequest }
): Promise<void> {
  const token = await createToken(address, chainId, options?.expiresInSeconds ?? 15 * 60, {
    tokenType: "stepup",
    extra: options?.purpose ? { purpose: options.purpose } : undefined,
  });
  response.cookies.set(STEPUP_COOKIE_NAME, token, {
    ...getCookieOptions(options?.req),
    maxAge: options?.expiresInSeconds ?? 15 * 60,
  });
}

export async function markDeviceVerified(req: NextRequest, address: string): Promise<void> {
  try {
    const client = supabaseAdmin as any;
    if (!client) return;
    const deviceId = computeDeviceId(req);
    if (!deviceId) return;
    const nowIso = new Date().toISOString();
    const ipPrefix = getIpPrefixFromRequest(req);
    const ua = String(req.headers.get("user-agent") || "").slice(0, 512);
    await client
      .from("user_devices")
      .upsert(
        {
          wallet_address: String(address || "").toLowerCase(),
          device_id: deviceId,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
          verified_at: nowIso,
          last_ip_prefix: ipPrefix,
          last_user_agent: ua || null,
        },
        { onConflict: "wallet_address,device_id" }
      )
      .catch(() => {});
  } catch {}
}

export async function isTrustedDevice(req: NextRequest, address: string): Promise<boolean> {
  try {
    const client = supabaseAdmin as any;
    if (!client) return false;
    const deviceId = computeDeviceId(req);
    if (!deviceId) return false;
    const { data, error } = await client
      .from("user_devices")
      .select("verified_at")
      .eq("wallet_address", String(address || "").toLowerCase())
      .eq("device_id", deviceId)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error)) return false;
      return false;
    }
    return !!(data as any)?.verified_at;
  } catch {
    return false;
  }
}

/**
 * 从请求中获取会话
 */
export async function getSession(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const sid = typeof (payload as any)?.sid === "string" ? String((payload as any).sid) : "";
      if (sid && (await isSessionRevoked(payload.address, sid))) return null;
      return payload;
    }
  }

  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value || "";
  if (refreshToken) {
    const payload = await verifyToken(refreshToken);
    if (payload) {
      const sid = typeof (payload as any)?.sid === "string" ? String((payload as any).sid) : "";
      if (sid && (await isSessionRevoked(payload.address, sid))) return null;
      return payload;
    }
  }

  return null;
}

/**
 * 从服务端组件获取会话（使用 cookies()）
 */
export async function getSessionFromCookies(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value || "";
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const sid = typeof (payload as any)?.sid === "string" ? String((payload as any).sid) : "";
      if (sid && (await isSessionRevoked(payload.address, sid))) return null;
      return payload;
    }
  }

  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value || "";
  if (refreshToken) {
    const payload = await verifyToken(refreshToken);
    if (payload) {
      const sid = typeof (payload as any)?.sid === "string" ? String((payload as any).sid) : "";
      if (sid && (await isSessionRevoked(payload.address, sid))) return null;
      return payload;
    }
  }

  return null;
}

/**
 * 尝试刷新会话
 */
export async function refreshSession(req: NextRequest, response: NextResponse): Promise<boolean> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return false;
  }

  const payload = await verifyToken(refreshToken);

  if (!payload) {
    return false;
  }

  const sid = typeof (payload as any)?.sid === "string" ? String((payload as any).sid) : "";
  if (sid && (await isSessionRevoked(payload.address, sid))) {
    return false;
  }

  // 创建新的访问 token
  await createSession(response, payload.address, payload.chainId, {
    req,
    sessionId: sid || undefined,
    authMethod: "refresh",
  });

  return true;
}

/**
 * 清除会话
 */
export function clearSession(response: NextResponse, req?: NextRequest): void {
  const cookieOptions = getCookieOptions(req);
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  response.cookies.set(REFRESH_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  response.cookies.set(STEPUP_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

/**
 * 验证请求是否已认证
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ authenticated: true; session: JWTPayload } | { authenticated: false; error: string }> {
  const session = await getSession(req);

  if (!session) {
    return {
      authenticated: false,
      error: "未认证或会话已过期",
    };
  }

  return {
    authenticated: true,
    session,
  };
}

/**
 * 验证会话地址是否匹配
 */
export async function verifySessionAddress(
  req: NextRequest,
  expectedAddress: string
): Promise<boolean> {
  const session = await getSession(req);

  if (!session) {
    return false;
  }

  return session.address.toLowerCase() === expectedAddress.toLowerCase();
}
