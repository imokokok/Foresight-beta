import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import {
  getRequestId,
  logApiError,
  logApiEvent,
  getProxyWalletConfig,
  normalizeAddress,
  parseRequestBody,
} from "@/lib/serverUtils";
import { getIP } from "@/lib/rateLimit";
import { createSession, markDeviceVerified, setStepUpCookie } from "@/lib/session";
import { getConfiguredChainId, getConfiguredRpcUrl, getFeatureFlags } from "@/lib/runtimeConfig";
import { resolveEmailOtpSecret } from "@/lib/otpUtils";
import {
  computeSafeCounterfactualAddress,
  encodeSafeInitializer,
  resolveSaltNonce,
  deriveProxyWalletAddress,
} from "@/lib/safeUtils";
import { ethers } from "ethers";

function resolveMagicSecret() {
  const raw = (process.env.MAGIC_LINK_SECRET || process.env.JWT_SECRET || "").trim();
  if (raw) return raw;
  if (process.env.NODE_ENV === "production") throw new Error("Missing MAGIC_LINK_SECRET");
  return "dev-magic-link-secret";
}

function hashMagicToken(token: string, secret: string) {
  return createHash("sha256").update(`${token}:${secret}`, "utf8").digest("hex");
}

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
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

function isUniqueEmailViolation(message: string) {
  const msg = String(message || "").toLowerCase();
  return (
    msg.includes("duplicate") &&
    msg.includes("unique") &&
    (msg.includes("idx_user_profiles_email") ||
      msg.includes("user_profiles_email_key") ||
      msg.includes("user_profiles_email") ||
      msg.includes("email"))
  );
}

function findMissingUserProfilesColumn(message: string): string | null {
  const msg = String(message || "");
  const m1 = msg.match(/could not find the '([^']+)' column of 'user_profiles'/i);
  if (m1 && m1[1]) return String(m1[1]);
  const m2 = msg.match(/column "?([a-z0-9_]+)"? of relation "?user_profiles"? does not exist/i);
  if (m2 && m2[1]) return String(m2[1]);
  return null;
}

async function fetchUserProfilesByEmail(client: any, email: string) {
  const candidates = [
    "wallet_address,email,proxy_wallet_type,username",
    "wallet_address,email,username",
    "wallet_address,email",
  ];
  let lastError: any = null;
  for (const sel of candidates) {
    const { data, error } = await client
      .from("user_profiles")
      .select(sel)
      .eq("email", email)
      .limit(10);
    if (!error) return { list: Array.isArray(data) ? data : [], error: null };
    lastError = error;
    if (findMissingUserProfilesColumn(String(error?.message || ""))) continue;
    break;
  }
  return { list: [], error: lastError };
}

async function upsertUserProfileWithColumnFallback(
  client: any,
  payload: Record<string, any>,
  options: { onConflict: string }
) {
  const removable = new Set([
    "proxy_wallet_type",
    "proxy_wallet_address",
    "embedded_wallet_provider",
    "embedded_wallet_address",
  ]);
  let lastError: any = null;
  for (let i = 0; i < 6; i++) {
    const { error } = await client.from("user_profiles").upsert(payload, options);
    if (!error) return { ok: true as const, error: null };
    lastError = error;
    const missing = findMissingUserProfilesColumn(String(error?.message || ""));
    if (missing && removable.has(missing) && missing in payload) {
      delete payload[missing];
      continue;
    }
    return { ok: false as const, error };
  }
  return { ok: false as const, error: lastError };
}

async function ensureEmailUserProxyWallet(params: {
  client: any;
  ownerEoa: string;
  nowIso: string;
}) {
  const proxyConfig = getProxyWalletConfig();
  if (!proxyConfig.ok || !proxyConfig.config) return;
  const chainId = getConfiguredChainId();
  if (chainId !== 80002 && chainId !== 137) return;

  const rpcUrl = getConfiguredRpcUrl(chainId);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const targetType = proxyConfig.config.type;

  const smartAccountAddress =
    targetType === "safe" || targetType === "safe4337"
      ? await computeSafeCounterfactualAddress({
          provider,
          factoryAddress: proxyConfig.config.safeFactoryAddress || "",
          singletonAddress: proxyConfig.config.safeSingletonAddress || "",
          initializer: encodeSafeInitializer({
            ownerEoa: params.ownerEoa,
            fallbackHandler: proxyConfig.config.safeFallbackHandlerAddress || ethers.ZeroAddress,
          }),
          saltNonce: resolveSaltNonce(params.ownerEoa, chainId),
        })
      : deriveProxyWalletAddress(params.ownerEoa, targetType);

  const { error } = await params.client
    .from("user_profiles")
    .update({
      proxy_wallet_address: smartAccountAddress,
      updated_at: params.nowIso,
    })
    .eq("wallet_address", params.ownerEoa);
  if (error) throw error;
}

