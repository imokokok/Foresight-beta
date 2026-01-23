import { z } from "zod";

import {
  BUNDLER_PRIVATE_KEY,
  OPERATOR_PRIVATE_KEY,
  RELAYER_GASLESS_SIGNER_PRIVATE_KEY,
  CUSTODIAL_SIGNER_PRIVATE_KEY,
  AA_ENABLED,
  EMBEDDED_AUTH_ENABLED,
  GASLESS_ENABLED,
  RELAYER_GASLESS_PAYMASTER_URL,
  ENTRYPOINT_ADDRESS,
  CHAIN_ID,
  RELAYER_LEADER_PROXY_URL,
  RELAYER_LEADER_URL,
  PROXY_WALLET_TYPE,
  PROXY_WALLET_FACTORY_ADDRESS,
  SAFE_FACTORY_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  SAFE_FALLBACK_HANDLER_ADDRESS,
  RPC_URL,
  RELAYER_PORT,
} from "./env.js";

export {
  BUNDLER_PRIVATE_KEY,
  OPERATOR_PRIVATE_KEY,
  RELAYER_GASLESS_SIGNER_PRIVATE_KEY,
  CUSTODIAL_SIGNER_PRIVATE_KEY,
  AA_ENABLED,
  EMBEDDED_AUTH_ENABLED,
  GASLESS_ENABLED,
  RELAYER_GASLESS_PAYMASTER_URL,
  ENTRYPOINT_ADDRESS,
  CHAIN_ID,
  RELAYER_LEADER_PROXY_URL,
  RELAYER_LEADER_URL,
  PROXY_WALLET_TYPE,
  PROXY_WALLET_FACTORY_ADDRESS,
  SAFE_FACTORY_ADDRESS,
  SAFE_SINGLETON_ADDRESS,
  SAFE_FALLBACK_HANDLER_ADDRESS,
  RPC_URL,
  RELAYER_PORT,
} from "./env.js";

// 🚀 Phase 1: 导入监控和日志模块
import { logger, matchingLogger } from "./monitoring/logger.js";
import { matchesTotal, matchedVolumeTotal, stopMetricsTimers } from "./monitoring/metrics.js";
import { createRateLimitMiddleware } from "./ratelimit/index.js";
import { healthRoutes, clusterRoutes, createAARoutes, createV2Routes } from "./routes/index.js";
import { registerRootRoutes } from "./routes/rootRoutes.js";
import {
  metricsMiddleware,
  requestIdMiddleware,
  requestLoggerMiddleware,
} from "./middleware/index.js";
import { createApiKeyAuth } from "./http/apiKeyAuth.js";
import { createIdempotency } from "./http/idempotency.js";

import { closeClusterManager, getClusterManager } from "./cluster/index.js";
import { closeDatabasePool } from "./database/index.js";
import { closeChainReconciler } from "./reconciliation/index.js";
import { closeBalanceChecker } from "./reconciliation/balanceChecker.js";
import { registerGracefulShutdown } from "./server/gracefulShutdown.js";
import { startRelayerServer } from "./server/serverStartup.js";
import { createBackgroundLoops } from "./server/backgroundLoops.js";

import express from "express";
import cors from "cors";
import { ethers, Contract } from "ethers";
import EntryPointAbi from "./abi/EntryPoint.json" with { type: "json" };

// 🚀 导入新的撮合引擎
import { MatchingEngine } from "./matching/index.js";

// 导入合约事件监听器
import {
  initializeContractListener,
  closeContractEventListener,
} from "./monitoring/contractEventListener.js";

let clusterIsActive = false;

// 创建 Express 应用
export const app = express();

// 配置 Express 应用
const trustProxyHops = Math.max(0, parseInt(process.env.RELAYER_TRUST_PROXY_HOPS || "0"));
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

// CORS 配置
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

// 中间件设置
app.use(express.json({ limit: "1mb" }));
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(metricsMiddleware);
app.use(createRateLimitMiddleware());

// 路由设置
app.use(healthRoutes);
app.use(clusterRoutes);

// 🚀 初始化撮合引擎
const matchingEngine = new MatchingEngine({
  makerFeeBps: Math.max(0, parseInt(process.env.MAKER_FEE_BPS || "0")),
  takerFeeBps: Math.max(0, parseInt(process.env.TAKER_FEE_BPS || "0")),
  maxMarketLongExposureUsdc: Math.max(
    0,
    parseFloat(process.env.RELAYER_MAX_MARKET_LONG_EXPOSURE_USDC || "0")
  ),
  maxMarketShortExposureUsdc: Math.max(
    0,
    parseFloat(process.env.RELAYER_MAX_MARKET_SHORT_EXPOSURE_USDC || "0")
  ),
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

// 错误处理函数
export function sendApiError(
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

// 初始化API密钥认证
const {
  requireApiKey,
  resolveApiKey,
  getApiKeyFromRequest,
  getClientIp,
  getRateLimitIdentityFromResolvedKey,
  getRateTierFromScopes,
} = createApiKeyAuth(
  (env, defaultValue) => Math.max(0, parseInt(process.env[env] || String(defaultValue))),
  sendApiError
);

// 初始化幂等性处理
const { getIdempotencyKey, getIdempotencyEntry, setIdempotencyEntry, setIdempotencyIfPresent } =
  createIdempotency((env, defaultValue) =>
    Math.max(0, parseInt(process.env[env] || String(defaultValue)))
  );

// 初始化RPC provider和bundler wallet
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

// EntryPoint地址解析
const DEFAULT_ENTRYPOINT_ADDRESSES: Record<number, string> = {
  80002: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  137: "0x0000000071727de22e5e9d8baf0edac6f37da032",
  11155111: "0x0000000071727de22e5e9d8baf0edac6f37da032",
};

function maybeEthAddress(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return undefined;
  if (/^[0-9a-fA-F]{40}$/.test(s)) return "0x" + s;
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s;
  return undefined;
}

export function resolveEntryPointAddress(raw: unknown): string | null {
  const body = raw && typeof raw === "object" ? (raw as any) : {};
  const candidate = maybeEthAddress(
    body.entryPointAddress || body.entryPoint || body.entryPoint_address
  );
  if (candidate) return candidate.toLowerCase();
  if (ENTRYPOINT_ADDRESS) return ENTRYPOINT_ADDRESS.toLowerCase();
  const fallback = DEFAULT_ENTRYPOINT_ADDRESSES[CHAIN_ID];
  return fallback ? fallback.toLowerCase() : null;
}

// 初始化合约事件监听器
async function initEventListeners() {
  await initializeContractListener(matchingEngine);
}

// 启动服务器
async function startServer() {
  try {
    // 初始化事件监听器
    await initEventListeners();

    // 直接启动HTTP服务器，避免使用复杂的startRelayerServer函数
    app.listen(RELAYER_PORT, () => {
      logger.info("Relayer server started successfully", {
        port: RELAYER_PORT,
        chainId: CHAIN_ID,
        aaEnabled: AA_ENABLED,
        gaslessEnabled: GASLESS_ENABLED,
      });
    });

    logger.info("Relayer server started successfully", {
      port: RELAYER_PORT,
      chainId: CHAIN_ID,
      aaEnabled: AA_ENABLED,
      gaslessEnabled: GASLESS_ENABLED,
    });
  } catch (error) {
    logger.error("Failed to start relayer server", { error: String(error) });
    process.exit(1);
  }
}

// 启动应用
void startServer();
