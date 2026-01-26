import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { microCacheGet, microCacheSet, type MicroCacheEntry } from "../utils/microCache.js";
import { getRedisClient } from "../redis/client.js";
import {
  apiAuthFailuresTotal,
  apiKeyRequestsTotal,
  adminActionsTotal,
} from "../monitoring/metrics.js";

type ApiKeyEntry = {
  keyId: string;
  keyHash: string;
  keyBytes: Uint8Array;
  scopes: Set<string>;
};

export type ResolvedApiKey = {
  keyId: string;
  keyHash: string;
  scopes: Set<string>;
  source: "env" | "redis";
};

type RateTier = "admin" | "trader" | "anon";

function buildApiKeyHash(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function buildApiKeyIdFromHash(keyHash: string): string {
  return keyHash.slice(0, 16);
}

function parseApiKeysEnv(): ApiKeyEntry[] {
  const raw = String(process.env.RELAYER_API_KEYS || "").trim();
  if (!raw) return [];
  const entries: ApiKeyEntry[] = [];
  for (const token of raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)) {
    const parts = token.split(":");
    const key = (parts[0] || "").trim();
    if (!key) continue;
    const scopesRaw = parts.slice(1).join(":").trim();
    const scopes =
      scopesRaw.length > 0
        ? new Set(
            scopesRaw
              .split("|")
              .map((v) => v.trim())
              .filter((v) => v.length > 0)
          )
        : new Set<string>(["*"]);
    const keyHash = buildApiKeyHash(key);
    entries.push({
      keyId: buildApiKeyIdFromHash(keyHash),
      keyHash,
      keyBytes: Buffer.from(key),
      scopes,
    });
  }
  return entries;
}

const apiKeys: ApiKeyEntry[] = parseApiKeysEnv();
const apiKeyPositiveCache = new Map<string, MicroCacheEntry<ResolvedApiKey>>();
const apiKeyNegativeCache = new Map<string, MicroCacheEntry<true>>();
const API_KEY_NEG_CACHE_MAX_SIZE = 5000;

function enforceApiKeyNegCacheLimit(): void {
  if (apiKeyNegativeCache.size <= API_KEY_NEG_CACHE_MAX_SIZE) return;
  const now = Date.now();
  let deleted = 0;
  for (const [key, entry] of apiKeyNegativeCache.entries()) {
    if (entry.expiresAtMs <= now || deleted < API_KEY_NEG_CACHE_MAX_SIZE * 0.1) {
      apiKeyNegativeCache.delete(key);
      deleted++;
    }
    if (apiKeyNegativeCache.size <= API_KEY_NEG_CACHE_MAX_SIZE) break;
  }
}

