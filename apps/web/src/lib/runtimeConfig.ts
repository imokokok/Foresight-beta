type FeatureFlags = {
  aa_enabled: boolean;
  embedded_auth_enabled: boolean;
};

type ChainAddresses = {
  entryPoint?: string;
  marketFactory?: string;
  outcomeToken1155?: string;
  umaAdapter?: string;
  foresightToken?: string;
  usdc?: string;
  lpFeeStaking?: string;
  offchainBinaryMarketImpl?: string;
  offchainMultiMarket8Impl?: string;
};

type RuntimeConfig = {
  chainId: number;
  rpcUrl: string;
  flags: FeatureFlags;
  addresses: ChainAddresses;
};

const DEFAULT_CHAIN_ID = 80002;

const DEFAULT_RPC_URLS: Record<number, string> = {
  80002: "https://rpc-amoy.polygon.technology/",
  137: "https://polygon-rpc.com",
  11155111: "https://rpc.sepolia.org",
};

const DEFAULT_ADDRESSES_BY_CHAIN: Record<number, ChainAddresses> = {
  80002: {
    entryPoint: "0x0000000071727de22e5e9d8baf0edac6f37da032",
    marketFactory: "0x0762A2EeFEB20f03ceA60A542FfC8CEC85FE8A30",
    outcomeToken1155: "0x6dA31A9B2e9e58909836DDa3aeA7f824b1725087",
    umaAdapter: "0x5e42fce766Ad623cE175002B7b2528411C47cc92",
    foresightToken: "0xEfEa31dc8594eFE8F108282fA23a6826c799b21A",
    usdc: "0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf",
    offchainBinaryMarketImpl: "0x846145DC2850FfB97D14C4AF79675815b6D7AF0f",
    offchainMultiMarket8Impl: "0x1e8BeCF558Baf0F74cEc2D7fa7ba44F0335282e8",
  },
};

function parseBoolEnv(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return undefined;
}

function parsePositiveIntEnv(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

function pickFirstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const v of values) {
    const s = String(v || "").trim();
    if (s) return s;
  }
  return undefined;
}

export function getConfiguredChainId(): number {
  const fromEnv =
    parsePositiveIntEnv(process.env.NEXT_PUBLIC_CHAIN_ID) ??
    parsePositiveIntEnv(process.env.CHAIN_ID);
  if (fromEnv) return fromEnv;
  return DEFAULT_CHAIN_ID;
}

export function getConfiguredRpcUrl(chainId?: number): string {
  const id = chainId ?? getConfiguredChainId();

  const generic = pickFirstNonEmpty(process.env.RPC_URL, process.env.NEXT_PUBLIC_RPC_URL);
  if (generic) return generic;

  if (id === 80002) {
    return (
      pickFirstNonEmpty(process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY, DEFAULT_RPC_URLS[80002]) ||
      DEFAULT_RPC_URLS[80002]
    );
  }
  if (id === 137) {
    return (
      pickFirstNonEmpty(process.env.NEXT_PUBLIC_RPC_POLYGON, DEFAULT_RPC_URLS[137]) ||
      DEFAULT_RPC_URLS[137]
    );
  }
  if (id === 11155111) {
    return (
      pickFirstNonEmpty(process.env.NEXT_PUBLIC_RPC_SEPOLIA, DEFAULT_RPC_URLS[11155111]) ||
      DEFAULT_RPC_URLS[11155111]
    );
  }

  const fallback = DEFAULT_RPC_URLS[id];
  if (fallback) return fallback;
  throw new Error("RPC_URL is not configured");
}

export function getFeatureFlags(): FeatureFlags {
  const aa =
    parseBoolEnv(process.env.NEXT_PUBLIC_AA_ENABLED) ??
    parseBoolEnv(process.env.AA_ENABLED) ??
    parseBoolEnv(process.env.aa_enabled) ??
    false;
  const embeddedFromEnv =
    parseBoolEnv(process.env.NEXT_PUBLIC_EMBEDDED_AUTH_ENABLED) ??
    parseBoolEnv(process.env.EMBEDDED_AUTH_ENABLED) ??
    parseBoolEnv(process.env.embedded_auth_enabled);
  const embedded = embeddedFromEnv ?? process.env.NODE_ENV !== "production";
  return { aa_enabled: aa, embedded_auth_enabled: embedded };
}

