import { ethers } from "ethers";
import type { OrderInput } from "./matchingEngine.js";
import { supabaseAdmin } from "../supabase.js";
import type { MatchingEngineConfig } from "./types.js";

// EIP-712 类型定义
const ORDER_TYPES = {
  Order: [
    { name: "maker", type: "address" },
    { name: "outcomeIndex", type: "uint256" },
    { name: "isBuy", type: "bool" },
    { name: "price", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "salt", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
};

// 导出函数: 获取RPC提供者
export const providerByChainId = new Map<number, ethers.JsonRpcProvider>();
export function getRpcProvider(chainId: number): ethers.JsonRpcProvider {
  const pickFirstNonEmptyString = (...values: unknown[]): string | undefined => {
    for (const v of values) {
      const s = typeof v === "string" ? v.trim() : "";
      if (s) return s;
    }
    return undefined;
  };

  function getConfiguredRpcUrl(chainId: number): string {
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
  const cached = providerByChainId.get(chainId);
  if (cached) return cached;
  const provider = new ethers.JsonRpcProvider(getConfiguredRpcUrl(chainId));
  providerByChainId.set(chainId, provider);
  return provider;
}

// 导出函数: 验证ERC-1271签名
export async function isValidErc1271Signature(args: {
  maker: string;
  digest: string;
  signature: string;
  chainId: number;
}) {
  const maker = args.maker.toLowerCase();
  const provider = getRpcProvider(args.chainId);
  const erc1271 = new ethers.Contract(
    maker,
    ["function isValidSignature(bytes32,bytes) view returns (bytes4)"],
    provider
  );
  const magic = await erc1271.isValidSignature(args.digest, args.signature);
  return String(magic).toLowerCase() === "0x1626ba7e";
}

/**
 * 验证EIP-712签名
 */
export async function verifySignature(input: OrderInput): Promise<boolean> {
  try {
    const domain = {
      name: "Foresight Market",
      version: "1",
      chainId: input.chainId,
      verifyingContract: input.verifyingContract.toLowerCase(),
    };

    const value = {
      maker: input.maker.toLowerCase(),
      outcomeIndex: BigInt(input.outcomeIndex),
      isBuy: input.isBuy,
      price: input.price,
      amount: input.amount,
      salt: BigInt(input.salt),
      expiry: BigInt(input.expiry),
    };

    let recovered: string;
    try {
      recovered = ethers.verifyTypedData(domain, ORDER_TYPES, value, input.signature);
    } catch {
      return false;
    }

    const expected = [input.ownerEoa, input.maker]
      .filter((v): v is string => !!v)
      .map((v) => v.toLowerCase());
    if (expected.includes(recovered.toLowerCase())) return true;

    // 尝试验证ERC-1271签名
    const digest = ethers.TypedDataEncoder.hash(domain, ORDER_TYPES, value);
    return await isValidErc1271Signature({
      maker: input.maker,
      digest,
      signature: input.signature,
      chainId: input.chainId,
    });
  } catch {
    return false;
  }
}

/**
 * 检查订单是否已存在
 */
export async function checkOrderExists(
  chainId: number,
  verifyingContract: string,
  maker: string,
  salt: string
): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const { count } = await supabaseAdmin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("chain_id", chainId)
    .eq("verifying_contract", verifyingContract)
    .eq("maker_address", maker)
    .eq("maker_salt", salt)
    .in("status", ["open", "partially_filled", "pending", "filled"]);

  return (count || 0) > 0;
}

/**
 * 验证订单
 */
export async function validateOrder(
  input: OrderInput,
  config: MatchingEngineConfig
): Promise<{ valid: boolean; error?: string; errorCode?: string }> {
  // 1. 验证基本参数
  if (!input.marketKey || input.marketKey.trim().length === 0) {
    return { valid: false, error: "Invalid marketKey", errorCode: "INVALID_MARKET_KEY" };
  }
  if (!Number.isInteger(input.outcomeIndex) || input.outcomeIndex < 0) {
    return { valid: false, error: "Invalid outcomeIndex", errorCode: "INVALID_OUTCOME_INDEX" };
  }
  if (!Number.isInteger(input.chainId) || input.chainId <= 0) {
    return { valid: false, error: "Invalid chainId", errorCode: "INVALID_CHAIN_ID" };
  }
  if (!ethers.isAddress(input.verifyingContract)) {
    return {
      valid: false,
      error: "Invalid verifying contract address",
      errorCode: "INVALID_VERIFYING_CONTRACT",
    };
  }
  if (!Number.isInteger(input.expiry) || input.expiry < 0) {
    return { valid: false, error: "Invalid expiry", errorCode: "INVALID_EXPIRY" };
  }
  try {
    BigInt(input.salt);
  } catch {
    return { valid: false, error: "Invalid salt", errorCode: "INVALID_SALT" };
  }

  if (!ethers.isAddress(input.maker)) {
    return { valid: false, error: "Invalid maker address", errorCode: "INVALID_MAKER" };
  }

  if (input.price < config.minPrice || input.price > config.maxPrice) {
    return { valid: false, error: "Price out of range", errorCode: "INVALID_PRICE" };
  }

  if (input.price < 0n) {
    return { valid: false, error: "Price cannot be negative", errorCode: "INVALID_PRICE" };
  }

  const tickOffset = input.price - config.minPrice;
  if (tickOffset % config.priceTickSize !== 0n) {
    return {
      valid: false,
      error: "Price not aligned to tick size",
      errorCode: "INVALID_TICK_SIZE",
    };
  }

  if (input.amount < config.minOrderAmount) {
    return { valid: false, error: "Amount below minimum", errorCode: "INVALID_AMOUNT" };
  }

  if (input.amount > config.maxOrderAmount) {
    return { valid: false, error: "Amount exceeds maximum", errorCode: "INVALID_AMOUNT" };
  }

  if (
    input.tif &&
    input.tif !== "IOC" &&
    input.tif !== "FOK" &&
    input.tif !== "FAK" &&
    input.tif !== "GTC" &&
    input.tif !== "GTD"
  ) {
    return { valid: false, error: "Invalid time in force", errorCode: "INVALID_TIME_IN_FORCE" };
  }

  if (
    input.postOnly &&
    input.tif &&
    (input.tif === "IOC" || input.tif === "FOK" || input.tif === "FAK")
  ) {
    return {
      valid: false,
      error: "Post-only cannot be combined with IOC/FAK/FOK",
      errorCode: "INVALID_POST_ONLY",
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (input.tif === "GTD") {
    if (input.expiry === 0) {
      return { valid: false, error: "GTD requires expiry", errorCode: "INVALID_EXPIRY" };
    }
    if (nowSeconds >= input.expiry) {
      return { valid: false, error: "Order expired", errorCode: "ORDER_EXPIRED" };
    }
    if (config.gtdMaxExpiryDays && config.gtdMaxExpiryDays > 0) {
      const maxExpiry = nowSeconds + Math.floor(config.gtdMaxExpiryDays * 86400);
      if (input.expiry > maxExpiry) {
        return { valid: false, error: "Expiry too far in future", errorCode: "INVALID_EXPIRY" };
      }
    }
  } else if (input.expiry !== 0 && nowSeconds >= input.expiry) {
    return { valid: false, error: "Order expired", errorCode: "ORDER_EXPIRED" };
  }

  return { valid: true };
}