export function createApiKeyAuth(
  readIntEnv: (name: string, fallback: number) => number,
  sendApiError: (
    req: Request,
    res: Response,
    status: number,
    payload: { message: string; detail?: any; errorCode?: string | null }
  ) => any
) {
  function getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
      const ip = String(ips || "").trim();
      if (ip) return ip;
    }
    const realIp = req.headers["x-real-ip"];
    if (realIp) {
      const ip = Array.isArray(realIp) ? realIp[0] : realIp;
      const v = String(ip || "").trim();
      if (v) return v;
    }
    const ip = (req.ip || req.socket.remoteAddress || "").toString().trim();
    return ip || "unknown";
  }

  function getApiKeyFromRequest(req: Request): string | null {
    const direct = req.headers["x-api-key"];
    if (typeof direct === "string") {
      const v = direct.trim();
      if (v) return v;
    }
    const auth = req.headers.authorization;
    if (typeof auth === "string") {
      const m = auth.match(/^ApiKey\s+(.+)$/i);
      if (m) {
        const v = String(m[1] || "").trim();
        if (v) return v;
      }
    }
    return null;
  }

  function verifyApiKeyEnv(rawKey: string): ApiKeyEntry | null {
    const candidate = Buffer.from(rawKey);
    for (const entry of apiKeys) {
      if (candidate.length !== entry.keyBytes.length) continue;
      if (timingSafeEqual(candidate, entry.keyBytes)) return entry;
    }
    return null;
  }

  function hasScope(scopes: Set<string>, scope: string): boolean {
    if (scopes.has("*")) return true;
    if (scopes.has("admin")) return true;
    return scopes.has(scope);
  }

  function authIsEnabled(): boolean {
    const envKeysEnabled = apiKeys.length > 0;
    const redisEnabled =
      String(process.env.RELAYER_API_KEYS_REDIS || "")
        .trim()
        .toLowerCase() === "true";
    return envKeysEnabled || redisEnabled;
  }

  function parseScopesValue(raw: string): Set<string> {
    const trimmed = raw.trim();
    if (!trimmed) return new Set<string>();
    try {
      const parsed = JSON.parse(trimmed) as any;
      if (Array.isArray(parsed)) {
        return new Set<string>(
          parsed.map((v) => String(v || "").trim()).filter((v) => v.length > 0)
        );
      }
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.scopes)) {
        return new Set<string>(
          parsed.scopes.map((v: any) => String(v || "").trim()).filter((v: string) => v.length > 0)
        );
      }
    } catch {}
    return new Set<string>(
      trimmed
        .split("|")
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
    );
  }

  async function resolveApiKey(rawKey: string): Promise<ResolvedApiKey | null> {
    const keyHash = buildApiKeyHash(rawKey);
    const cached = microCacheGet(apiKeyPositiveCache, keyHash);
    if (cached) return cached;
    const negCached = microCacheGet(apiKeyNegativeCache, keyHash);
    if (negCached) return null;

    const envHit = verifyApiKeyEnv(rawKey);
    if (envHit) {
      const resolved: ResolvedApiKey = {
        keyId: envHit.keyId,
        keyHash: envHit.keyHash,
        scopes: envHit.scopes,
        source: "env",
      };
      microCacheSet(
        apiKeyPositiveCache,
        keyHash,
        Math.max(50, readIntEnv("RELAYER_API_KEY_CACHE_MS", 5000)),
        resolved,
        20000
      );
      return resolved;
    }

    const redisEnabled =
      String(process.env.RELAYER_API_KEYS_REDIS || "")
        .trim()
        .toLowerCase() === "true";
    if (!redisEnabled) {
      microCacheSet(
        apiKeyNegativeCache,
        keyHash,
        Math.max(50, readIntEnv("RELAYER_API_KEY_NEG_CACHE_MS", 500)),
        true,
        20000
      );
      enforceApiKeyNegCacheLimit();
      return null;
    }

    const redis = getRedisClient();
    if (!redis.isReady()) {
      microCacheSet(
        apiKeyNegativeCache,
        keyHash,
        Math.max(50, readIntEnv("RELAYER_API_KEY_NEG_CACHE_MS", 500)),
        true,
        20000
      );
      enforceApiKeyNegCacheLimit();
      return null;
    }

    const rawScopes = await redis.hGet("relayer:api_keys", keyHash);
    if (!rawScopes) {
      microCacheSet(
        apiKeyNegativeCache,
        keyHash,
        Math.max(50, readIntEnv("RELAYER_API_KEY_NEG_CACHE_MS", 500)),
        true,
        20000
      );
      enforceApiKeyNegCacheLimit();
      return null;
    }

    const scopes = parseScopesValue(rawScopes);
    if (scopes.size === 0) scopes.add("*");
    const resolved: ResolvedApiKey = {
      keyId: buildApiKeyIdFromHash(keyHash),
      keyHash,
      scopes,
      source: "redis",
    };
    microCacheSet(
      apiKeyPositiveCache,
      keyHash,
      Math.max(50, readIntEnv("RELAYER_API_KEY_CACHE_MS", 5000)),
      resolved,
      20000
    );
    return resolved;
  }

  function requireApiKey(scope: string, action: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!authIsEnabled()) return next();
      const raw = getApiKeyFromRequest(req);
      if (!raw) {
        apiAuthFailuresTotal.inc({ path: req.path, reason: "missing" });
        apiKeyRequestsTotal.inc({
          action,
          path: req.path,
          result: "denied",
          key_id: "missing",
        });
        adminActionsTotal.inc({ action, result: "denied" });
        return sendApiError(req, res, 401, {
          message: "API key required",
          errorCode: "API_KEY_REQUIRED",
        });
      }
      const entry = await resolveApiKey(raw);
      if (!entry) {
        apiAuthFailuresTotal.inc({ path: req.path, reason: "invalid" });
        apiKeyRequestsTotal.inc({
          action,
          path: req.path,
          result: "denied",
          key_id: buildApiKeyIdFromHash(buildApiKeyHash(raw)),
        });
        adminActionsTotal.inc({ action, result: "denied" });
        return sendApiError(req, res, 401, {
          message: "API key invalid",
          errorCode: "API_KEY_INVALID",
        });
      }
      if (!hasScope(entry.scopes, scope)) {
        apiAuthFailuresTotal.inc({ path: req.path, reason: "forbidden" });
        apiKeyRequestsTotal.inc({
          action,
          path: req.path,
          result: "denied",
          key_id: entry.keyId,
        });
        adminActionsTotal.inc({ action, result: "denied" });
        return sendApiError(req, res, 403, {
          message: "API key forbidden",
          errorCode: "API_KEY_FORBIDDEN",
        });
      }
      (req as any).apiKeyId = entry.keyId;
      (req as any).apiKeyScopes = Array.from(entry.scopes);
      apiKeyRequestsTotal.inc({
        action,
        path: req.path,
        result: "allowed",
        key_id: entry.keyId,
      });
      adminActionsTotal.inc({ action, result: "allowed" });
      return next();
    };
  }

  function getRateLimitIdentityFromResolvedKey(key: ResolvedApiKey | null, req: Request): string {
    if (key) return `api:${key.keyId}`;
    const raw = getApiKeyFromRequest(req);
    if (raw) {
      const keyHash = buildApiKeyHash(raw);
      return `api:${buildApiKeyIdFromHash(keyHash)}`;
    }
    return `ip:${getClientIp(req)}`;
  }

  function getRateTierFromScopes(scopes: Set<string> | null): RateTier {
    if (!scopes) return "anon";
    if (scopes.has("admin")) return "admin";
    return "trader";
  }

  return {
    requireApiKey,
    resolveApiKey,
    getApiKeyFromRequest,
    getClientIp,
    getRateLimitIdentityFromResolvedKey,
    getRateTierFromScopes,
  };
}
