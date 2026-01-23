import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, timingSafeEqual } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });

// 🚀 Phase 1: 导入监控和日志模块
import { logger, matchingLogger } from "./monitoring/logger.js";
import {
  matchesTotal,
  matchedVolumeTotal,
  apiKeyRequestsTotal,
  apiRateLimitHits,
  apiAuthFailuresTotal,
  adminActionsTotal,
  stopMetricsTimers,
} from "./monitoring/metrics.js";
import {
  healthService,
  createSupabaseHealthChecker,
  createRedisHealthChecker,
  createRpcHealthChecker,
  createMatchingEngineHealthChecker,
  createOrderbookReadinessChecker,
  createWriteProxyReadinessChecker,
} from "./monitoring/health.js";
import {
  initContractEventListener,
  closeContractEventListener,
} from "./monitoring/contractEvents.js";
import {
  marketsResolvedTotal,
  marketsInvalidatedTotal,
  marketsActive,
} from "./monitoring/contractEvents.js";
import { initRedis, closeRedis, getRedisClient } from "./redis/client.js";
import { getOrderbookSnapshotService } from "./redis/orderbookSnapshot.js";
import { closeRateLimiter, createRateLimitMiddleware } from "./ratelimit/index.js";
import { RedisSlidingWindowLimiter, type RateLimitRequest } from "./ratelimit/slidingWindow.js";
import { healthRoutes, clusterRoutes } from "./routes/index.js";
import {
  metricsMiddleware,
  requestIdMiddleware,
  requestLoggerMiddleware,
} from "./middleware/index.js";

// 🚀 Phase 2: 导入集群和高可用模块
import { initClusterManager, closeClusterManager, getClusterManager } from "./cluster/index.js";
import { initDatabasePool, closeDatabasePool } from "./database/index.js";
import { initChainReconciler, closeChainReconciler } from "./reconciliation/index.js";
import { initBalanceChecker, closeBalanceChecker } from "./reconciliation/balanceChecker.js";

let clusterIsActive = false;

// 环境变量校验与读取
const EthPrivateKeySchema = z.preprocess(
  (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (/^[0-9a-fA-F]{64}$/.test(s)) return "0x" + s;
    return s;
  },
  z.string().regex(/^0x[0-9a-fA-F]{64}$/)
);

const EthAddressSchema = z.preprocess(
  (v) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (/^[0-9a-fA-F]{40}$/.test(s)) return "0x" + s;
    return s;
  },
  z.string().regex(/^0x[0-9a-fA-F]{40}$/)
);

const BoolSchema = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return v;
  const s = v.trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
  if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  return v;
}, z.boolean());

function maybeNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

function pickFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}

function maybeUrl(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function maybeIntString(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  if (!/^\d+$/.test(s)) return undefined;
  return s;
}

function maybeBoolString(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  const lower = s.toLowerCase();
  if (
    lower === "1" ||
    lower === "0" ||
    lower === "true" ||
    lower === "false" ||
    lower === "yes" ||
    lower === "no" ||
    lower === "on" ||
    lower === "off"
  ) {
    return lower;
  }
  return undefined;
}

function maybeEthPrivateKey(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return "0x" + s;
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s;
  return undefined;
}

function maybeEthAddress(v: unknown): string | undefined {
  const s = maybeNonEmptyString(v);
  if (!s) return undefined;
  if (/^[0-9a-fA-F]{40}$/.test(s)) return "0x" + s;
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s;
  return undefined;
}

const EnvSchema = z.object({
  BUNDLER_PRIVATE_KEY: EthPrivateKeySchema.optional(),
  OPERATOR_PRIVATE_KEY: EthPrivateKeySchema.optional(),
  RELAYER_GASLESS_SIGNER_PRIVATE_KEY: EthPrivateKeySchema.optional(),
  CUSTODIAL_SIGNER_PRIVATE_KEY: EthPrivateKeySchema.optional(),
  AA_ENABLED: BoolSchema.optional(),
  GASLESS_ENABLED: BoolSchema.optional(),
  EMBEDDED_AUTH_ENABLED: BoolSchema.optional(),
  RELAYER_GASLESS_PAYMASTER_URL: z.string().url().optional(),
  ENTRYPOINT_ADDRESS: EthAddressSchema.optional(),
  RPC_URL: z.string().url().optional(),
  CHAIN_ID: z
    .preprocess(
      (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v),
      z.number().int().positive()
    )
    .optional(),
  RELAYER_LEADER_PROXY_URL: z.string().url().optional(),
  RELAYER_LEADER_URL: z.string().url().optional(),
  RELAYER_PORT: z
    .preprocess(
      (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v),
      z.number().int().positive()
    )
    .optional(),
  PORT: z
    .preprocess(
      (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v),
      z.number().int().positive()
    )
    .optional(),
  NEXT_PUBLIC_PROXY_WALLET_TYPE: z.enum(["safe", "safe4337", "proxy"]).optional(),
  PROXY_WALLET_FACTORY_ADDRESS: EthAddressSchema.optional(),
  SAFE_FACTORY_ADDRESS: EthAddressSchema.optional(),
  SAFE_SINGLETON_ADDRESS: EthAddressSchema.optional(),
  SAFE_FALLBACK_HANDLER_ADDRESS: EthAddressSchema.optional(),
});

const DEFAULT_RPC_URLS: Record<number, string> = {
  80002: "https://rpc-amoy.polygon.technology/",
  137: "https://polygon-rpc.com",
  11155111: "https://rpc.sepolia.org",
};

const preChainId = (() => {
  const s = maybeIntString(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID);
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing CHAIN_ID");
    }
    return 80002;
  }
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 80002;
})();

const rawEnv = {
  BUNDLER_PRIVATE_KEY: maybeEthPrivateKey(
    process.env.BUNDLER_PRIVATE_KEY || process.env.PRIVATE_KEY
  ),
  OPERATOR_PRIVATE_KEY: maybeEthPrivateKey(process.env.OPERATOR_PRIVATE_KEY),
  RELAYER_GASLESS_SIGNER_PRIVATE_KEY: maybeEthPrivateKey(
    process.env.RELAYER_GASLESS_SIGNER_PRIVATE_KEY
  ),
  AA_ENABLED: maybeBoolString(
    process.env.AA_ENABLED || process.env.NEXT_PUBLIC_AA_ENABLED || process.env.aa_enabled
  ),
  GASLESS_ENABLED: maybeBoolString(
    process.env.GASLESS_ENABLED || process.env.AA_ENABLED || process.env.NEXT_PUBLIC_AA_ENABLED
  ),
  EMBEDDED_AUTH_ENABLED: maybeBoolString(
    process.env.EMBEDDED_AUTH_ENABLED ||
      process.env.NEXT_PUBLIC_EMBEDDED_AUTH_ENABLED ||
      process.env.embedded_auth_enabled
  ),
  CUSTODIAL_SIGNER_PRIVATE_KEY: maybeEthPrivateKey(process.env.CUSTODIAL_SIGNER_PRIVATE_KEY),
  RELAYER_GASLESS_PAYMASTER_URL: maybeUrl(process.env.RELAYER_GASLESS_PAYMASTER_URL),
  ENTRYPOINT_ADDRESS: maybeEthAddress(
    process.env.ENTRYPOINT_ADDRESS || process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS
  ),
  RPC_URL: maybeUrl(
    pickFirstNonEmptyString(
      process.env.RPC_URL,
      process.env.NEXT_PUBLIC_RPC_URL,
      preChainId === 80002 ? process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY : undefined,
      preChainId === 137 ? process.env.NEXT_PUBLIC_RPC_POLYGON : undefined,
      preChainId === 11155111 ? process.env.NEXT_PUBLIC_RPC_SEPOLIA : undefined
    )
  ),
  CHAIN_ID: maybeIntString(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID),
  RELAYER_LEADER_PROXY_URL: maybeUrl(process.env.RELAYER_LEADER_PROXY_URL),
  RELAYER_LEADER_URL: maybeUrl(process.env.RELAYER_LEADER_URL),
  RELAYER_PORT: maybeIntString(process.env.RELAYER_PORT),
  PORT: maybeIntString(process.env.PORT),
  NEXT_PUBLIC_PROXY_WALLET_TYPE: (() => {
    const t = String(process.env.NEXT_PUBLIC_PROXY_WALLET_TYPE || "")
      .trim()
      .toLowerCase();
    return t === "safe" || t === "safe4337" || t === "proxy" ? (t as any) : undefined;
  })(),
  PROXY_WALLET_FACTORY_ADDRESS: maybeEthAddress(process.env.PROXY_WALLET_FACTORY_ADDRESS),
  SAFE_FACTORY_ADDRESS: maybeEthAddress(process.env.SAFE_FACTORY_ADDRESS),
  SAFE_SINGLETON_ADDRESS: maybeEthAddress(process.env.SAFE_SINGLETON_ADDRESS),
  SAFE_FALLBACK_HANDLER_ADDRESS: maybeEthAddress(process.env.SAFE_FALLBACK_HANDLER_ADDRESS),
};

const parsed = EnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  console.warn("Relayer env invalid:", parsed.error.flatten().fieldErrors);
}

export const BUNDLER_PRIVATE_KEY = parsed.success ? parsed.data.BUNDLER_PRIVATE_KEY : undefined;
export const OPERATOR_PRIVATE_KEY = parsed.success ? parsed.data.OPERATOR_PRIVATE_KEY : undefined;
export const RELAYER_GASLESS_SIGNER_PRIVATE_KEY = parsed.success
  ? parsed.data.RELAYER_GASLESS_SIGNER_PRIVATE_KEY
  : undefined;
export const AA_ENABLED = parsed.success ? (parsed.data.AA_ENABLED ?? false) : false;
export const EMBEDDED_AUTH_ENABLED = parsed.success
  ? (parsed.data.EMBEDDED_AUTH_ENABLED ?? false)
  : false;
export const CUSTODIAL_SIGNER_PRIVATE_KEY = parsed.success
  ? parsed.data.CUSTODIAL_SIGNER_PRIVATE_KEY
  : undefined;
export const GASLESS_ENABLED = (() => {
  if (!parsed.success) return false;
  const aa = Boolean(parsed.data.AA_ENABLED ?? false);
  const gasless = Boolean(parsed.data.GASLESS_ENABLED ?? parsed.data.AA_ENABLED ?? false);
  return aa && gasless;
})();
export const RELAYER_GASLESS_PAYMASTER_URL = parsed.success
  ? parsed.data.RELAYER_GASLESS_PAYMASTER_URL
  : undefined;
export const ENTRYPOINT_ADDRESS = parsed.success ? parsed.data.ENTRYPOINT_ADDRESS : undefined;
export const CHAIN_ID = parsed.success ? (parsed.data.CHAIN_ID ?? 80002) : 80002;
export const RELAYER_LEADER_PROXY_URL = parsed.success
  ? parsed.data.RELAYER_LEADER_PROXY_URL
  : undefined;
export const RELAYER_LEADER_URL = parsed.success ? parsed.data.RELAYER_LEADER_URL : undefined;
export const PROXY_WALLET_TYPE = parsed.success
  ? parsed.data.NEXT_PUBLIC_PROXY_WALLET_TYPE
  : undefined;
export const PROXY_WALLET_FACTORY_ADDRESS = parsed.success
  ? parsed.data.PROXY_WALLET_FACTORY_ADDRESS
  : undefined;
export const SAFE_FACTORY_ADDRESS = parsed.success ? parsed.data.SAFE_FACTORY_ADDRESS : undefined;
export const SAFE_SINGLETON_ADDRESS = parsed.success
  ? parsed.data.SAFE_SINGLETON_ADDRESS
  : undefined;
export const SAFE_FALLBACK_HANDLER_ADDRESS = parsed.success
  ? parsed.data.SAFE_FALLBACK_HANDLER_ADDRESS
  : undefined;
const DEFAULT_RPC_URL = DEFAULT_RPC_URLS[CHAIN_ID] || "http://127.0.0.1:8545";
export const RPC_URL = (parsed.success ? parsed.data.RPC_URL : undefined) || DEFAULT_RPC_URL;
export const RELAYER_PORT =
  (parsed.success ? (parsed.data.RELAYER_PORT ?? parsed.data.PORT) : undefined) ?? 3000;
import express from "express";
import cors from "cors";
import { ethers, Contract } from "ethers";
import EntryPointAbi from "./abi/EntryPoint.json" with { type: "json" };
import { supabaseAdmin } from "./supabase.js";
import {
  placeSignedOrder,
  cancelSalt,
  getDepth,
  getQueue,
  getOrderTypes,
  ingestTrade,
  ingestTradesByLogs,
  getCandles,
} from "./orderbook.js";

// 🚀 导入新的撮合引擎
import { MatchingEngine, MarketWebSocketServer, type OrderInput } from "./matching/index.js";
import { clusterFollowerRejectedTotal } from "./monitoring/metrics.js";
import { proxyToLeader } from "./cluster/leaderProxy.js";
import { ClusteredWebSocketServer } from "./cluster/websocketCluster.js";
import {
  MetaTransactionHandler,
  type MetaTransactionRequest,
} from "./settlement/metaTransaction.js";

// 导入合约ABI
import MarketFactoryABI from "./abi/MarketFactory.json" with { type: "json" };
import OffchainMarketBaseABI from "./abi/OffchainMarketBase.json" with { type: "json" };
import OutcomeToken1155ABI from "./abi/OutcomeToken1155.json" with { type: "json" };
import UMAOracleAdapterV2ABI from "./abi/UMAOracleAdapterV2.json" with { type: "json" };

export const app = express();
const trustProxyHops = Math.max(0, readIntEnv("RELAYER_TRUST_PROXY_HOPS", 0));
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

// 🚀 初始化撮合引擎和 WebSocket 服务器
const matchingEngine = new MatchingEngine({
  makerFeeBps: Math.max(0, readIntEnv("MAKER_FEE_BPS", 0)),
  takerFeeBps: Math.max(0, readIntEnv("TAKER_FEE_BPS", 0)),
  maxMarketLongExposureUsdc: Math.max(0, readNumberEnv("RELAYER_MAX_MARKET_LONG_EXPOSURE_USDC", 0)),
  maxMarketShortExposureUsdc: Math.max(
    0,
    readNumberEnv("RELAYER_MAX_MARKET_SHORT_EXPOSURE_USDC", 0)
  ),
});

let wsServer: MarketWebSocketServer | ClusteredWebSocketServer | null = null;

// 🚀 连接撮合引擎事件到 WebSocket
matchingEngine.on("market_event", (event) => {
  void wsServer?.handleMarketEvent(event as any);
});