export function getChainAddresses(chainId?: number): ChainAddresses {
  const id = chainId ?? getConfiguredChainId();
  const defaults = DEFAULT_ADDRESSES_BY_CHAIN[id] || {};

  const entryPoint = pickFirstNonEmpty(
    process.env.ENTRYPOINT_ADDRESS,
    process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS,
    defaults.entryPoint
  );
  const marketFactory = pickFirstNonEmpty(
    process.env.MARKET_FACTORY_ADDRESS,
    process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS,
    defaults.marketFactory
  );
  const outcomeToken1155 = pickFirstNonEmpty(
    process.env.OUTCOME1155_ADDRESS,
    process.env.NEXT_PUBLIC_OUTCOME_TOKEN_ADDRESS,
    defaults.outcomeToken1155
  );
  const umaAdapter = pickFirstNonEmpty(
    process.env.ORACLE_ADDRESS,
    process.env.UMA_ADAPTER_ADDRESS,
    process.env.NEXT_PUBLIC_UMA_ADAPTER_ADDRESS,
    process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS,
    defaults.umaAdapter
  );

  const foresightToken =
    id === 80002
      ? pickFirstNonEmpty(
          process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_AMOY,
          process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS,
          defaults.foresightToken
        )
      : pickFirstNonEmpty(process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS, defaults.foresightToken);

  const usdc =
    id === 80002
      ? pickFirstNonEmpty(
          process.env.USDC_ADDRESS_AMOY,
          process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY,
          process.env.COLLATERAL_TOKEN_ADDRESS,
          process.env.USDC_ADDRESS,
          process.env.NEXT_PUBLIC_USDC_ADDRESS,
          defaults.usdc
        )
      : id === 137
        ? pickFirstNonEmpty(
            process.env.USDC_ADDRESS_POLYGON,
            process.env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON,
            process.env.COLLATERAL_TOKEN_ADDRESS,
            process.env.USDC_ADDRESS,
            process.env.NEXT_PUBLIC_USDC_ADDRESS,
            defaults.usdc
          )
        : pickFirstNonEmpty(
            process.env.COLLATERAL_TOKEN_ADDRESS,
            process.env.USDC_ADDRESS,
            process.env.NEXT_PUBLIC_USDC_ADDRESS,
            defaults.usdc
          );

  const lpFeeStaking =
    id === 80002
      ? pickFirstNonEmpty(
          process.env.NEXT_PUBLIC_LP_FEE_STAKING_ADDRESS_AMOY,
          process.env.NEXT_PUBLIC_LP_FEE_STAKING_ADDRESS
        )
      : pickFirstNonEmpty(process.env.NEXT_PUBLIC_LP_FEE_STAKING_ADDRESS);

  const offchainBinaryMarketImpl = pickFirstNonEmpty(
    process.env.OFFCHAIN_BINARY_MARKET_IMPL_ADDRESS,
    process.env.NEXT_PUBLIC_OFFCHAIN_BINARY_MARKET_IMPL_ADDRESS,
    defaults.offchainBinaryMarketImpl
  );
  const offchainMultiMarket8Impl = pickFirstNonEmpty(
    process.env.OFFCHAIN_MULTI_MARKET_IMPL_ADDRESS,
    process.env.NEXT_PUBLIC_OFFCHAIN_MULTI_MARKET_IMPL_ADDRESS,
    defaults.offchainMultiMarket8Impl
  );

  return {
    ...(entryPoint ? { entryPoint } : {}),
    ...(marketFactory ? { marketFactory } : {}),
    ...(outcomeToken1155 ? { outcomeToken1155 } : {}),
    ...(umaAdapter ? { umaAdapter } : {}),
    ...(foresightToken ? { foresightToken } : {}),
    ...(usdc ? { usdc } : {}),
    ...(lpFeeStaking ? { lpFeeStaking } : {}),
    ...(offchainBinaryMarketImpl ? { offchainBinaryMarketImpl } : {}),
    ...(offchainMultiMarket8Impl ? { offchainMultiMarket8Impl } : {}),
  };
}

let cached: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  if (cached) return cached;
  const chainId = getConfiguredChainId();
  const rpcUrl = getConfiguredRpcUrl(chainId);
  const flags = getFeatureFlags();
  const addresses = getChainAddresses(chainId);
  cached = { chainId, rpcUrl, flags, addresses };
  return cached;
}
