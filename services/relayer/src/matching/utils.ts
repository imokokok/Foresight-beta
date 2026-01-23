import { ethers } from "ethers";

/**
 * 从多个值中选择第一个非空字符串
 */
export function pickFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}

/**
 * 获取配置的RPC URL
 */
export function getConfiguredRpcUrl(chainId: number): string {
  const generic = pickFirstNonEmptyString(process.env.RPC_URL, process.env.NEXT_PUBLIC_RPC_URL);
  if (generic) return generic;

  if (chainId === 80002) {
    return (
      pickFirstNonEmptyString(
        process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
        "https://rpc-amoy.polygon.technology/"
      ) || "https://rpc-amoy.polygon.technology/"
    );
  }
  if (chainId === 137) {
    return (
      pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_POLYGON, "https://polygon-rpc.com") ||
      "https://polygon-rpc.com"
    );
  }
  if (chainId === 11155111) {
    return (
      pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_SEPOLIA, "https://rpc.sepolia.org") ||
      "https://rpc.sepolia.org"
    );
  }

  return "http://127.0.0.1:8545";
}

/**
 * 获取配置的USDC地址
 */
export function getConfiguredUsdcAddress(): string | undefined {
  return pickFirstNonEmptyString(
    process.env.COLLATERAL_TOKEN_ADDRESS,
    process.env.USDC_ADDRESS,
    process.env.NEXT_PUBLIC_USDC_ADDRESS,
    process.env.NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS
  );
}

/**
 * 获取配置的结果代币地址
 */
export function getConfiguredOutcomeTokenAddress(): string | undefined {
  return pickFirstNonEmptyString(
    process.env.OUTCOME1155_ADDRESS,
    process.env.OUTCOME_TOKEN1155_ADDRESS,
    process.env.NEXT_PUBLIC_OUTCOME_TOKEN_ADDRESS,
    process.env.NEXT_PUBLIC_OUTCOME1155_ADDRESS
  );
}

/**
 * 格式化USDC单位（从micro到正常）
 */
export function formatUsdcUnitsFromMicro(usdcMicro: bigint): string {
  return ethers.formatUnits(usdcMicro, 6);
}

/**
 * 解析USDC单位（从正常到micro）
 */
export function parseUsdcUnitsToMicro(raw: unknown): bigint {
  let numeric = 0;
  if (typeof raw === "number") {
    numeric = raw;
  } else if (typeof raw === "string") {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) numeric = parsed;
  }
  if (!Number.isFinite(numeric) || numeric <= 0) return 0n;
  return BigInt(Math.floor(numeric * 1e6));
}

/**
 * 计算订单的USDC价值
 */
export function orderNotionalUsdc(amount: bigint, price: bigint): bigint {
  if (amount <= 0n || price <= 0n) return 0n;
  return (amount * price) / 1_000_000_000_000_000_000n;
}