export async function POST(req: NextRequest) {
  try {
    if (!getFeatureFlags().embedded_auth_enabled) {
      return ApiResponses.forbidden("邮箱登录已关闭");
    }
    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Supabase not configured");
    const reqId = getRequestId(req);
    const ip = getIP(req);

    const payload = await parseRequestBody(req);
    const token = String(payload?.token || "").trim();
    if (!token || token.length < 10 || token.length > 512) {
      try {
        await logApiEvent("email_login_token_verify_failed", {
          reason: "TOKEN_INVALID_FORMAT",
          requestId: reqId || undefined,
        });
      } catch {}
      return ApiResponses.invalidParameters("登录链接无效或已过期");
    }

    const tokenHash = hashMagicToken(token, resolveMagicSecret());
    const nowIso = new Date().toISOString();
    try {
      const { data: stale, error: staleErr } = await client
        .from("email_login_tokens")
        .select("id")
        .lt("expires_at", nowIso)
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
    const { data: updated, error: updateErr } = await client
      .from("email_login_tokens")
      .update({ used_at: nowIso })
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .select("email")
      .limit(1);

    if (updateErr) {
      try {
        await logApiEvent("email_login_token_verify_failed", {
          reason: "DB_ERROR",
          requestId: reqId || undefined,
        });
      } catch {}
      return ApiResponses.databaseError("Failed to verify token", updateErr.message);
    }
    const row = Array.isArray(updated) ? updated[0] : null;
    const email = typeof row?.email === "string" ? String(row.email).trim().toLowerCase() : "";
    if (!email || !isValidEmail(email)) {
      try {
        await logApiEvent("email_login_token_verify_failed", {
          reason: "TOKEN_NOT_FOUND_OR_EXPIRED",
          requestId: reqId || undefined,
        });
      } catch {}
      return ApiResponses.invalidParameters("登录链接无效或已过期");
    }

    const { list, error: existingErr } = await fetchUserProfilesByEmail(client, email);
    if (existingErr) {
      return ApiResponses.databaseError("Failed to load user profile", existingErr.message);
    }

    const listAny = Array.isArray(list) ? list : [];
    const hasProxyType = listAny.some(
      (r: any) => r && typeof r === "object" && "proxy_wallet_type" in r
    );
    const emailProxy = hasProxyType
      ? listAny.find((r: any) => {
          const t = String(r?.proxy_wallet_type || "")
            .trim()
            .toLowerCase();
          if (t !== "email") return false;
          const wa = String(r?.wallet_address || "");
          return !!wa && isValidEthAddress(wa);
        })
      : null;
    const owner = hasProxyType
      ? listAny.find((r: any) => {
          const t = String(r?.proxy_wallet_type || "")
            .trim()
            .toLowerCase();
          if (t === "email") return false;
          const wa = String(r?.wallet_address || "");
          return !!wa && isValidEthAddress(wa);
        })
      : listAny.find((r: any) => isValidEthAddress(String(r?.wallet_address || "")));
    let sessionAddress = "";
    let isNewUser = false;
    if (!owner?.wallet_address || !isValidEthAddress(owner.wallet_address)) {
      if (emailProxy?.wallet_address && isValidEthAddress(emailProxy.wallet_address)) {
        sessionAddress = normalizeAddress(emailProxy.wallet_address);
        isNewUser = !String((emailProxy as any)?.username || "").trim();
      } else {
        const newWalletAddress = deriveDeterministicAddressFromEmail(
          email,
          resolveEmailOtpSecret().secretString
        );
        const { data: existingEmailUser, error: existingEmailUserErr } = await client
          .from("user_profiles")
          .select("wallet_address,username,proxy_wallet_type")
          .eq("wallet_address", newWalletAddress)
          .maybeSingle();
        if (existingEmailUserErr) {
          return ApiResponses.databaseError(
            "Failed to load user profile",
            existingEmailUserErr.message
          );
        }

        const existingProxyType = String((existingEmailUser as any)?.proxy_wallet_type || "")
          .trim()
          .toLowerCase();
        if (!existingEmailUser || existingProxyType !== "email") {
          const payloadRow: Record<string, any> = {
            wallet_address: newWalletAddress,
            email,
            username: "",
            proxy_wallet_type: "email",
            created_at: nowIso,
            updated_at: nowIso,
          };
          const createRes = await upsertUserProfileWithColumnFallback(client, payloadRow, {
            onConflict: "wallet_address",
          });
          if (!createRes.ok) {
            const createErr: any = createRes.error;
            if (isUniqueEmailViolation(createErr?.message)) {
              const existing = listAny.find((r: any) =>
                isValidEthAddress(String(r?.wallet_address || ""))
              );
              if (existing?.wallet_address) {
                sessionAddress = normalizeAddress(existing.wallet_address);
                isNewUser = !String((existing as any)?.username || "").trim();
                const res = successResponse(
                  isNewUser
                    ? { ok: true, address: sessionAddress, email, isNewUser: true }
                    : { ok: true, address: sessionAddress, email },
                  "验证成功"
                );
                await createSession(res, sessionAddress, undefined, {
                  req,
                  authMethod: "email_magic_link",
                });
                await setStepUpCookie(res, sessionAddress, undefined, { purpose: "login", req });
                await markDeviceVerified(req, sessionAddress);
                try {
                  await logApiEvent("email_login_token_verified", {
                    addr: sessionAddress ? sessionAddress.slice(0, 8) : "",
                    emailDomain: email.split("@")[1] || "",
                    requestId: reqId || undefined,
                    ip: ip ? String(ip).split(".").slice(0, 2).join(".") + ".*.*" : "",
                  });
                } catch {}
                try {
                  await client.from("email_login_tokens").delete().eq("token_hash", tokenHash);
                } catch {}
                try {
                  const walletKey = deriveDeterministicAddressFromEmail(
                    email,
                    resolveEmailOtpSecret().secretString
                  );
                  await client
                    .from("email_otps")
                    .delete()
                    .eq("wallet_address", walletKey)
                    .eq("email", email);
                } catch {}
                return res;
              }
            }
            return ApiResponses.databaseError("Failed to create user profile", createErr?.message);
          }
          isNewUser = true;
        }

        sessionAddress = newWalletAddress;
        try {
          await ensureEmailUserProxyWallet({ client, ownerEoa: sessionAddress, nowIso });
        } catch {}
      }
    } else {
      sessionAddress = normalizeAddress(owner.wallet_address);
      isNewUser = !String((owner as any)?.username || "").trim();
    }

    const res = successResponse(
      isNewUser
        ? { ok: true, address: sessionAddress, email, isNewUser: true }
        : { ok: true, address: sessionAddress, email },
      "验证成功"
    );
    await createSession(res, sessionAddress, undefined, { req, authMethod: "email_magic_link" });
    await setStepUpCookie(res, sessionAddress, undefined, { purpose: "login", req });
    await markDeviceVerified(req, sessionAddress);
    try {
      await logApiEvent("email_login_token_verified", {
        addr: sessionAddress ? sessionAddress.slice(0, 8) : "",
        emailDomain: email.split("@")[1] || "",
        requestId: reqId || undefined,
        ip: ip ? String(ip).split(".").slice(0, 2).join(".") + ".*.*" : "",
      });
    } catch {}
    try {
      await client.from("email_login_tokens").delete().eq("token_hash", tokenHash);
    } catch {}
    try {
      const walletKey = deriveDeterministicAddressFromEmail(
        email,
        resolveEmailOtpSecret().secretString
      );
      await client.from("email_otps").delete().eq("wallet_address", walletKey).eq("email", email);
    } catch {}
    return res;
  } catch (e: unknown) {
    logApiError("POST /api/email-magic-link/verify", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("登录失败", message);
  }
}