matchingEngine.on(
  "trade",
  (trade: {
    marketKey: string;
    outcomeIndex: number;
    amount: bigint;
    price: bigint;
    maker: string;
    taker: string;
  }) => {
    // 🚀 Phase 1: 结构化日志 + 指标
    matchingLogger.info("Trade executed", {
      marketKey: trade.marketKey,
      outcomeIndex: trade.outcomeIndex,
      amount: trade.amount.toString(),
      price: trade.price.toString(),
      maker: trade.maker,
      taker: trade.taker,
    });

    // 记录指标
    matchesTotal.inc({
      market_key: trade.marketKey,
      outcome_index: String(trade.outcomeIndex),
    });
    const volumeBigInt = (trade.amount * trade.price) / 1_000_000_000_000_000_000n;
    const volume = Number(volumeBigInt) / 1000000;
    if (Number.isFinite(volume) && volume >= 0) {
      matchedVolumeTotal.inc(
        {
          market_key: trade.marketKey,
          outcome_index: String(trade.outcomeIndex),
        },
        volume
      );
    }
  }
);

// 🚀 连接结算事件
matchingEngine.on("settlement_event", (event) => {
  logger.info("Settlement event", { type: event.type, ...event });
});

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function readIntEnv(name: string, fallback: number): number {
  return Math.trunc(readNumberEnv(name, fallback));
}

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

type ApiKeyEntry = {
  keyId: string;
  keyHash: string;
  keyBytes: Uint8Array;
  scopes: Set<string>;
};

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

function getClientIp(req: express.Request): string {
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

function getApiKeyFromRequest(req: express.Request): string | null {
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

type ResolvedApiKey = {
  keyId: string;
  keyHash: string;
  scopes: Set<string>;
  source: "env" | "redis";
};

const apiKeyPositiveCache = new Map<string, MicroCacheEntry<ResolvedApiKey>>();
const apiKeyNegativeCache = new Map<string, MicroCacheEntry<true>>();

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
      return new Set<string>(parsed.map((v) => String(v || "").trim()).filter((v) => v.length > 0));
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
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

function getRateLimitIdentityFromResolvedKey(
  key: ResolvedApiKey | null,
  req: express.Request
): string {
  if (key) return `api:${key.keyId}`;
  const raw = getApiKeyFromRequest(req);
  if (raw) {
    const keyHash = buildApiKeyHash(raw);
    return `api:${buildApiKeyIdFromHash(keyHash)}`;
  }
  return `ip:${getClientIp(req)}`;
}

type RateTier = "admin" | "trader" | "anon";

function getRateTierFromScopes(scopes: Set<string> | null): RateTier {
  if (!scopes) return "anon";
  if (scopes.has("admin")) return "admin";
  return "trader";
}

function createRoleBasedLimiter(
  envPrefix: string,
  defaults: { admin: number; trader: number; anon: number; windowMs: number }
) {
  const windowMs = Math.max(100, readIntEnv(`${envPrefix}_WINDOW_MS`, defaults.windowMs));
  const adminMax = Math.max(1, readIntEnv(`${envPrefix}_ADMIN_MAX`, defaults.admin));
  const traderMax = Math.max(1, readIntEnv(`${envPrefix}_TRADER_MAX`, defaults.trader));
  const anonMax = Math.max(1, readIntEnv(`${envPrefix}_ANON_MAX`, defaults.anon));

  const adminLimiter = new RedisSlidingWindowLimiter({
    windowMs,
    maxRequests: adminMax,
    keyPrefix: `ratelimit:${envPrefix}:admin:`,
  });
  const traderLimiter = new RedisSlidingWindowLimiter({
    windowMs,
    maxRequests: traderMax,
    keyPrefix: `ratelimit:${envPrefix}:trader:`,
  });
  const anonLimiter = new RedisSlidingWindowLimiter({
    windowMs,
    maxRequests: anonMax,
    keyPrefix: `ratelimit:${envPrefix}:anon:`,
  });

  return async function roleBasedRateLimit(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) return next();
    }

    const raw = getApiKeyFromRequest(req);
    const resolved = raw ? await resolveApiKey(raw) : null;
    const identity = getRateLimitIdentityFromResolvedKey(resolved, req);
    const tier = getRateTierFromScopes(resolved?.scopes || null);

    const rateReq: RateLimitRequest = {
      ip: identity,
      path: req.path,
      method: req.method,
    };
    const limiter =
      tier === "admin" ? adminLimiter : tier === "trader" ? traderLimiter : anonLimiter;
    const result = await limiter.check(rateReq);
    res.setHeader(
      "X-RateLimit-Limit",
      tier === "admin" ? adminMax : tier === "trader" ? traderMax : anonMax
    );
    res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
    res.setHeader("X-RateLimit-Reset", result.resetAt ? Math.ceil(result.resetAt / 1000) : 0);
    if (!result.allowed) {
      if (result.retryAfter) res.setHeader("Retry-After", result.retryAfter);
      apiRateLimitHits.inc({ path: req.path });
      return res.status(429).json({
        success: false,
        message: "Too many requests",
        retryAfter: result.retryAfter,
      });
    }
    return next();
  };
}

const limitOrders = createRoleBasedLimiter("RELAYER_RATE_LIMIT_ORDERS", {
  admin: 1000,
  trader: 120,
  anon: 30,
  windowMs: 60000,
});
const limitReportTrade = createRoleBasedLimiter("RELAYER_RATE_LIMIT_REPORT_TRADE", {
  admin: 2000,
  trader: 240,
  anon: 60,
  windowMs: 60000,
});
const limitGasless = createRoleBasedLimiter("RELAYER_RATE_LIMIT_GASLESS", {
  admin: 200,
  trader: 60,
  anon: 20,
  windowMs: 60000,
});

type IdempotencyEntry = {
  expiresAtMs: number;
  status: number;
  body: any;
};

const idempotencyStore = new Map<string, IdempotencyEntry>();
let idempotencyCleanupIter: IterableIterator<[string, IdempotencyEntry]> | null = null;
let idempotencyLastCleanupAtMs = 0;

function cleanupIdempotencyStore(nowMs: number, maxScan: number) {
  if (!idempotencyCleanupIter) {
    idempotencyCleanupIter = idempotencyStore.entries();
  }
  let scanned = 0;
  while (scanned < maxScan) {
    const n = idempotencyCleanupIter.next();
    if (n.done) {
      idempotencyCleanupIter = null;
      break;
    }
    scanned += 1;
    const [k, v] = n.value;
    if (v.expiresAtMs <= nowMs) idempotencyStore.delete(k);
  }
}

function getIdempotencyKey(req: express.Request, extra: string): string | null {
  const headerKey = String(req.headers["x-idempotency-key"] || "").trim();
  const requestId = String(req.headers["x-request-id"] || (req as any).requestId || "").trim();
  const base = headerKey || requestId;
  if (!base) return null;
  return `${req.method}:${extra}:${base}`;
}

function getIdempotencyRedisKey(key: string): string {
  return `idempotency:${key}`;
}

async function getIdempotencyEntry(key: string): Promise<IdempotencyEntry | null> {
  const entry = idempotencyStore.get(key);
  if (entry) {
    if (entry.expiresAtMs <= Date.now()) {
      idempotencyStore.delete(key);
    } else {
      return entry;
    }
  }

  if (process.env.RELAYER_IDEMPOTENCY_REDIS === "false") return null;

  const redis = getRedisClient();
  if (!redis.isReady()) return null;

  const raw = await redis.get(getIdempotencyRedisKey(key));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IdempotencyEntry;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.expiresAtMs !== "number" ||
      typeof parsed.status !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAtMs <= Date.now()) return null;
    idempotencyStore.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function setIdempotencyEntry(key: string, status: number, body: any): Promise<void> {
  const ttlMs = Math.max(1000, readIntEnv("RELAYER_IDEMPOTENCY_TTL_MS", 60000));
  const entry: IdempotencyEntry = {
    expiresAtMs: Date.now() + ttlMs,
    status,
    body,
  };
  idempotencyStore.set(key, entry);
  const now = Date.now();
  if (
    (idempotencyStore.size > 2000 && now - idempotencyLastCleanupAtMs > 1000) ||
    idempotencyStore.size > 8000
  ) {
    idempotencyLastCleanupAtMs = now;
    cleanupIdempotencyStore(now, idempotencyStore.size > 8000 ? 2000 : 200);
  }
  const hardCap = Math.max(1000, readIntEnv("RELAYER_IDEMPOTENCY_MAX_KEYS", 10000));
  if (idempotencyStore.size > hardCap) {
    cleanupIdempotencyStore(now, 5000);
    while (idempotencyStore.size > hardCap) {
      const oldestKey = idempotencyStore.keys().next().value;
      if (!oldestKey) break;
      idempotencyStore.delete(oldestKey);
    }
  }

  if (process.env.RELAYER_IDEMPOTENCY_REDIS === "false") return;
  const redis = getRedisClient();
  if (!redis.isReady()) return;

  const ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000));
  try {
    await redis.set(getIdempotencyRedisKey(key), JSON.stringify(entry), ttlSeconds);
  } catch {}
}

function getLeaderProxyUrl(): string {
  return String(
    process.env.RELAYER_LEADER_PROXY_URL || process.env.RELAYER_LEADER_URL || ""
  ).trim();
}

type LeaderIdCache = {
  leaderId: string | null;
  expiresAtMs: number;
  inFlight: Promise<string | null> | null;
};

const leaderIdCache: LeaderIdCache = {
  leaderId: null,
  expiresAtMs: 0,
  inFlight: null,
};

async function getCachedLeaderId(
  cluster: ReturnType<typeof getClusterManager>
): Promise<string | null> {
  const known = cluster.getKnownLeaderId();
  if (known) return known;
  const now = Date.now();
  const ttlMs = Math.max(200, readIntEnv("RELAYER_LEADER_ID_CACHE_MS", 1000));
  if (leaderIdCache.leaderId && now < leaderIdCache.expiresAtMs) {
    return leaderIdCache.leaderId;
  }
  if (leaderIdCache.inFlight) return leaderIdCache.inFlight;
  leaderIdCache.inFlight = cluster
    .getLeaderId()
    .catch(() => null)
    .then((id) => {
      leaderIdCache.leaderId = id;
      leaderIdCache.expiresAtMs = Date.now() + ttlMs;
      leaderIdCache.inFlight = null;
      return id;
    });
  return leaderIdCache.inFlight;
}

type MicroCacheEntry<T> = { expiresAtMs: number; value: T };
function microCacheGet<T>(cache: Map<string, MicroCacheEntry<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAtMs <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function microCacheSet<T>(
  cache: Map<string, MicroCacheEntry<T>>,
  key: string,
  ttlMs: number,
  value: T,
  maxSize: number
) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
  cache.set(key, { expiresAtMs: Date.now() + ttlMs, value });
  if (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

const depthMicroCache = new Map<string, MicroCacheEntry<any>>();
const statsMicroCache = new Map<string, MicroCacheEntry<any>>();
const gaslessQuotaMicroCache = new Map<string, MicroCacheEntry<number>>();
const intentStatusMicroCache = new Map<string, MicroCacheEntry<any>>();

function sendNotLeader(
  res: express.Response,
  payload: { leaderId: string | null; nodeId?: string; path: string }
) {
  const proxyUrl = getLeaderProxyUrl();
  res.status(503).json({
    success: false,
    message: "Not leader",
    leaderId: payload.leaderId,
    nodeId: payload.nodeId || null,
    path: payload.path,
    retryable: true,
    suggestedWaitMs: 1000,
    proxyUrlConfigured: !!proxyUrl,
  });
}

function sendApiError(
  req: express.Request,
  res: express.Response,
  status: number,
  payload: { message: string; detail?: any; errorCode?: string | null }
) {
  const requestId = String(req.headers["x-request-id"] || (req as any).requestId || "").trim();
  const body = {
    success: false,
    message: payload.message,
    ...(typeof payload.detail !== "undefined" ? { detail: payload.detail } : {}),
    ...(typeof payload.errorCode !== "undefined" ? { errorCode: payload.errorCode } : {}),
    ...(requestId ? { requestId } : {}),
  };
  res.status(status).json(body);
  return body;
}

function setIdempotencyIfPresent(idemKey: string | null, status: number, body: any): void {
  if (!idemKey) return;
  if (status >= 500) return;
  void setIdempotencyEntry(idemKey, status, body);
}

function getGaslessQuotaKey(userAddress: string): string {
  return `gasless:quota:day:${userAddress.toLowerCase()}`;
}

async function getGaslessQuotaUsage(
  userAddress: string
): Promise<{ used: number; remaining: number }> {
  const limit =
    Number(process.env.RELAYER_GASLESS_DAILY_LIMIT_USD || "0") > 0
      ? Number(process.env.RELAYER_GASLESS_DAILY_LIMIT_USD || "0")
      : 0;
  if (limit <= 0) return { used: 0, remaining: Number.POSITIVE_INFINITY };

  const cacheKey = userAddress.toLowerCase();
  const cached = microCacheGet(gaslessQuotaMicroCache, cacheKey);
  if (typeof cached === "number") {
    return { used: cached, remaining: Math.max(0, limit - cached) };
  }

  const redis = getRedisClient();
  if (!redis.isReady()) return { used: 0, remaining: limit };

  const raw = await redis.get(getGaslessQuotaKey(userAddress));
  const used = raw ? Number(raw) || 0 : 0;
  microCacheSet(gaslessQuotaMicroCache, cacheKey, 5000, used, 5000);
  return { used, remaining: Math.max(0, limit - used) };
}

async function addGaslessQuotaUsage(userAddress: string, costUsd: number): Promise<void> {
  if (!(Number(process.env.RELAYER_GASLESS_DAILY_LIMIT_USD || "0") > 0)) return;
  if (!(Number.isFinite(costUsd) && costUsd > 0)) return;
  const redis = getRedisClient();
  if (!redis.isReady()) return;
  const key = getGaslessQuotaKey(userAddress);
  const now = Date.now();
  const endOfDay =
    new Date(now).setUTCHours(23, 59, 59, 999) - new Date(now).getTimezoneOffset() * 60000;
  const ttlSeconds = Math.max(60, Math.floor((endOfDay - now) / 1000));
  try {
    const raw = await redis.get(key);
    const next = (raw ? Number(raw) || 0 : 0) + costUsd;
    await redis.set(key, String(next), ttlSeconds);
  } catch {}
  const cacheKey = userAddress.toLowerCase();
  const cached = microCacheGet(gaslessQuotaMicroCache, cacheKey);
  if (typeof cached === "number") {
    const next = cached + costUsd;
    microCacheSet(gaslessQuotaMicroCache, cacheKey, 5000, next, 5000);
  }
}

type IntentStatus = "pending" | "confirming" | "failed";

type TradeIntentRecord = {
  id: string;
  type: "trade";
  userAddress: string;
  marketKey: string;
  chainId: number;
  createdAt: number;
  updatedAt: number;
  status: IntentStatus;
  txHash: string | null;
  error: string | null;
};

function getIntentRedisKey(id: string): string {
  return `intent:${id}`;
}

async function saveTradeIntent(record: TradeIntentRecord): Promise<void> {
  const redis = getRedisClient();
  const ttlSeconds = Math.max(
    60,
    Math.floor((Number(process.env.RELAYER_INTENT_TTL_MS || "86400000") || 86400000) / 1000)
  );
  try {
    await redis.set(getIntentRedisKey(record.id), JSON.stringify(record), ttlSeconds);
  } catch {}
  microCacheSet(intentStatusMicroCache, record.id, 5000, record, 5000);
}

async function loadIntent(id: string): Promise<TradeIntentRecord | null> {
  const cached = microCacheGet(intentStatusMicroCache, id) as TradeIntentRecord | null;
  if (cached) return cached;
  const redis = getRedisClient();
  if (!redis.isReady()) return null;
  try {
    const raw = await redis.get(getIntentRedisKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TradeIntentRecord;
    if (!parsed || typeof parsed !== "object") return null;
    microCacheSet(intentStatusMicroCache, id, 5000, parsed, 5000);
    return parsed;
  } catch {
    return null;
  }
}

const allowedOriginsRaw = process.env.RELAYER_CORS_ORIGINS || "";
const allowedOrigins = allowedOriginsRaw
  .split(",")
  .map((v) => v.trim())
  .filter((v) => v.length > 0);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  })
);
app.use(express.json({ limit: "1mb" }));

// 🚀 Phase 1: 添加监控中间件
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(metricsMiddleware);
app.use(createRateLimitMiddleware());

// 🚀 Phase 1: 添加健康检查路由
app.use(healthRoutes);

// 🚀 Phase 2: 添加集群管理路由
app.use(clusterRoutes);

const PORT = RELAYER_PORT;

let provider: ethers.JsonRpcProvider | null = null;
let bundlerWallet: ethers.Wallet | null = null;
try {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  if (BUNDLER_PRIVATE_KEY) {
    bundlerWallet = new ethers.Wallet(BUNDLER_PRIVATE_KEY, provider);
    console.log(`Bundler address: ${bundlerWallet.address}`);
  }
} catch {
  provider = null;
  bundlerWallet = null;
}

const parseOutcomeIndex = (value: unknown): number | null => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof (value as any).toString === "function") {
    const n = Number((value as any).toString());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const syncMarketResolution = async (
  marketAddressRaw: string,
  status: "resolved" | "invalidated",
  outcomeIndex: number | null
) => {
  if (!supabaseAdmin) return;
  const marketAddress = String(marketAddressRaw || "").toLowerCase();
  if (!marketAddress) return;
  const { data, error } = await supabaseAdmin
    .from("markets_map")
    .select("event_id,chain_id")
    .eq("market", marketAddress)
    .eq("chain_id", CHAIN_ID)
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error("Failed to load market map for resolution sync", {
      marketAddress,
      chainId: CHAIN_ID,
      error: error.message,
    });
    return;
  }
  if (!data) return;

  const nowIso = new Date().toISOString();
  const marketUpdate = await supabaseAdmin
    .from("markets_map")
    .update({ status })
    .eq("event_id", data.event_id)
    .eq("chain_id", data.chain_id);
  if (marketUpdate.error) {
    logger.error("Failed to update markets_map status", {
      marketAddress,
      eventId: data.event_id,
      chainId: data.chain_id,
      error: marketUpdate.error.message,
    });
  }

  const predictionUpdate: Record<string, any> = {
    status: status === "resolved" ? "completed" : "cancelled",
    settled_at: nowIso,
  };
  if (status === "resolved" && outcomeIndex !== null) {
    predictionUpdate.winning_outcome = String(outcomeIndex);
  }
  if (status === "invalidated") {
    predictionUpdate.winning_outcome = null;
  }
  const predictionRes = await supabaseAdmin
    .from("predictions")
    .update(predictionUpdate)
    .eq("id", data.event_id);
  if (predictionRes.error) {
    logger.error("Failed to update prediction status", {
      eventId: data.event_id,
      status: predictionUpdate.status,
      error: predictionRes.error.message,
    });
  }

  const marketKey = `${data.chain_id}:${data.event_id}`;
  try {
    await matchingEngine.closeMarket(marketKey, { reason: status });
  } catch (error: any) {
    logger.error("Failed to close market orderbook", {
      marketKey,
      reason: status,
      error: String(error?.message || error),
    });
  }
};

// 初始化合约事件监听器
async function initContractListener() {
  try {
    const marketFactoryAddress = process.env.MARKET_FACTORY_ADDRESS;
    if (!marketFactoryAddress) {
      logger.warn("MARKET_FACTORY_ADDRESS 未配置，跳过合约事件监听器初始化");
      return;
    }

    await initContractEventListener({
      marketFactoryAddress,
      marketFactoryAbi: MarketFactoryABI,
      offchainMarketAbi: OffchainMarketBaseABI,
      outcomeTokenAbi: OutcomeToken1155ABI,
      eventHandlers: {
        Resolved: async (event: any) => {
          marketsResolvedTotal.inc();
          marketsActive.dec();
          const outcomeIndex = parseOutcomeIndex(event?.args?.outcomeIndex);
          logger.info("Market resolved", {
            marketAddress: event.address,
            outcomeIndex: outcomeIndex === null ? null : String(outcomeIndex),
          });
          await syncMarketResolution(event.address, "resolved", outcomeIndex);
        },
        Invalidated: async (event: any) => {
          marketsInvalidatedTotal.inc();
          marketsActive.dec();
          logger.warn("Market invalidated", {
            marketAddress: event.address,
          });
          await syncMarketResolution(event.address, "invalidated", null);
        },
      },
    });

    logger.info("合约事件监听器初始化成功");
  } catch (error) {
    logger.error("合约事件监听器初始化失败", {
      error: String(error),
    });
  }
}

// 混沌工程实例
let chaosInstance: any = null;

app.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.send("Foresight Relayer is running!");
});

app.post("/", async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/");
          if (ok) return;
        }
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/",
        });
        return;
      }
    }
    const idemKey = getIdempotencyKey(req, "/");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }
    if (!bundlerWallet) {
      return res.status(501).json({
        jsonrpc: "2.0",
        id: req.body?.id,
        error: { code: -32601, message: "Bundler disabled" },
      });
    }
    const { userOp, entryPointAddress } = req.body;
    if (!userOp || !entryPointAddress) {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: { code: -32602, message: "Invalid params" },
      });
    }
    const entryPoint = new Contract(entryPointAddress, EntryPointAbi, bundlerWallet);
    const tx = await entryPoint.handleOps([userOp], bundlerWallet.address);
    const receipt = await tx.wait();
    const responseBody = {
      jsonrpc: "2.0",
      id: req.body.id,
      result: receipt.hash,
    };
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (error: any) {
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body.id,
      error: { code: -32602, message: "Internal error", data: error.message },
    });
  }
});

const DEFAULT_ENTRYPOINT_ADDRESSES: Record<number, string> = {
  80002: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  137: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  11155111: "0x0000000071727de22e5e9d8baf0edac6f37da032",
};

function resolveEntryPointAddress(raw: unknown): string | null {
  const body = raw && typeof raw === "object" ? (raw as any) : {};
  const candidate = maybeEthAddress(
    body.entryPointAddress || body.entryPoint || body.entryPoint_address
  );
  if (candidate) return candidate.toLowerCase();
  if (ENTRYPOINT_ADDRESS) return ENTRYPOINT_ADDRESS.toLowerCase();
  const fallback = DEFAULT_ENTRYPOINT_ADDRESSES[CHAIN_ID];
  return fallback ? fallback.toLowerCase() : null;
}

const HexAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((v) => v.toLowerCase());

const HexDataSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]+$/);

const HexDataOrEmptySchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]*$/);

const BigIntFromNumberishSchema = z.preprocess((v) => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return v;
    return BigInt(Math.trunc(v));
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return v;
    try {
      return BigInt(s);
    } catch {
      return v;
    }
  }
  return v;
}, z.bigint());

const GaslessOrderSchema = z.object({
  marketKey: z.string().min(1),
  chainId: z.number().int().positive(),
  marketAddress: HexAddressSchema,
  usdcAddress: HexAddressSchema.optional(),
  userAddress: HexAddressSchema,
  fillAmount: BigIntFromNumberishSchema,
  order: z.object({
    maker: HexAddressSchema,
    outcomeIndex: z.number().int().min(0),
    isBuy: z.boolean(),
    price: BigIntFromNumberishSchema,
    amount: BigIntFromNumberishSchema,
    salt: BigIntFromNumberishSchema,
    expiry: BigIntFromNumberishSchema,
  }),
  orderSignature: HexDataSchema,
  permit: z
    .object({
      owner: HexAddressSchema,
      spender: HexAddressSchema,
      value: BigIntFromNumberishSchema,
      nonce: BigIntFromNumberishSchema,
      deadline: BigIntFromNumberishSchema,
      signature: HexDataSchema,
    })
    .optional(),
  meta: z
    .object({
      clientOrderId: z.string().max(128).optional(),
      deviceId: z.string().max(128).optional(),
      intentType: z.enum(["order"]).optional(),
      maxCostUsd: z.number().positive().optional(),
    })
    .optional(),
});

const UserOperationSchema = z.object({
  sender: HexAddressSchema,
  nonce: BigIntFromNumberishSchema,
  initCode: HexDataOrEmptySchema,
  callData: HexDataOrEmptySchema,
  callGasLimit: BigIntFromNumberishSchema,
  verificationGasLimit: BigIntFromNumberishSchema,
  preVerificationGas: BigIntFromNumberishSchema,
  maxFeePerGas: BigIntFromNumberishSchema,
  maxPriorityFeePerGas: BigIntFromNumberishSchema,
  paymasterAndData: HexDataOrEmptySchema,
  signature: HexDataOrEmptySchema,
});

const AaUserOpDraftSchema = z.object({
  owner: HexAddressSchema,
  userOp: UserOperationSchema,
  entryPointAddress: HexAddressSchema.optional(),
});

app.post("/aa/userop/draft", requireApiKey("aa", "aa_userop_draft"), async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/aa/userop/draft");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/aa/userop/draft" });
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/aa/userop/draft",
        });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/aa/userop/draft");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    if (!provider) {
      const body = sendApiError(req, res, 503, {
        message: "RPC provider unavailable",
        errorCode: "RPC_UNAVAILABLE",
      });
      setIdempotencyIfPresent(idemKey, 503, body);
      return;
    }

    const parsed = AaUserOpDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      const body = sendApiError(req, res, 400, {
        message: "Invalid params",
        detail: parsed.error.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPointAddress =
      (parsed.data.entryPointAddress || resolveEntryPointAddress(req.body))?.toLowerCase() || "";
    if (!entryPointAddress) {
      const body = sendApiError(req, res, 400, {
        message: "EntryPoint not configured",
        errorCode: "ENTRYPOINT_MISSING",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPoint = new Contract(entryPointAddress, EntryPointAbi, provider);
    const userOpHash = await entryPoint.getUserOpHash(parsed.data.userOp);

    const responseBody = {
      success: true,
      owner: parsed.data.owner,
      entryPointAddress,
      userOp: parsed.data.userOp,
      userOpHash,
    };
    res.json(responseBody);
    setIdempotencyIfPresent(idemKey, 200, responseBody);
  } catch (error: any) {
    const body = sendApiError(req, res, 500, {
      message: "Internal error",
      detail: String(error?.message || error),
    });
    return body;
  }
});

const AaUserOpSimulateSchema = z.object({
  owner: HexAddressSchema,
  userOp: UserOperationSchema,
  entryPointAddress: HexAddressSchema.optional(),
});

app.post("/aa/userop/simulate", requireApiKey("aa", "aa_userop_simulate"), async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/aa/userop/simulate");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/aa/userop/simulate" });
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/aa/userop/simulate",
        });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/aa/userop/simulate");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    if (!provider) {
      const body = sendApiError(req, res, 503, {
        message: "RPC provider unavailable",
        errorCode: "RPC_UNAVAILABLE",
      });
      setIdempotencyIfPresent(idemKey, 503, body);
      return;
    }

    const parsed = AaUserOpSimulateSchema.safeParse(req.body);
    if (!parsed.success) {
      const body = sendApiError(req, res, 400, {
        message: "Invalid params",
        detail: parsed.error.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPointAddress =
      (parsed.data.entryPointAddress || resolveEntryPointAddress(req.body))?.toLowerCase() || "";
    if (!entryPointAddress) {
      const body = sendApiError(req, res, 400, {
        message: "EntryPoint not configured",
        errorCode: "ENTRYPOINT_MISSING",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPoint = new Contract(entryPointAddress, EntryPointAbi, provider);
    const userOpHash = await entryPoint.getUserOpHash(parsed.data.userOp);

    let gasEstimate: string | null = null;
    try {
      const estimate = await entryPoint.handleOps.estimateGas(
        [parsed.data.userOp],
        bundlerWallet?.address || parsed.data.owner,
        bundlerWallet?.address ? { from: bundlerWallet.address } : undefined
      );
      gasEstimate = estimate ? estimate.toString() : null;
    } catch {
      gasEstimate = null;
    }

    const responseBody = {
      success: true,
      owner: parsed.data.owner,
      entryPointAddress,
      userOpHash,
      gasEstimate,
    };
    res.json(responseBody);
    setIdempotencyIfPresent(idemKey, 200, responseBody);
  } catch (error: any) {
    const body = sendApiError(req, res, 500, {
      message: "Internal error",
      detail: String(error?.message || error),
    });
    return body;
  }
});

const AaUserOpSubmitSchema = z.object({
  owner: HexAddressSchema,
  userOp: z.any(),
  signature: HexDataOrEmptySchema.optional(),
  entryPointAddress: HexAddressSchema.optional(),
});

app.post("/aa/userop/submit", requireApiKey("aa", "aa_userop_submit"), async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/aa/userop/submit");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/aa/userop/submit" });
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/aa/userop/submit",
        });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/aa/userop/submit");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    if (!bundlerWallet) {
      const body = sendApiError(req, res, 501, {
        message: "Bundler disabled",
        errorCode: "BUNDLER_DISABLED",
      });
      setIdempotencyIfPresent(idemKey, 501, body);
      return;
    }

    const parsed = AaUserOpSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      const body = sendApiError(req, res, 400, {
        message: "Invalid params",
        detail: parsed.error.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const entryPointAddress =
      (parsed.data.entryPointAddress || resolveEntryPointAddress(req.body))?.toLowerCase() || "";
    if (!entryPointAddress) {
      const body = sendApiError(req, res, 400, {
        message: "EntryPoint not configured",
        errorCode: "ENTRYPOINT_MISSING",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const opParsed = UserOperationSchema.safeParse(parsed.data.userOp);
    if (!opParsed.success) {
      const body = sendApiError(req, res, 400, {
        message: "Invalid userOp",
        detail: opParsed.error.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, body);
      return;
    }

    const userOp = opParsed.data as any;
    if (parsed.data.signature && (!userOp.signature || userOp.signature === "0x")) {
      userOp.signature = parsed.data.signature;
    }

    const entryPoint = new Contract(entryPointAddress, EntryPointAbi, bundlerWallet);
    const tx = await entryPoint.handleOps([userOp], bundlerWallet.address);
    const receipt = await tx.wait();

    const responseBody = {
      success: true,
      txHash: receipt?.hash ?? tx.hash,
    };
    res.json(responseBody);
    setIdempotencyIfPresent(idemKey, 200, responseBody);
  } catch (error: any) {
    const body = sendApiError(req, res, 500, {
      message: "Internal error",
      detail: String(error?.message || error),
    });
    return body;
  }
});

const CustodialSignSchema = z.object({
  userOp: z.any(),
  owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

app.post("/aa/custodial/sign", requireApiKey("admin", "custodial_sign"), async (req, res) => {
  try {
    if (!CUSTODIAL_SIGNER_PRIVATE_KEY) {
      return sendApiError(req, res, 503, {
        message: "Custodial signing not configured",
        errorCode: "CUSTODIAL_DISABLED",
      });
    }

    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/aa/custodial/sign");
          if (ok) return;
        }
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/aa/custodial/sign",
        });
        return;
      }
    }

    const parsed = CustodialSignSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendApiError(req, res, 400, {
        message: "Invalid params",
        detail: parsed.error.flatten(),
      });
    }

    const { userOp, owner } = parsed.data;

    // 这里可以添加更多校验：比如确认 owner 是我们系统内注册的邮箱托管地址
    // 简单起见，我们假设调用方（Web API）已经验证了权限

    // 计算 UserOp Hash 并签名
    // 注意：UserOp 的打包和哈希计算通常需要 chainId 和 entryPoint
    // 为了简化，我们假设前端或上游传来的 userOp 已经是需要签名的结构，或者我们需要自己重新计算
    // 这里为了演示，我们使用 ethers 直接对 hash 进行签名，假设 userOp 包含预计算的 hash
    // 或者我们需要重新构建 UserOpHash

    // 更正：UserOp 签名需要对 UserOpHash 进行签名
    // UserOpHash = keccak256(pack(userOp, entryPoint, chainId))
    // 由于我们没有 entryPoint 和 chainId 参数传入，我们假设调用方传递了 userOpHash
    // 或者我们可以从 userOp 中提取并自行计算（但这需要 ABI 编码）

    // 为了稳健，我们要求请求体直接包含 userOpHash，或者我们在这里只做 "Message Signing"
    // 真正的 UserOp 签名是 signMessage(arrayify(userOpHash))

    const userOpHash = req.body.userOpHash;
    if (!userOpHash || typeof userOpHash !== "string" || !userOpHash.startsWith("0x")) {
      return sendApiError(req, res, 400, { message: "Missing userOpHash" });
    }

    const signer = new ethers.Wallet(CUSTODIAL_SIGNER_PRIVATE_KEY);
    // 对 hash 进行签名（Ethereum Signed Message）
    const signature = await signer.signMessage(ethers.getBytes(userOpHash));

    res.json({ success: true, signature });
  } catch (error: any) {
    logger.error("Custodial sign error", { error: String(error) });
    sendApiError(req, res, 500, {
      message: "Internal error",
      detail: error.message,
    });
  }
});

app.post(
  "/v2/gasless/order",
  limitGasless,
  requireApiKey("orders", "v2_gasless_order"),
  async (req, res) => {
    try {
      if (!GASLESS_ENABLED || !RELAYER_GASLESS_SIGNER_PRIVATE_KEY) {
        return sendApiError(req, res, 503, {
          message: "Gasless disabled",
          errorCode: "GASLESS_DISABLED",
        });
      }

      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/v2/gasless/order");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/v2/gasless/order" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/v2/gasless/order",
          });
          return;
        }
      }

      const idemKey = getIdempotencyKey(req, "/v2/gasless/order");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }

      let parsed: z.infer<typeof GaslessOrderSchema>;
      try {
        parsed = GaslessOrderSchema.parse(req.body || {});
      } catch (e: any) {
        if (e instanceof z.ZodError) {
          const responseBody = sendApiError(req, res, 400, {
            message: "gasless order validation failed",
            detail: e.flatten(),
            errorCode: "VALIDATION_ERROR",
          });
          setIdempotencyIfPresent(idemKey, 400, responseBody);
          return;
        }
        const responseBody = sendApiError(req, res, 400, {
          message: "gasless order validation failed",
          detail: String(e?.message || e),
          errorCode: "VALIDATION_ERROR",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }

      const userAddress = parsed.userAddress.toLowerCase();
      const quota = await getGaslessQuotaUsage(userAddress);
      if (quota.remaining <= 0) {
        const responseBody = sendApiError(req, res, 429, {
          message: "Gasless quota exceeded",
          errorCode: "GASLESS_QUOTA_EXCEEDED",
        });
        setIdempotencyIfPresent(idemKey, 429, responseBody);
        return;
      }

      const intentCostUsd =
        typeof parsed.meta?.maxCostUsd === "number" && parsed.meta.maxCostUsd > 0
          ? parsed.meta.maxCostUsd
          : Number(process.env.RELAYER_GASLESS_DEFAULT_COST_USD || "0.1");
      if (Number.isFinite(intentCostUsd) && intentCostUsd > 0 && quota.remaining < intentCostUsd) {
        const responseBody = sendApiError(req, res, 429, {
          message: "Gasless quota insufficient for intent",
          errorCode: "GASLESS_QUOTA_EXCEEDED",
        });
        setIdempotencyIfPresent(idemKey, 429, responseBody);
        return;
      }

      const marketKey = parsed.marketKey;
      const marketKeyParts = marketKey.split(":");
      if (marketKeyParts.length < 2) {
        const responseBody = sendApiError(req, res, 400, {
          message: "Invalid marketKey",
          errorCode: "INVALID_MARKET_KEY",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }

      const redis = getRedisClient();
      if (!redis.isReady()) {
        return sendApiError(req, res, 503, {
          message: "Redis not ready",
          errorCode: "REDIS_UNAVAILABLE",
        });
      }

      const riskKeyUser = `risk:blacklist:user:${userAddress}`;
      const riskKeyIp = `risk:blacklist:ip:${getClientIp(req)}`;
      const [userFlag, ipFlag] = await Promise.all([redis.get(riskKeyUser), redis.get(riskKeyIp)]);
      if (userFlag === "1" || ipFlag === "1") {
        const responseBody = sendApiError(req, res, 403, {
          message: "Gasless blocked by risk control",
          errorCode: "GASLESS_BLOCKED",
        });
        setIdempotencyIfPresent(idemKey, 403, responseBody);
        return;
      }

      const marketKeyPrefix = `${parsed.chainId}:`;
      if (!marketKey.startsWith(marketKeyPrefix)) {
        const responseBody = sendApiError(req, res, 400, {
          message: "marketKey does not match chainId",
          errorCode: "INVALID_MARKET_KEY",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }

      const fillAmount = parsed.fillAmount;
      const order: MetaTransactionRequest["order"] = {
        maker: parsed.order.maker,
        outcomeIndex: parsed.order.outcomeIndex,
        isBuy: parsed.order.isBuy,
        price: parsed.order.price,
        amount: parsed.order.amount,
        salt: parsed.order.salt,
        expiry: parsed.order.expiry,
      };

      const permit = parsed.permit
        ? {
            owner: parsed.permit.owner,
            spender: parsed.permit.spender,
            value: parsed.permit.value,
            nonce: parsed.permit.nonce,
            deadline: parsed.permit.deadline,
            signature: parsed.permit.signature,
          }
        : undefined;

      const metaTxRequest: MetaTransactionRequest = {
        order,
        orderSignature: parsed.orderSignature,
        fillAmount,
        permit,
        requestedAt: Date.now(),
        userAddress,
      };

      const usdcAddress =
        parsed.usdcAddress ||
        (process.env.COLLATERAL_TOKEN_ADDRESS as string | undefined) ||
        (process.env.USDC_ADDRESS as string | undefined) ||
        (process.env.NEXT_PUBLIC_USDC_ADDRESS as string | undefined) ||
        "";
      if (!usdcAddress) {
        return sendApiError(req, res, 500, {
          message: "USDC address not configured",
          errorCode: "USDC_NOT_CONFIGURED",
        });
      }

      if (!provider) {
        return sendApiError(req, res, 503, {
          message: "RPC provider not available",
          errorCode: "RPC_UNAVAILABLE",
        });
      }

      const handler = new MetaTransactionHandler(
        parsed.chainId,
        parsed.marketAddress,
        usdcAddress,
        RELAYER_GASLESS_SIGNER_PRIVATE_KEY,
        RPC_URL
      );

      const intentId = `intent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const now = Date.now();
      const baseIntent: TradeIntentRecord = {
        id: intentId,
        type: "trade",
        userAddress,
        marketKey,
        chainId: parsed.chainId,
        createdAt: now,
        updatedAt: now,
        status: "pending",
        txHash: null,
        error: null,
      };
      await saveTradeIntent(baseIntent);

      const result = await handler.processMetaTransaction(metaTxRequest);
      if (!result.success) {
        const failedIntent: TradeIntentRecord = {
          ...baseIntent,
          status: "failed",
          updatedAt: Date.now(),
          error: result.error || "Gasless order failed",
        };
        await saveTradeIntent(failedIntent);
        const responseBody = sendApiError(req, res, 400, {
          message: result.error || "Gasless order failed",
          errorCode: "GASLESS_FAILED",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }

      const confirmingIntent: TradeIntentRecord = {
        ...baseIntent,
        status: "confirming",
        updatedAt: Date.now(),
        txHash: result.txHash || null,
      };
      await saveTradeIntent(confirmingIntent);

      if (Number.isFinite(intentCostUsd) && intentCostUsd > 0) {
        void addGaslessQuotaUsage(userAddress, intentCostUsd).catch(() => {});
      }

      const responseBody = {
        success: true,
        data: {
          intentId,
          txHash: result.txHash || null,
          marketKey,
          userAddress,
          chainId: parsed.chainId,
        },
      };
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      logger.error("v2 gasless order failed", { path: "/v2/gasless/order" }, e);
      return sendApiError(req, res, 500, {
        message: "Gasless order failed",
        detail: String(e?.message || e),
        errorCode: "INTERNAL_ERROR",
      });
    }
  }
);

app.get("/v2/intents/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return sendApiError(req, res, 400, {
        message: "Intent id is required",
        errorCode: "INTENT_ID_REQUIRED",
      });
    }
    const record = await loadIntent(id);
    if (!record) {
      return sendApiError(req, res, 404, {
        message: "Intent not found",
        errorCode: "INTENT_NOT_FOUND",
      });
    }
    res.json({
      success: true,
      data: record,
    });
  } catch (e: any) {
    return sendApiError(req, res, 500, {
      message: "Failed to load intent",
      detail: String(e?.message || e),
      errorCode: "INTERNAL_ERROR",
    });
  }
});

// Off-chain orderbook API (legacy - 保留兼容)
app.post(
  "/orderbook/orders",
  limitOrders,
  requireApiKey("orders", "orderbook_orders"),
  async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return sendApiError(req, res, 500, {
          message: "Supabase not configured",
          errorCode: "SUPABASE_NOT_CONFIGURED",
        });
      }
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/orderbook/orders");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/orderbook/orders" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/orderbook/orders",
          });
          return;
        }
      }
      const idemKey = getIdempotencyKey(req, "/orderbook/orders");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }
      const body = req.body || {};
      const data = await placeSignedOrder(body);
      const responseBody = { success: true, data };
      logger.info("orderbook order accepted", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      return sendApiError(req, res, 400, {
        message: "place order failed",
        detail: String(e?.message || e),
      });
    }
  }
);

const OrderInputSchema = z.object({
  marketKey: z.string().min(1),
  maker: HexAddressSchema,
  outcomeIndex: z.number().int().min(0),
  isBuy: z.boolean(),
  price: BigIntFromNumberishSchema,
  amount: BigIntFromNumberishSchema,
  salt: z.string().min(1),
  expiry: z.number().int().min(0),
  signature: HexDataSchema,
  chainId: z.number().int().positive(),
  verifyingContract: HexAddressSchema,
  tif: z.enum(["GTC", "IOC", "FOK", "FAK", "GTD"]).optional(),
  postOnly: z.boolean().optional(),
  clientOrderId: z.string().min(1).max(128).optional(),
});

function pickString(...candidates: any[]): string {
  for (const c of candidates) {
    if (typeof c === "string") {
      const v = c.trim();
      if (v) return v;
      continue;
    }
    if (typeof c === "number") {
      if (Number.isFinite(c)) return String(c);
      continue;
    }
    if (typeof c === "bigint") return c.toString();
  }
  return "";
}

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "y";
  }
  return false;
}

function parseV2OrderInput(body: any): OrderInput {
  const root = body && typeof body === "object" ? body : {};
  const orderBody =
    (root.order || root.order_data) && typeof (root.order || root.order_data) === "object"
      ? root.order || root.order_data
      : {};

  const chainIdRaw = pickString(
    root.chainId,
    root.chain_id,
    orderBody.chainId,
    orderBody.chain_id,
    0
  );
  const chainId = Number(chainIdRaw);
  const marketKey = pickString(
    root.marketKey,
    root.market_key,
    `${pickString(
      root.chainId,
      root.chain_id,
      orderBody.chainId,
      orderBody.chain_id,
      0
    )}:${pickString(root.eventId, root.event_id, "unknown")}`
  );

  const verifyingContract = pickString(
    root.verifyingContract,
    orderBody.verifyingContract,
    root.verifying_contract,
    orderBody.verifying_contract,
    root.verifying_contract_address,
    orderBody.verifying_contract_address,
    root.contract,
    orderBody.contract,
    root.contractAddress,
    orderBody.contractAddress,
    root.marketAddress,
    orderBody.marketAddress
  );

  const tifRaw = pickString(orderBody.tif, root.tif);
  const tif = tifRaw ? (tifRaw.trim().toUpperCase() as any) : undefined;

  const normalized = {
    marketKey,
    maker: pickString(orderBody.maker, root.maker),
    outcomeIndex: Number(
      pickString(
        orderBody.outcomeIndex,
        orderBody.outcome_index,
        root.outcomeIndex,
        root.outcome_index,
        0
      )
    ),
    isBuy: toBool(orderBody.isBuy ?? orderBody.is_buy ?? root.isBuy ?? root.is_buy),
    price: pickString(orderBody.price, root.price),
    amount: pickString(orderBody.amount, root.amount),
    salt: pickString(orderBody.salt, root.salt),
    expiry: Number(pickString(orderBody.expiry, orderBody.expiresAt, root.expiry, 0)),
    signature: pickString(root.signature, orderBody.signature),
    chainId,
    verifyingContract,
    tif,
    postOnly:
      typeof (orderBody.postOnly ?? orderBody.post_only) !== "undefined"
        ? toBool(orderBody.postOnly ?? orderBody.post_only)
        : undefined,
    clientOrderId:
      typeof (orderBody.clientOrderId ?? orderBody.client_order_id ?? root.clientOrderId) ===
      "string"
        ? String(orderBody.clientOrderId ?? orderBody.client_order_id ?? root.clientOrderId)
        : undefined,
  };

  return OrderInputSchema.parse(normalized) as OrderInput;
}

/**
 * POST /v2/orders - 提交订单并撮合
 * 新的撮合引擎入口，支持即时撮合
 */
app.post("/v2/orders", limitOrders, requireApiKey("orders", "v2_orders"), async (req, res) => {
  try {
    if (clusterIsActive) {
      const cluster = getClusterManager();
      if (!cluster.isLeader()) {
        const leaderId = await getCachedLeaderId(cluster);
        const proxyUrl = getLeaderProxyUrl();
        if (proxyUrl) {
          const ok = await proxyToLeader(proxyUrl, req, res, "/v2/orders");
          if (ok) return;
        }
        clusterFollowerRejectedTotal.inc({ path: "/v2/orders" });
        sendNotLeader(res, {
          leaderId,
          nodeId: cluster.getNodeId(),
          path: "/v2/orders",
        });
        return;
      }
    }

    const idemKey = getIdempotencyKey(req, "/v2/orders");
    if (idemKey) {
      const hit = await getIdempotencyEntry(idemKey);
      if (hit) return res.status(hit.status).json(hit.body);
    }

    let orderInput: OrderInput;
    try {
      orderInput = parseV2OrderInput(req.body);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        const responseBody = sendApiError(req, res, 400, {
          message: "order validation failed",
          detail: e.flatten(),
          errorCode: "VALIDATION_ERROR",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }
      const responseBody = sendApiError(req, res, 400, {
        message: "order validation failed",
        detail: String(e?.message || e),
        errorCode: "VALIDATION_ERROR",
      });
      setIdempotencyIfPresent(idemKey, 400, responseBody);
      return;
    }

    if (supabaseAdmin) {
      const marketKeyRaw = String(orderInput.marketKey || "").trim();
      const [mkChain, mkEvent] = marketKeyRaw.split(":");
      const eventId = Number(mkEvent);
      const chainId = Number(mkChain);
      let marketStatus: string | null = null;
      let statusError: string | null = null;

      if (Number.isFinite(eventId) && Number.isFinite(chainId)) {
        const { data, error } = await supabaseAdmin
          .from("markets_map")
          .select("status")
          .eq("event_id", eventId)
          .eq("chain_id", chainId)
          .limit(1)
          .maybeSingle();
        if (error) statusError = error.message;
        if (data?.status != null) marketStatus = String(data.status);
      } else if (orderInput.verifyingContract) {
        const { data, error } = await supabaseAdmin
          .from("markets_map")
          .select("status")
          .eq("market", orderInput.verifyingContract.toLowerCase())
          .eq("chain_id", orderInput.chainId)
          .limit(1)
          .maybeSingle();
        if (error) statusError = error.message;
        if (data?.status != null) marketStatus = String(data.status);
      }

      if (statusError) {
        logger.error("Failed to load market status", {
          marketKey: orderInput.marketKey,
          chainId: orderInput.chainId,
          verifyingContract: orderInput.verifyingContract,
          error: statusError,
        });
      } else if (marketStatus && marketStatus.toLowerCase() !== "open") {
        const responseBody = sendApiError(req, res, 400, {
          message: "Market closed",
          errorCode: "MARKET_CLOSED",
        });
        setIdempotencyIfPresent(idemKey, 400, responseBody);
        return;
      }
    }

    // 提交到撮合引擎
    const result = await matchingEngine.submitOrder(orderInput);

    if (!result.success) {
      const responseBody = sendApiError(req, res, 400, {
        message: result.error || "Order submission failed",
        errorCode: result.errorCode || null,
      });
      setIdempotencyIfPresent(idemKey, 400, responseBody);
      return;
    }

    const filledAmount = result.matches.reduce<bigint>((acc, m) => acc + m.matchedAmount, 0n);

    let status: string;
    if (orderInput.tif === "FOK") {
      status = filledAmount === orderInput.amount ? "filled" : "canceled";
    } else if (orderInput.tif === "IOC" || orderInput.tif === "FAK") {
      if (filledAmount === 0n) {
        status = "canceled";
      } else if (filledAmount < orderInput.amount) {
        status = "partially_filled";
      } else {
        status = "filled";
      }
    } else {
      if (!result.remainingOrder) {
        status = "filled";
      } else if (filledAmount === 0n) {
        status = "open";
      } else {
        status = "partially_filled";
      }
    }

    const responseBody = {
      success: true,
      data: {
        orderId: orderInput.salt,
        matchesCount: result.matches.length,
        matches: result.matches.map((m) => ({
          matchId: m.id,
          matchedAmount: m.matchedAmount.toString(),
          matchedPrice: m.matchedPrice.toString(),
          makerFee: m.makerFee.toString(),
          takerFee: m.takerFee.toString(),
        })),
        remainingAmount: result.remainingOrder?.remainingAmount.toString() || "0",
        status,
        tif: orderInput.tif || null,
        postOnly: !!orderInput.postOnly,
        requestedAmount: orderInput.amount.toString(),
        filledAmount: filledAmount.toString(),
      },
    };
    logger.info("v2 order accepted", {
      requestId: (req as any).requestId || null,
      apiKeyId: (req as any).apiKeyId || null,
      marketKey: orderInput.marketKey,
      outcomeIndex: orderInput.outcomeIndex,
      maker: orderInput.maker,
      isBuy: orderInput.isBuy,
      amount: orderInput.amount.toString(),
      price: orderInput.price.toString(),
      status,
    });
    res.json(responseBody);
    if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
  } catch (e: any) {
    logger.error("v2 orders failed", { path: "/v2/orders" }, e);
    return sendApiError(req, res, 500, {
      message: "Order submission failed",
      detail: String(e?.message || e),
      errorCode: "INTERNAL_ERROR",
    });
  }
});

const CancelV2Schema = z
  .object({
    marketKey: z.string().min(1),
    outcomeIndex: z
      .preprocess(
        (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
        z.number().int().min(0)
      )
      .optional(),
    outcome_index: z
      .preprocess(
        (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
        z.number().int().min(0)
      )
      .optional(),
    chainId: z.preprocess(
      (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
      z.number().int().positive()
    ),
    verifyingContract: z.string().optional(),
    verifying_contract: z.string().optional(),
    verifying_contract_address: z.string().optional(),
    contract: z.string().optional(),
    contractAddress: z.string().optional(),
    ownerEoa: z.string().optional(),
    owner_eoa: z.string().optional(),
    maker: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    salt: z.preprocess((v) => (typeof v === "string" ? v : String(v)), z.string().min(1)),
    signature: HexDataSchema,
  })
  .refine((v) => typeof v.outcomeIndex === "number" || typeof v.outcome_index === "number", {
    message: "outcomeIndex is required",
    path: ["outcomeIndex"],
  })
  .transform((v) => ({
    marketKey: v.marketKey,
    outcomeIndex: (v.outcomeIndex ?? v.outcome_index) as number,
    chainId: v.chainId,
    verifyingContract:
      v.verifyingContract ||
      v.verifying_contract ||
      v.verifying_contract_address ||
      v.contract ||
      v.contractAddress ||
      "",
    ownerEoa: v.ownerEoa || v.owner_eoa,
    maker: v.maker,
    salt: v.salt,
    signature: v.signature,
  }))
  .refine((v) => /^0x[0-9a-fA-F]{40}$/.test(v.verifyingContract), {
    message: "Invalid verifyingContract",
    path: ["verifyingContract"],
  });

app.post(
  "/v2/cancel-salt",
  limitOrders,
  requireApiKey("orders", "v2_cancel_salt"),
  async (req, res) => {
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/v2/cancel-salt");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/v2/cancel-salt" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/v2/cancel-salt",
          });
          return;
        }
      }

      const idemKey = getIdempotencyKey(req, "/v2/cancel-salt");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }

      const parsed = CancelV2Schema.parse(req.body || {});
      const result = await matchingEngine.cancelOrder(
        parsed.marketKey,
        parsed.outcomeIndex,
        parsed.chainId,
        parsed.verifyingContract,
        parsed.maker,
        parsed.salt,
        parsed.signature,
        parsed.ownerEoa || undefined
      );
      if (!result.success) {
        const responseBody = sendApiError(req, res, 400, {
          message: result.error || "Cancel failed",
          errorCode: result.errorCode || "CANCEL_FAILED",
        });
        if (idemKey) void setIdempotencyEntry(idemKey, 400, responseBody);
        return;
      }
      const responseBody = { success: true, data: { ok: true } };
      logger.info("v2 cancel salt accepted", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        marketKey: parsed.marketKey,
        outcomeIndex: parsed.outcomeIndex,
        chainId: parsed.chainId,
        maker: parsed.maker,
        salt: parsed.salt,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        const responseBody = sendApiError(req, res, 400, {
          message: "cancel validation failed",
          detail: e.flatten(),
          errorCode: "VALIDATION_ERROR",
        });
        const idemKey = getIdempotencyKey(req, "/v2/cancel-salt");
        if (idemKey) void setIdempotencyEntry(idemKey, 400, responseBody);
        return;
      }
      const responseBody = sendApiError(req, res, 400, {
        message: "Cancel failed",
        detail: String(e?.message || e),
        errorCode: "CANCEL_FAILED",
      });
      const idemKey = getIdempotencyKey(req, "/v2/cancel-salt");
      if (idemKey) void setIdempotencyEntry(idemKey, 400, responseBody);
      return;
    }
  }
);

const V2DepthQuerySchema = z.object({
  marketKey: z.string().min(1),
  outcomeIndex: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  levels: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 20;
    return Math.max(1, Math.min(50, n));
  }, z.number().int().min(1).max(50)),
});

const V2StatsQuerySchema = z.object({
  marketKey: z.string().min(1),
  outcomeIndex: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
});

/**
 * GET /v2/depth - 获取订单簿深度 (从内存)
 * 比数据库查询快 10-100 倍
 */
app.get("/v2/depth", async (req, res) => {
  try {
    const parsed = V2DepthQuerySchema.parse({
      marketKey: req.query.marketKey || req.query.market_key,
      outcomeIndex: req.query.outcomeIndex ?? req.query.outcome_index ?? req.query.outcome ?? 0,
      levels: req.query.levels ?? 20,
    });
    const marketKey = parsed.marketKey;
    const outcomeIndex = parsed.outcomeIndex;
    const levels = parsed.levels;
    const microCacheMs = clampNumber(readIntEnv("RELAYER_MICROCACHE_MS", 200), 0, 1000);
    const roleKey =
      clusterIsActive && !getClusterManager().isLeader()
        ? "follower"
        : clusterIsActive
          ? "leader"
          : "standalone";
    const cacheKey = `${roleKey}:${marketKey}:${outcomeIndex}:${levels}`;
    const cached = microCacheGet(depthMicroCache, cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=1");
      return res.json(cached);
    }

    if (clusterIsActive) {
      const cluster = getClusterManager();
      const redis = getRedisClient();
      if (!cluster.isLeader() && redis.isReady()) {
        try {
          const snapshotService = getOrderbookSnapshotService();
          const pub = await snapshotService.loadPublicSnapshot(marketKey, outcomeIndex);
          if (pub) {
            const responseBody = {
              success: true,
              data: {
                marketKey,
                outcomeIndex,
                bids: pub.bids.slice(0, levels),
                asks: pub.asks.slice(0, levels),
                timestamp: pub.updatedAt || Date.now(),
                source: "redis_public_snapshot",
              },
            };
            res.setHeader("Cache-Control", "public, max-age=1");
            res.json(responseBody);
            microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
            return;
          }
          const loaded = await snapshotService.loadSnapshot(marketKey, outcomeIndex);
          if (loaded) {
            const bidLevels = new Map<string, { price: bigint; qty: bigint; count: number }>();
            const askLevels = new Map<string, { price: bigint; qty: bigint; count: number }>();

            for (const o of loaded.orders) {
              if (!o || o.remainingAmount <= 0n) continue;
              const key = o.price.toString();
              const map = o.isBuy ? bidLevels : askLevels;
              const existing = map.get(key);
              if (existing) {
                existing.qty += o.remainingAmount;
                existing.count += 1;
              } else {
                map.set(key, {
                  price: o.price,
                  qty: o.remainingAmount,
                  count: 1,
                });
              }
            }

            const bids = [...bidLevels.values()].sort((a, b) =>
              a.price > b.price ? -1 : a.price < b.price ? 1 : 0
            );
            const asks = [...askLevels.values()].sort((a, b) =>
              a.price < b.price ? -1 : a.price > b.price ? 1 : 0
            );

            res.setHeader("Cache-Control", "public, max-age=1");
            const responseBody = {
              success: true,
              data: {
                marketKey,
                outcomeIndex,
                bids: bids.slice(0, levels).map((l) => ({
                  price: l.price.toString(),
                  qty: l.qty.toString(),
                  count: l.count,
                })),
                asks: asks.slice(0, levels).map((l) => ({
                  price: l.price.toString(),
                  qty: l.qty.toString(),
                  count: l.count,
                })),
                timestamp: Date.now(),
                source: "redis_snapshot",
              },
            };
            res.json(responseBody);
            microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
            return;
          }
        } catch {}
      }
    }

    try {
      let snapshot = matchingEngine.getOrderBookSnapshot(marketKey, outcomeIndex, levels);
      if (!snapshot) {
        await matchingEngine.warmupOrderBook(marketKey, outcomeIndex);
        snapshot = matchingEngine.getOrderBookSnapshot(marketKey, outcomeIndex, levels);
      }

      if (!snapshot) {
        const responseBody = {
          success: true,
          data: { bids: [], asks: [], timestamp: Date.now() },
        };
        res.setHeader("Cache-Control", "public, max-age=1");
        res.json(responseBody);
        microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
        return;
      }

      const responseBody = {
        success: true,
        data: {
          marketKey: snapshot.marketKey,
          outcomeIndex: snapshot.outcomeIndex,
          bids: snapshot.bids.map((l) => ({
            price: l.price.toString(),
            qty: l.totalQuantity.toString(),
            count: l.orderCount,
          })),
          asks: snapshot.asks.map((l) => ({
            price: l.price.toString(),
            qty: l.totalQuantity.toString(),
            count: l.orderCount,
          })),
          timestamp: snapshot.timestamp,
        },
      };
      res.setHeader("Cache-Control", "public, max-age=1");
      res.json(responseBody);
      microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
      return;
    } catch {
      const responseBody = {
        success: true,
        data: { bids: [], asks: [], timestamp: Date.now() },
      };
      res.setHeader("Cache-Control", "public, max-age=1");
      res.json(responseBody);
      microCacheSet(depthMicroCache, cacheKey, microCacheMs, responseBody, 500);
      return;
    }
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "Depth query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "Depth query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

/**
 * GET /v2/stats - 获取订单簿统计
 */
app.get("/v2/stats", async (req, res) => {
  try {
    const parsed = V2StatsQuerySchema.parse({
      marketKey: req.query.marketKey || req.query.market_key,
      outcomeIndex: req.query.outcomeIndex ?? req.query.outcome_index ?? req.query.outcome ?? 0,
    });
    const marketKey = parsed.marketKey;
    const outcomeIndex = parsed.outcomeIndex;
    const microCacheMs = clampNumber(readIntEnv("RELAYER_MICROCACHE_MS", 200), 0, 1000);
    const roleKey =
      clusterIsActive && !getClusterManager().isLeader()
        ? "follower"
        : clusterIsActive
          ? "leader"
          : "standalone";
    const cacheKey = `${roleKey}:${marketKey}:${outcomeIndex}`;
    const cached = microCacheGet(statsMicroCache, cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=1");
      return res.json(cached);
    }

    if (clusterIsActive) {
      const cluster = getClusterManager();
      const redis = getRedisClient();
      if (!cluster.isLeader() && redis.isReady()) {
        try {
          const snapshotService = getOrderbookSnapshotService();
          const pub = await snapshotService.loadPublicSnapshot(marketKey, outcomeIndex);
          if (pub) {
            const responseBody = {
              success: true,
              data: {
                marketKey,
                outcomeIndex,
                bestBid: pub.bestBid,
                bestAsk: pub.bestAsk,
                spread: pub.spread,
                bidDepth: pub.bidDepth,
                askDepth: pub.askDepth,
                lastTradePrice: pub.lastTradePrice,
                volume24h: pub.volume24h,
                source: "redis_public_snapshot",
              },
            };
            res.setHeader("Cache-Control", "public, max-age=1");
            res.json(responseBody);
            microCacheSet(statsMicroCache, cacheKey, microCacheMs, responseBody, 500);
            return;
          }
          const loaded = await snapshotService.loadSnapshot(marketKey, outcomeIndex);
          if (loaded) {
            let bestBid: bigint | null = null;
            let bestAsk: bigint | null = null;
            let bidDepth = 0n;
            let askDepth = 0n;

            for (const o of loaded.orders) {
              if (!o || o.remainingAmount <= 0n) continue;
              if (o.isBuy) {
                bidDepth += o.remainingAmount;
                if (bestBid === null || o.price > bestBid) bestBid = o.price;
              } else {
                askDepth += o.remainingAmount;
                if (bestAsk === null || o.price < bestAsk) bestAsk = o.price;
              }
            }

            const lastTradePrice =
              typeof loaded.stats.lastTradePrice === "bigint" ? loaded.stats.lastTradePrice : null;
            const volume24h =
              typeof loaded.stats.volume24h === "bigint" ? loaded.stats.volume24h : 0n;
            const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

            res.setHeader("Cache-Control", "public, max-age=1");
            const responseBody = {
              success: true,
              data: {
                marketKey,
                outcomeIndex,
                bestBid: bestBid?.toString() || null,
                bestAsk: bestAsk?.toString() || null,
                spread: spread?.toString() || null,
                bidDepth: bidDepth.toString(),
                askDepth: askDepth.toString(),
                lastTradePrice: lastTradePrice?.toString() || null,
                volume24h: volume24h.toString(),
                source: "redis_snapshot",
              },
            };
            res.json(responseBody);
            microCacheSet(statsMicroCache, cacheKey, microCacheMs, responseBody, 500);
            return;
          }
        } catch {}
      }
    }

    let stats = matchingEngine.getOrderBookStats(marketKey, outcomeIndex);
    if (!stats) {
      try {
        await matchingEngine.warmupOrderBook(marketKey, outcomeIndex);
        stats = matchingEngine.getOrderBookStats(marketKey, outcomeIndex);
      } catch {}
    }

    if (!stats) {
      const responseBody = {
        success: true,
        data: {
          bestBid: null,
          bestAsk: null,
          spread: null,
          bidDepth: "0",
          askDepth: "0",
          lastTradePrice: null,
          volume24h: "0",
        },
      };
      res.setHeader("Cache-Control", "public, max-age=1");
      res.json(responseBody);
      microCacheSet(statsMicroCache, cacheKey, microCacheMs, responseBody, 500);
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=1");
    const responseBody = {
      success: true,
      data: {
        marketKey: stats.marketKey,
        outcomeIndex: stats.outcomeIndex,
        bestBid: stats.bestBid?.toString() || null,
        bestAsk: stats.bestAsk?.toString() || null,
        spread: stats.spread?.toString() || null,
        bidDepth: stats.bidDepth.toString(),
        askDepth: stats.askDepth.toString(),
        lastTradePrice: stats.lastTradePrice?.toString() || null,
        volume24h: stats.volume24h.toString(),
      },
    };
    res.json(responseBody);
    microCacheSet(statsMicroCache, cacheKey, microCacheMs, responseBody, 500);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "Stats query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "Stats query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

/**
 * GET /v2/ws-info - WebSocket 连接信息
 */
app.get("/v2/ws-info", (_req, res) => {
  const stats = wsServer ? (wsServer as any).getStats?.() : { connections: 0, subscriptions: 0 };
  const wsPort = clampNumber(readIntEnv("WS_PORT", 3006), 1, 65535);
  res.json({
    success: true,
    data: {
      wsPort,
      connections: stats.connections,
      subscriptions: stats.subscriptions,
      channels: [
        "depth:{marketKey}:{outcomeIndex}",
        "trades:{marketKey}:{outcomeIndex}",
        "stats:{marketKey}:{outcomeIndex}",
        "orders:{marketKey}:{outcomeIndex}",
      ],
    },
  });
});

const V2RegisterSettlerSchema = z.object({
  marketKey: z.string().min(1),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  marketAddress: HexAddressSchema,
});

const V2CloseMarketSchema = z.object({
  marketKey: z.string().min(1),
  reason: z.string().optional(),
});

/**
 * POST /v2/register-settler - 注册市场结算器
 * 由管理员调用,为市场配置 Operator
 */
app.post(
  "/v2/register-settler",
  limitOrders,
  requireApiKey("admin", "v2_register_settler"),
  async (req, res) => {
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/v2/register-settler");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/v2/register-settler" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/v2/register-settler",
          });
          return;
        }
      }

      const idemKey = getIdempotencyKey(req, "/v2/register-settler");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }

      const parsed = V2RegisterSettlerSchema.parse(req.body || {});

      // 从环境变量获取 Operator 配置
      const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.BUNDLER_PRIVATE_KEY;
      const rpcUrl = RPC_URL;

      if (!operatorKey) {
        return sendApiError(req, res, 500, {
          message: "Operator private key not configured",
          errorCode: "CONFIG_ERROR",
        });
      }

      const settler = matchingEngine.registerSettler(
        parsed.marketKey,
        parsed.chainId,
        parsed.marketAddress,
        operatorKey,
        rpcUrl
      );

      const responseBody = {
        success: true,
        data: {
          marketKey: parsed.marketKey,
          operatorAddress: settler.getOperatorAddress(),
          status: "registered",
        },
      };
      logger.info("settler registered", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        marketKey: parsed.marketKey,
        chainId: parsed.chainId,
        marketAddress: parsed.marketAddress,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return sendApiError(req, res, 400, {
          message: "register settler validation failed",
          detail: e.flatten(),
          errorCode: "VALIDATION_ERROR",
        });
      }
      logger.error("register settler failed", { path: "/v2/register-settler" }, e);
      return sendApiError(req, res, 500, {
        message: "Failed to register settler",
        detail: String(e?.message || e),
        errorCode: "INTERNAL_ERROR",
      });
    }
  }
);

/**
 * GET /v2/settlement-stats - 获取结算统计
 */
app.get("/v2/settlement-stats", (_req, res) => {
  const stats = matchingEngine.getSettlementStats();
  res.json({ success: true, data: stats });
});

/**
 * POST /v2/market/close - 关闭市场并清理订单簿
 */
app.post(
  "/v2/market/close",
  limitOrders,
  requireApiKey("admin", "v2_market_close"),
  async (req, res) => {
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/v2/market/close");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/v2/market/close" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/v2/market/close",
          });
          return;
        }
      }

      const idemKey = getIdempotencyKey(req, "/v2/market/close");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }

      const parsed = V2CloseMarketSchema.parse(req.body || {});
      const result = await matchingEngine.closeMarket(parsed.marketKey, {
        reason: parsed.reason,
      });

      const responseBody = { success: true, data: result };
      logger.info("market closed", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        marketKey: parsed.marketKey,
        outcomes: result.outcomes.length,
        canceledOrders: result.canceledOrders,
        clearedBooks: result.clearedBooks,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return sendApiError(req, res, 400, {
          message: "market close validation failed",
          detail: e.flatten(),
          errorCode: "VALIDATION_ERROR",
        });
      }
      logger.error("market close failed", { path: "/v2/market/close" }, e);
      return sendApiError(req, res, 500, {
        message: "Failed to close market",
        detail: String(e?.message || e),
        errorCode: "INTERNAL_ERROR",
      });
    }
  }
);

/**
 * GET /v2/operator-status - 获取 Operator 状态
 */
app.get("/v2/operator-status", async (req, res) => {
  try {
    const marketKey = z
      .string()
      .min(1)
      .parse(req.query.marketKey || "");
    const settler = matchingEngine.getSettler(marketKey);

    if (!settler) {
      return sendApiError(req, res, 404, {
        message: "Settler not found for this market",
        errorCode: "NOT_FOUND",
      });
    }

    const balance = await settler.getOperatorBalance();
    const stats = settler.getStats();

    res.json({
      success: true,
      data: {
        marketKey,
        operatorAddress: settler.getOperatorAddress(),
        balance,
        stats,
      },
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "operator status validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "Failed to get operator status",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

app.post(
  "/orderbook/cancel-salt",
  limitOrders,
  requireApiKey("orders", "orderbook_cancel_salt"),
  async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return sendApiError(req, res, 500, {
          message: "Supabase not configured",
          errorCode: "SUPABASE_NOT_CONFIGURED",
        });
      }
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/orderbook/cancel-salt");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/orderbook/cancel-salt" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/orderbook/cancel-salt",
          });
          return;
        }
      }
      const idemKey = getIdempotencyKey(req, "/orderbook/cancel-salt");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }
      const body = req.body || {};
      const data = await cancelSalt(body);
      const responseBody = { success: true, data };
      logger.info("orderbook cancel salt accepted", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      return sendApiError(req, res, 400, {
        message: "cancel salt failed",
        detail: String(e?.message || e),
        errorCode: "BAD_REQUEST",
      });
    }
  }
);

const DepthQuerySchema = z.object({
  contract: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((v) => v.toLowerCase()),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  side: z
    .string()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "buy" || v === "sell", {
      message: "side must be buy or sell",
    }),
  levels: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 10;
    return Math.max(1, Math.min(50, n));
  }, z.number().int().min(1).max(50)),
  marketKey: z.string().optional(),
  market_key: z.string().optional(),
});

const QueueQuerySchema = z.object({
  contract: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .transform((v) => v.toLowerCase()),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  side: z
    .string()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "buy" || v === "sell", {
      message: "side must be buy or sell",
    }),
  price: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? BigInt(String(v)) : v),
    z.bigint()
  ),
  limit: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(200, n));
  }, z.number().int().min(1).max(200)),
  offset: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, n);
  }, z.number().int().min(0)),
  marketKey: z.string().optional(),
  market_key: z.string().optional(),
});

const CandlesQuerySchema = z.object({
  market: z.string(),
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  outcome: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().min(0)
  ),
  resolution: z.string().default("15m"),
  limit: z.preprocess((v) => {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 100;
    return Math.max(1, Math.min(1000, n));
  }, z.number().int().min(1).max(1000)),
});

const TradeReportSchema = z.object({
  chainId: z.preprocess(
    (v) => (typeof v === "string" || typeof v === "number" ? Number(v) : v),
    z.number().int().positive()
  ),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

app.get("/orderbook/depth", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return sendApiError(req, res, 500, {
        message: "Supabase not configured",
        errorCode: "SUPABASE_NOT_CONFIGURED",
      });
    }
    const parsed = DepthQuerySchema.parse({
      contract: req.query.contract,
      chainId: req.query.chainId,
      outcome: req.query.outcome,
      side: req.query.side || "buy",
      levels: req.query.levels,
      marketKey: req.query.marketKey,
      market_key: req.query.market_key,
    });
    const isBuy = parsed.side === "buy";
    const marketKey =
      typeof parsed.marketKey === "string"
        ? parsed.marketKey
        : typeof parsed.market_key === "string"
          ? parsed.market_key
          : undefined;
    const data = await getDepth(
      parsed.contract,
      parsed.chainId as number,
      parsed.outcome as number,
      isBuy,
      parsed.levels as number,
      marketKey
    );
    res.setHeader("Cache-Control", "public, max-age=2");
    res.json({ success: true, data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "depth query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "depth query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

app.get("/orderbook/queue", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return sendApiError(req, res, 500, {
        message: "Supabase not configured",
        errorCode: "SUPABASE_NOT_CONFIGURED",
      });
    }
    const parsed = QueueQuerySchema.parse({
      contract: req.query.contract,
      chainId: req.query.chainId,
      outcome: req.query.outcome,
      side: req.query.side || "buy",
      price: req.query.price || "0",
      limit: req.query.limit,
      offset: req.query.offset,
      marketKey: req.query.marketKey,
      market_key: req.query.market_key,
    });
    const isBuy = parsed.side === "buy";
    const marketKey =
      typeof parsed.marketKey === "string"
        ? parsed.marketKey
        : typeof parsed.market_key === "string"
          ? parsed.market_key
          : undefined;
    const data = await getQueue(
      parsed.contract,
      parsed.chainId as number,
      parsed.outcome as number,
      isBuy,
      parsed.price,
      parsed.limit as number,
      parsed.offset as number,
      marketKey
    );
    res.setHeader("Cache-Control", "public, max-age=2");
    res.json({ success: true, data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "queue query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "queue query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

app.post(
  "/orderbook/report-trade",
  limitReportTrade,
  requireApiKey("report_trade", "orderbook_report_trade"),
  async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return sendApiError(req, res, 500, {
          message: "Supabase not configured",
          errorCode: "SUPABASE_NOT_CONFIGURED",
        });
      }
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) {
          const leaderId = await getCachedLeaderId(cluster);
          const proxyUrl = getLeaderProxyUrl();
          if (proxyUrl) {
            const ok = await proxyToLeader(proxyUrl, req, res, "/orderbook/report-trade");
            if (ok) return;
          }
          clusterFollowerRejectedTotal.inc({ path: "/orderbook/report-trade" });
          sendNotLeader(res, {
            leaderId,
            nodeId: cluster.getNodeId(),
            path: "/orderbook/report-trade",
          });
          return;
        }
      }
      const idemKey = getIdempotencyKey(req, "/orderbook/report-trade");
      if (idemKey) {
        const hit = await getIdempotencyEntry(idemKey);
        if (hit) return res.status(hit.status).json(hit.body);
      }
      const body = TradeReportSchema.parse(req.body || {});
      const data = await ingestTrade(body.chainId, body.txHash);
      const responseBody = { success: true, data };
      logger.info("orderbook trade reported", {
        requestId: (req as any).requestId || null,
        apiKeyId: (req as any).apiKeyId || null,
        chainId: body.chainId,
        txHash: body.txHash,
      });
      res.json(responseBody);
      if (idemKey) void setIdempotencyEntry(idemKey, 200, responseBody);
    } catch (e: any) {
      logger.error("orderbook report trade failed", { path: "/orderbook/report-trade" }, e);
      return sendApiError(req, res, 400, {
        message: "trade report failed",
        detail: String(e?.message || e),
        errorCode: "BAD_REQUEST",
      });
    }
  }
);

app.get("/orderbook/candles", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return sendApiError(req, res, 500, {
        message: "Supabase not configured",
        errorCode: "SUPABASE_NOT_CONFIGURED",
      });
    }
    const parsed = CandlesQuerySchema.parse({
      market: req.query.market,
      chainId: req.query.chainId,
      outcome: req.query.outcome,
      resolution: req.query.resolution || "15m",
      limit: req.query.limit,
    });
    const data = await getCandles(
      parsed.market,
      parsed.chainId as number,
      parsed.outcome as number,
      parsed.resolution,
      parsed.limit as number
    );
    res.setHeader("Cache-Control", "public, max-age=5");
    res.json({ success: true, data });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return sendApiError(req, res, 400, {
        message: "candles query validation failed",
        detail: e.flatten(),
        errorCode: "VALIDATION_ERROR",
      });
    }
    return sendApiError(req, res, 400, {
      message: "candles query failed",
      detail: String(e?.message || e),
      errorCode: "BAD_REQUEST",
    });
  }
});

app.get("/orderbook/types", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  res.json({ success: true, types: getOrderTypes() });
});

/**
 * Optional: background indexer to ingest trades automatically (no need to call
 * /report-trade manually).
 * Enabled via RELAYER_AUTO_INGEST=1 and requires RPC_URL + SUPABASE service role key.
 *
 * Implementation strategy:
 * - This minimal version watches recent blocks and ingests any tx that contains OrderFilledSigned.
 * - It is conservative and idempotent because SQL function `ingest_trade_event` is idempotent.
 *
 * NOTE: For production, persist lastProcessedBlock (e.g. in Supabase) and use getLogs by topic.
 */
let autoIngestTimer: NodeJS.Timeout | null = null;
let marketExpiryTimer: NodeJS.Timeout | null = null;
let marketSettlementTimer: NodeJS.Timeout | null = null;
const marketSettlementAttempts = new Map<
  string,
  {
    lastAssertAt?: number;
    lastSettleAt?: number;
    lastResolveAt?: number;
    lastOutcomeSetAt?: number;
  }
>();

async function startMarketExpiryLoop() {
  if (String(process.env.RELAYER_MARKET_EXPIRY_ENABLED || "").toLowerCase() === "false") return;
  if (!supabaseAdmin) {
    logger.warn("Market expiry loop disabled: Supabase not configured");
    return;
  }
  const supabase = supabaseAdmin;

  const pollMs = Math.max(5000, readIntEnv("RELAYER_MARKET_EXPIRY_POLL_MS", 30000));
  let running = false;

  if (marketExpiryTimer) {
    clearInterval(marketExpiryTimer);
    marketExpiryTimer = null;
  }

  const loop = async () => {
    if (running) return;
    running = true;
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) return;
      }

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("markets_map")
        .select("event_id,chain_id,resolution_time,status")
        .eq("status", "open")
        .not("resolution_time", "is", null)
        .lte("resolution_time", nowIso)
        .limit(200);

      if (error) {
        logger.warn("Market expiry loop query failed", {
          error: error.message,
        });
        return;
      }
      if (!data || data.length === 0) return;

      for (const row of data as any[]) {
        const eventId = Number(row.event_id);
        const chainId = Number(row.chain_id);
        if (!Number.isFinite(eventId) || !Number.isFinite(chainId)) continue;
        const marketKey = `${chainId}:${eventId}`;

        const updateRes = await supabase
          .from("markets_map")
          .update({ status: "closed" })
          .eq("event_id", eventId)
          .eq("chain_id", chainId)
          .eq("status", "open");
        if (updateRes.error) {
          logger.warn("Failed to update market status to closed", {
            marketKey,
            error: updateRes.error.message,
          });
          continue;
        }

        const predictionUpdate = await supabase
          .from("predictions")
          .update({
            status: "completed",
            settled_at: new Date().toISOString(),
          })
          .eq("id", eventId)
          .eq("status", "active");
        if (predictionUpdate.error) {
          logger.warn("Failed to update prediction status for expired market", {
            marketKey,
            error: predictionUpdate.error.message,
          });
        }

        try {
          await matchingEngine.closeMarket(marketKey, { reason: "expired" });
        } catch (error: any) {
          logger.warn("Failed to close expired market orderbook", {
            marketKey,
            error: String(error?.message || error),
          });
        }
      }
    } catch (e: any) {
      logger.warn("Market expiry loop failed", { error: String(e?.message || e) });
    } finally {
      running = false;
    }
  };

  await loop();
  marketExpiryTimer = setInterval(loop, pollMs);
  logger.info("Market expiry loop enabled", { pollMs });
}

async function startMarketSettlementLoop() {
  if (String(process.env.RELAYER_MARKET_SETTLEMENT_ENABLED || "").toLowerCase() === "false") return;
  if (!supabaseAdmin) {
    logger.warn("Market settlement loop disabled: Supabase not configured");
    return;
  }
  if (!provider) {
    logger.warn("Market settlement loop disabled: Provider not configured");
    return;
  }
  if (!OPERATOR_PRIVATE_KEY) {
    logger.warn("Market settlement loop disabled: OPERATOR_PRIVATE_KEY not configured");
    return;
  }

  const supabase = supabaseAdmin;
  const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);
  const pollMs = Math.max(10000, readIntEnv("RELAYER_MARKET_SETTLEMENT_POLL_MS", 60000));
  const cooldownMs = Math.max(10000, readIntEnv("RELAYER_MARKET_SETTLEMENT_COOLDOWN_MS", 60000));
  let running = false;

  if (marketSettlementTimer) {
    clearInterval(marketSettlementTimer);
    marketSettlementTimer = null;
  }

  const canAttempt = (
    key: string,
    field: "lastAssertAt" | "lastSettleAt" | "lastResolveAt" | "lastOutcomeSetAt"
  ) => {
    const now = Date.now();
    const record = marketSettlementAttempts.get(key) || {};
    const last = record[field] || 0;
    if (now - last < cooldownMs) return false;
    record[field] = now;
    marketSettlementAttempts.set(key, record);
    return true;
  };

  const loop = async () => {
    if (running) return;
    running = true;
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) return;
      }

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("markets_map")
        .select("event_id,chain_id,market,resolution_time,status")
        .in("status", ["open", "closed"])
        .not("resolution_time", "is", null)
        .lte("resolution_time", nowIso)
        .limit(200);

      if (error) {
        logger.warn("Market settlement loop query failed", { error: error.message });
        return;
      }
      if (!data || data.length === 0) return;

      for (const row of data as any[]) {
        const eventId = Number(row.event_id);
        const chainId = Number(row.chain_id);
        const marketAddress = String(row.market || "").toLowerCase();
        if (!Number.isFinite(eventId) || !Number.isFinite(chainId)) continue;
        if (!ethers.isAddress(marketAddress)) continue;
        if (chainId !== CHAIN_ID) continue;

        const marketKey = `${chainId}:${eventId}`;
        const marketContract = new Contract(marketAddress, OffchainMarketBaseABI, wallet);

        let marketStateNum = 0;
        try {
          const marketState = await marketContract.state();
          marketStateNum = Number(marketState);
        } catch (e: any) {
          logger.warn("Failed to read market state", {
            marketKey,
            error: String(e?.message || e),
          });
          continue;
        }
        if (marketStateNum === 1 || marketStateNum === 2) {
          const status = marketStateNum === 1 ? "resolved" : "invalidated";
          let resolvedOutcomeIndex: number | null = null;
          if (marketStateNum === 1) {
            try {
              const resolvedOutcome = await marketContract.resolvedOutcome();
              resolvedOutcomeIndex = parseOutcomeIndex(resolvedOutcome);
            } catch {}
          }
          await syncMarketResolution(marketAddress, status, resolvedOutcomeIndex);
          continue;
        }
        if (marketStateNum !== 0) continue;

        const { data: prediction, error: predictionError } = await supabase
          .from("predictions")
          .select("id,title,criteria,winning_outcome,status,outcome_count")
          .eq("id", eventId)
          .limit(1)
          .maybeSingle();

        if (predictionError || !prediction) continue;
        const winningRaw = prediction.winning_outcome;
        if (winningRaw === null || winningRaw === undefined) continue;
        const outcomeIndex = Number(winningRaw);
        if (!Number.isFinite(outcomeIndex) || outcomeIndex < 0) continue;
        const outcomeCount = Number(prediction.outcome_count || 0);
        if (Number.isFinite(outcomeCount) && outcomeCount > 0 && outcomeIndex >= outcomeCount)
          continue;

        let marketId: string;
        let oracleAddress: string;
        try {
          marketId = await marketContract.marketId();
          oracleAddress = await marketContract.oracle();
        } catch (e: any) {
          logger.warn("Failed to read market oracle info", {
            marketKey,
            error: String(e?.message || e),
          });
          continue;
        }
        if (!ethers.isAddress(oracleAddress)) continue;

        const { data: outcomeRow } = await supabase
          .from("prediction_outcomes")
          .select("label")
          .eq("prediction_id", eventId)
          .eq("outcome_index", outcomeIndex)
          .limit(1)
          .maybeSingle();

        const outcomeLabel = String(
          outcomeRow?.label || `Outcome ${Number.isFinite(outcomeIndex) ? outcomeIndex : "?"}`
        );
        const title = String(prediction.title || "");
        const criteria = String(prediction.criteria || "");
        const claim = `I assert outcome "${outcomeLabel}" for prediction ${eventId}${
          title ? ` (${title})` : ""
        }.${criteria ? ` Criteria: ${criteria}` : ""}`;
        const claimBytes = ethers.toUtf8Bytes(claim);

        const oracleContract = new Contract(oracleAddress, UMAOracleAdapterV2ABI, wallet);
        let oracleStatus: number | null = null;

        try {
          const status = await oracleContract.getMarketStatus(marketId);
          oracleStatus = Number(status?.[0]);
        } catch {}

        if (oracleStatus === null) {
          const manualOracle = new Contract(
            oracleAddress,
            [
              "function getOutcome(bytes32 marketId) view returns (uint256)",
              "function setOutcome(uint256 outcome) external",
            ],
            wallet
          );
          let hasOutcome = false;
          try {
            const currentOutcome = await manualOracle.getOutcome(marketId);
            hasOutcome = Number(currentOutcome) === outcomeIndex;
          } catch {}
          if (!hasOutcome && canAttempt(marketKey, "lastOutcomeSetAt")) {
            try {
              const tx = await manualOracle.setOutcome(outcomeIndex);
              await tx.wait();
            } catch (e: any) {
              logger.warn("Manual oracle setOutcome failed", {
                marketKey,
                error: String(e?.message || e),
              });
              continue;
            }
          }
          if (canAttempt(marketKey, "lastResolveAt")) {
            try {
              const tx = await marketContract.resolve();
              await tx.wait();
            } catch (e: any) {
              logger.warn("Market resolve failed", {
                marketKey,
                error: String(e?.message || e),
              });
            }
          }
          continue;
        }

        if (oracleStatus === 0 && canAttempt(marketKey, "lastAssertAt")) {
          try {
            const tx = await oracleContract.requestOutcome(marketId, outcomeIndex, claimBytes);
            await tx.wait();
            continue;
          } catch (e: any) {
            logger.warn("Oracle requestOutcome failed", {
              marketKey,
              error: String(e?.message || e),
            });
          }
        }

        if (oracleStatus === 1 && canAttempt(marketKey, "lastSettleAt")) {
          try {
            const tx = await oracleContract.settleOutcome(marketId);
            await tx.wait();
          } catch (e: any) {
            logger.warn("Oracle settleOutcome failed", {
              marketKey,
              error: String(e?.message || e),
            });
          }
        }

        if ((oracleStatus === 2 || oracleStatus === 3) && canAttempt(marketKey, "lastResolveAt")) {
          try {
            const tx = await marketContract.resolve();
            await tx.wait();
          } catch (e: any) {
            logger.warn("Market resolve failed", {
              marketKey,
              error: String(e?.message || e),
            });
          }
        }
      }
    } catch (e: any) {
      logger.warn("Market settlement loop failed", { error: String(e?.message || e) });
    } finally {
      running = false;
    }
  };

  await loop();
  marketSettlementTimer = setInterval(loop, pollMs);
  logger.info("Market settlement loop enabled", { pollMs });
}

async function startAutoIngestLoop() {
  if (process.env.RELAYER_AUTO_INGEST !== "1") return;
  if (!supabaseAdmin) {
    console.warn("[auto-ingest] Supabase not configured, disabled");
    return;
  }
  if (!provider) {
    console.warn("[auto-ingest] Provider not configured (RPC_URL), disabled");
    return;
  }

  let chainId: number;
  try {
    const net = await provider.getNetwork();
    chainId = Number(net.chainId);
  } catch (e: any) {
    console.warn("[auto-ingest] failed to get network:", String(e?.message || e));
    return;
  }

  const cursorKey = "order_filled_signed";
  const configuredFrom = Math.max(0, readIntEnv("RELAYER_AUTO_INGEST_FROM_BLOCK", 0));
  const lookback = Math.max(0, readIntEnv("RELAYER_AUTO_INGEST_REORG_LOOKBACK", 20));
  let last = 0;
  const confirmations = Math.max(0, readIntEnv("RELAYER_AUTO_INGEST_CONFIRMATIONS", 1));
  const pollMs = Math.max(2000, readIntEnv("RELAYER_AUTO_INGEST_POLL_MS", 5000));
  const maxConcurrent = Math.max(1, readIntEnv("RELAYER_AUTO_INGEST_CONCURRENCY", 3));
  let ingestRunning = false;

  if (autoIngestTimer) {
    clearInterval(autoIngestTimer);
    autoIngestTimer = null;
  }

  const loadCursor = async (): Promise<number> => {
    try {
      const { data, error } = await supabaseAdmin!
        .from("relayer_ingest_cursors")
        .select("last_processed_block")
        .eq("chain_id", chainId)
        .eq("cursor_key", cursorKey)
        .maybeSingle();
      if (error) {
        const code = (error as any).code;
        if (code === "42P01" || code === "42703") return 0;
        console.warn("[auto-ingest] cursor load error:", String(error.message || error));
        return 0;
      }
      const raw = (data as any)?.last_processed_block;
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch (e: any) {
      console.warn("[auto-ingest] cursor load exception:", String(e?.message || e));
      return 0;
    }
  };

  const saveCursor = async (blockNumber: number): Promise<void> => {
    try {
      const { error } = await supabaseAdmin!.from("relayer_ingest_cursors").upsert(
        {
          chain_id: chainId,
          cursor_key: cursorKey,
          last_processed_block: blockNumber,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "chain_id,cursor_key" }
      );
      if (error) {
        const code = (error as any).code;
        if (code === "42P01" || code === "42703") return;
        console.warn("[auto-ingest] cursor save error:", String(error.message || error));
      }
    } catch (e: any) {
      console.warn("[auto-ingest] cursor save exception:", String(e?.message || e));
    }
  };

  const persistedLast = await loadCursor();
  if (configuredFrom > 0) {
    last = configuredFrom;
  } else {
    last = persistedLast > 0 ? Math.max(0, persistedLast - lookback) : 0;
  }

  const loop = async () => {
    if (ingestRunning) return;
    ingestRunning = true;
    try {
      if (clusterIsActive) {
        const cluster = getClusterManager();
        if (!cluster.isLeader()) return;
      }

      const head = await provider!.getBlockNumber();
      const target = Math.max(0, head - confirmations);
      if (last === 0) last = target;
      if (target <= last) return;

      const maxStep = Math.max(1, readIntEnv("RELAYER_AUTO_INGEST_MAX_STEP", 20));
      const to = Math.min(target, last + maxStep);

      const fromBlock = last + 1;
      if (fromBlock > to) return;

      const startTime = Date.now();
      let totalIngested = 0;
      let processedTo = last;
      try {
        const r = await ingestTradesByLogs(chainId, fromBlock, to, maxConcurrent);
        totalIngested += r.ingestedCount || 0;
        processedTo = to;
        last = processedTo;
        await saveCursor(processedTo);
      } catch (e: any) {
        console.warn(
          "[auto-ingest] ingestTradesByLogs range error:",
          String(e?.message || e),
          chainId,
          fromBlock,
          to
        );
        for (let b = fromBlock; b <= to; b++) {
          try {
            const r = await ingestTradesByLogs(chainId, b, b, maxConcurrent);
            totalIngested += r.ingestedCount || 0;
            processedTo = b;
            last = processedTo;
            await saveCursor(processedTo);
          } catch (e: any) {
            console.warn(
              "[auto-ingest] ingestTradesByLogs error:",
              String(e?.message || e),
              chainId,
              b
            );
            break;
          }
        }
      }
      const duration = Date.now() - startTime;
      console.log(
        "[auto-ingest] window",
        fromBlock,
        "to",
        to,
        "events",
        totalIngested,
        "durationMs",
        duration
      );
    } catch (e: any) {
      console.warn("[auto-ingest] loop error:", String(e?.message || e));
    } finally {
      ingestRunning = false;
    }
  };

  // initial tick + interval
  await loop();
  autoIngestTimer = setInterval(loop, pollMs);
  console.log("[auto-ingest] enabled");
}

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, async () => {
    logger.info("Relayer server starting", { port: PORT });

    try {
      const { initChaosEngineering } = await import("./chaos/chaosInit.js");
      chaosInstance = await initChaosEngineering();
    } catch (error) {
      logger.error("混沌工程初始化失败", { error: String(error) });
    }

    await initContractListener();

    // 🚀 Phase 1: 初始化 Redis
    const redisEnabled = process.env.REDIS_ENABLED !== "false";
    if (redisEnabled) {
      try {
        const connected = await initRedis();
        if (connected) {
          logger.info("Redis connected successfully");
          // 启动订单簿快照同步
          const snapshotService = getOrderbookSnapshotService();
          snapshotService.startSync(5000);
        } else {
          logger.warn("Redis connection failed, running without Redis");
        }
      } catch (e: any) {
        logger.warn("Redis initialization failed", {}, e);
      }
    }

    // 🚀 Phase 2: 初始化数据库连接池
    try {
      await initDatabasePool();
      logger.info("Database pool initialized");
    } catch (e: any) {
      logger.warn("Database pool initialization failed, using single connection", {}, e);
    }

    // 🚀 Phase 2: 初始化集群管理器 (需要 Redis)
    const clusterEnabled = process.env.CLUSTER_ENABLED === "true" && redisEnabled;
    const reconciliationEnabled = process.env.RECONCILIATION_ENABLED === "true";
    const shouldInitReconciler = reconciliationEnabled && !!RPC_URL && !!process.env.MARKET_ADDRESS;
    let reconcilerStarted = false;

    const startReconciler = async () => {
      if (!shouldInitReconciler) return;
      if (reconcilerStarted) return;
      try {
        await initChainReconciler({
          rpcUrl: RPC_URL,
          marketAddress: process.env.MARKET_ADDRESS!,
          chainId: CHAIN_ID,
          intervalMs: Math.max(1000, readIntEnv("RECONCILIATION_INTERVAL_MS", 300000)),
          autoFix: process.env.RECONCILIATION_AUTO_FIX === "true",
        });
        reconcilerStarted = true;
        logger.info("Chain reconciler initialized");
      } catch (e: any) {
        logger.warn("Chain reconciler initialization failed", {}, e);
      }
    };

    const stopReconciler = async () => {
      if (!reconcilerStarted) return;
      try {
        await closeChainReconciler();
      } catch {}
      reconcilerStarted = false;
    };

    const balanceCheckerEnabled = process.env.BALANCE_CHECKER_ENABLED !== "false";
    const configuredUsdcAddress = pickFirstNonEmptyString(
      process.env.COLLATERAL_TOKEN_ADDRESS,
      process.env.USDC_ADDRESS,
      process.env.NEXT_PUBLIC_USDC_ADDRESS,
      process.env.NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS
    );
    const shouldInitBalanceChecker =
      balanceCheckerEnabled &&
      !!RPC_URL &&
      !!configuredUsdcAddress &&
      ethers.isAddress(configuredUsdcAddress);
    let balanceCheckerStarted = false;

    const resolveBalanceTolerance = (): bigint | undefined => {
      const raw = maybeNonEmptyString(process.env.BALANCE_CHECK_TOLERANCE_USDC);
      const n = raw ? Number(raw) : NaN;
      if (!Number.isFinite(n) || n < 0) return undefined;
      return BigInt(Math.floor(n * 1e6));
    };

    const startBalanceChecker = async () => {
      if (!shouldInitBalanceChecker) return;
      if (balanceCheckerStarted) return;
      const marketAddress =
        process.env.MARKET_ADDRESS && ethers.isAddress(process.env.MARKET_ADDRESS)
          ? process.env.MARKET_ADDRESS.toLowerCase()
          : ethers.ZeroAddress;
      const tolerance = resolveBalanceTolerance();
      try {
        await initBalanceChecker({
          rpcUrl: RPC_URL,
          usdcAddress: configuredUsdcAddress!.toLowerCase(),
          marketAddress,
          chainId: CHAIN_ID,
          intervalMs: clampNumber(readIntEnv("BALANCE_CHECK_INTERVAL_MS", 60000), 5000, 3600000),
          batchSize: clampNumber(readIntEnv("BALANCE_CHECK_BATCH_SIZE", 200), 1, 1000),
          maxUsers: clampNumber(readIntEnv("BALANCE_CHECK_MAX_USERS", 10000), 1, 1000000),
          includeProxyWallets: process.env.BALANCE_CHECK_INCLUDE_PROXY_WALLETS !== "false",
          autoFix: process.env.BALANCE_CHECK_AUTO_FIX !== "false",
          ...(tolerance ? { tolerance } : {}),
        });
        balanceCheckerStarted = true;
        logger.info("Balance checker initialized");
      } catch (e: any) {
        logger.warn("Balance checker initialization failed", {}, e);
      }
    };

    const stopBalanceChecker = async () => {
      if (!balanceCheckerStarted) return;
      try {
        await closeBalanceChecker();
      } catch {}
      balanceCheckerStarted = false;
    };

    if (clusterEnabled) {
      try {
        const cluster = await initClusterManager({
          enableLeaderElection: true,
          enablePubSub: true,
        });
        clusterIsActive = true;

        // 监听 Leader 事件
        cluster.on("became_leader", () => {
          logger.info("This node became the leader, starting matching engine");
          void startReconciler();
          void startBalanceChecker();
        });

        cluster.on("lost_leadership", () => {
          logger.warn("This node lost leadership");
          void stopReconciler();
          void stopBalanceChecker();
        });

        logger.info("Cluster manager initialized", {
          nodeId: cluster.getNodeId(),
          isLeader: cluster.isLeader(),
        });

        if (cluster.isLeader()) {
          await startReconciler();
          await startBalanceChecker();
        }
      } catch (e: any) {
        logger.warn("Cluster manager initialization failed, running in standalone mode", {}, e);
      }
    }
    if (!clusterEnabled) {
      await startReconciler();
      await startBalanceChecker();
    }

    // 🚀 Phase 1: 注册健康检查器
    healthService.registerHealthCheck("supabase", createSupabaseHealthChecker(supabaseAdmin));
    healthService.registerHealthCheck(
      "matching_engine",
      createMatchingEngineHealthChecker(matchingEngine)
    );

    if (redisEnabled) {
      healthService.registerHealthCheck("redis", createRedisHealthChecker(getRedisClient()));
    }

    if (provider) {
      healthService.registerHealthCheck("rpc", createRpcHealthChecker(provider));
    }

    healthService.registerReadinessCheck(
      "orderbook",
      createOrderbookReadinessChecker(matchingEngine)
    );

    healthService.registerHealthCheck("cluster", async () => {
      if (!clusterIsActive) return { status: "pass", message: "Cluster disabled" };
      const cluster = getClusterManager();
      const role = cluster.isLeader() ? "leader" : "follower";
      const leaderId = cluster.isLeader() ? cluster.getNodeId() : cluster.getKnownLeaderId();
      const nodes = cluster.getNodeCount();
      return {
        status: "pass",
        message: `role=${role} leader=${leaderId || "unknown"} nodes=${nodes}`,
      };
    });

    healthService.registerReadinessCheck(
      "write_proxy",
      createWriteProxyReadinessChecker({
        isClusterActive: () => clusterIsActive,
        isLeader: () => getClusterManager().isLeader(),
        getProxyUrl: () =>
          String(process.env.RELAYER_LEADER_PROXY_URL || process.env.RELAYER_LEADER_URL || ""),
      })
    );

    // 🚀 启动 WebSocket 服务器
    try {
      const useClusteredWs = clusterEnabled;
      const wsPort = clampNumber(readIntEnv("WS_PORT", 3006), 1, 65535);
      if (useClusteredWs) {
        wsServer = new ClusteredWebSocketServer(wsPort);
      } else {
        wsServer = new MarketWebSocketServer(wsPort);
      }
      await Promise.resolve(wsServer.start());
      logger.info("WebSocket server started", { port: wsPort });
    } catch (e: any) {
      logger.error("WebSocket server failed to start", {}, e);
    }

    // 🚀 从数据库恢复订单簿
    try {
      await matchingEngine.recoverFromDb();
      logger.info("Order books recovered from database");
    } catch (e: any) {
      logger.error("Failed to recover order books", {}, e);
    }

    try {
      const result = await matchingEngine.recoverFromEventLog();
      if (result.replayed > 0 || result.skipped > 0) {
        logger.info("Order books replayed from matching event log", result);
      }
    } catch (e: any) {
      logger.warn("Failed to replay matching event log", {}, e);
    }

    // 启动市场过期下线
    startMarketExpiryLoop().catch((e: any) =>
      logger.warn("Market expiry loop failed to start", {}, e)
    );

    // 启动自动交易摄入
    startAutoIngestLoop().catch((e: any) => logger.warn("Auto-ingest failed to start", {}, e));

    logger.info("Relayer server started successfully", {
      port: PORT,
      wsPort: clampNumber(readIntEnv("WS_PORT", 3006), 1, 65535),
      redisEnabled,
      clusterEnabled,
      reconciliationEnabled,
    });
  });
}

// 🚀 Phase 1 & 2: 优雅关闭 (增加 Redis、集群、对账服务关闭)
async function gracefulShutdown(signal: string) {
  logger.info("Graceful shutdown initiated", { signal });

  try {
    // 停止接收新请求的时间
    const shutdownTimeout = setTimeout(() => {
      logger.error("Shutdown timeout, forcing exit");
      process.exit(1);
    }, 30000);

    // 🚀 Phase 2: 关闭链上对账服务
    try {
      await closeChainReconciler();
      logger.info("Chain reconciler stopped");
    } catch (e: any) {
      logger.error("Failed to stop chain reconciler", {}, e);
    }

    try {
      await closeBalanceChecker();
      logger.info("Balance checker stopped");
    } catch (e: any) {
      logger.error("Failed to stop balance checker", {}, e);
    }

    try {
      await closeContractEventListener();
      logger.info("Contract event listener stopped");
    } catch (e: any) {
      logger.error("Failed to stop contract event listener", {}, e);
    }

    if (chaosInstance) {
      try {
        const { closeChaosEngineering } = await import("./chaos/chaosInit.js");
        await closeChaosEngineering(chaosInstance);
        chaosInstance = null;
        logger.info("Chaos engineering stopped");
      } catch (e: any) {
        logger.error("Failed to stop chaos engineering", {}, e);
      }
    }

    // 🚀 Phase 2: 关闭集群管理器
    try {
      await closeClusterManager();
      logger.info("Cluster manager stopped");
    } catch (e: any) {
      logger.error("Failed to stop cluster manager", {}, e);
    }

    // 关闭订单簿快照服务
    try {
      const snapshotService = getOrderbookSnapshotService();
      await snapshotService.shutdown();
      logger.info("Orderbook snapshot service stopped");
    } catch (e: any) {
      logger.error("Failed to stop snapshot service", {}, e);
    }

    // 关闭撮合引擎
    try {
      await matchingEngine.shutdown();
      logger.info("Matching engine stopped");
    } catch (e: any) {
      logger.error("Failed to stop matching engine", {}, e);
    }

    // 关闭 WebSocket
    try {
      if (wsServer) {
        await Promise.resolve(wsServer.stop());
      }
      logger.info("WebSocket server stopped");
    } catch (e: any) {
      logger.error("Failed to stop WebSocket server", {}, e);
    }

    // 停止 auto-ingest 定时器
    if (autoIngestTimer) {
      clearInterval(autoIngestTimer);
      autoIngestTimer = null;
    }

    // 停止 metrics 定时器
    try {
      stopMetricsTimers();
    } catch (e: any) {
      logger.warn("Failed to stop metrics timers", {}, e);
    }

    // 停止限流器定时器
    try {
      closeRateLimiter();
    } catch (e: any) {
      logger.warn("Failed to stop rate limiter", {}, e);
    }

    // 关闭 Redis
    try {
      await closeRedis();
      logger.info("Redis connection closed");
    } catch (e: any) {
      logger.error("Failed to close Redis", {}, e);
    }

    // 🚀 Phase 2: 关闭数据库连接池
    try {
      await closeDatabasePool();
      logger.info("Database pool closed");
    } catch (e: any) {
      logger.error("Failed to close database pool", {}, e);
    }

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error: any) {
    logger.error("Error during shutdown", {}, error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
