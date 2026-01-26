import { ethers } from "ethers";
import type { Provider, TypedDataField } from "ethers";
import { ORDER_TYPES, type EIP712Order, type EIP712Domain } from "@/types/market";

/**
 * 创建 EIP-712 Domain
 */
export function createOrderDomain(chainId: number, verifyingContract: string): EIP712Domain {
  return {
    name: "Foresight Market",
    version: "1",
    chainId,
    verifyingContract,
  };
}

/**
 * 验证订单签名
 * @param order 订单数据
 * @param signature 签名
 * @param chainId 链ID
 * @param verifyingContract 验证合约地址
 * @returns 签名是否有效
 */
export async function verifyOrderSignature(
  order: EIP712Order,
  signature: string,
  chainId: number,
  verifyingContract: string,
  options?: { provider?: Provider; ownerEoa?: string }
): Promise<{ valid: boolean; recoveredAddress?: string; error?: string }> {
  try {
    const normalizedMaker = order.maker.toLowerCase();
    const normalizedOwner = options?.ownerEoa ? options.ownerEoa.toLowerCase() : "";
    const expectedSigner = normalizedOwner || normalizedMaker;
    const normalizedContract = verifyingContract.toLowerCase();

    const domain = createOrderDomain(chainId, normalizedContract);
    const orderTypesMutable: Record<string, TypedDataField[]> = {
      Order: ORDER_TYPES.Order.map((field) => ({ ...field })),
    };
    const recoveredAddress = ethers.verifyTypedData(domain, orderTypesMutable, order, signature);

    const recoveredNorm = recoveredAddress.toLowerCase();
    const valid = recoveredNorm === expectedSigner;

    if (!valid) {
      const provider = options?.provider;
      if (provider) {
        try {
          const digest = ethers.TypedDataEncoder.hash(domain, orderTypesMutable, order);
          const erc1271 = new ethers.Contract(
            normalizedMaker,
            ["function isValidSignature(bytes32,bytes) view returns (bytes4)"],
            provider
          );
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          try {
            const magic = await erc1271.isValidSignature(digest, signature, {
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (String(magic).toLowerCase() === "0x1626ba7e") {
              return { valid: true, recoveredAddress };
            }
          } catch (err) {
            clearTimeout(timeoutId);
            if (process.env.NODE_ENV === "development") {
              console.warn("ERC-1271 verification failed:", err);
            }
          }
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.warn("ERC-1271 contract call failed:", err);
          }
        }
      }
      return {
        valid: false,
        recoveredAddress,
        error: `Signature address mismatch: expected ${expectedSigner}, got ${recoveredNorm}`,
      };
    }

    return {
      valid: true,
      recoveredAddress,
    };
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      try {
        console.error("Order signature verification error:", error);
      } catch {}
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Signature verification failed",
    };
  }
}

/**
 * 验证订单是否过期
 */
export function isOrderExpired(expiryTimestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return expiryTimestamp > 0 && now >= expiryTimestamp;
}

/**
 * 验证订单参数
 */
export function validateOrderParams(order: EIP712Order): { valid: boolean; error?: string } {
  // 验证地址格式
  if (!ethers.isAddress(order.maker)) {
    return { valid: false, error: "Invalid maker address format" };
  }

  // 验证价格范围 (USDC 6 decimals, per 1e18 share)
  const price = BigInt(order.price);
  const amount = BigInt(order.amount);
  const MAX_PRICE = BigInt(1_000_000); // 1 USDC = 1,000,000 (6 decimals)

  if (price <= BigInt(0) || price > MAX_PRICE) {
    return { valid: false, error: "Price must be between 0 and 1 USDC" };
  }

  // 验证数量
  if (amount <= BigInt(0)) {
    return { valid: false, error: "Amount must be greater than 0" };
  }

  // 验证 outcomeIndex
  if (order.outcomeIndex < 0 || order.outcomeIndex > 255) {
    return { valid: false, error: "Invalid outcomeIndex" };
  }

  // 验证过期时间
  if (order.expiry > 0) {
    const maxExpiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 年
    if (order.expiry > maxExpiry) {
      return { valid: false, error: "Expiry time is too long (maximum 1 year)" };
    }

    if (isOrderExpired(order.expiry)) {
      return { valid: false, error: "Order has already expired" };
    }
  }

  return { valid: true };
}

/**
 * 完整的订单验证流程
 */
export async function validateOrder(
  order: EIP712Order,
  signature: string,
  chainId: number,
  verifyingContract: string
): Promise<{ valid: boolean; error?: string }> {
  // 1. 验证订单参数
  const paramsValidation = validateOrderParams(order);
  if (!paramsValidation.valid) {
    return paramsValidation;
  }

  // 2. 验证签名
  const signatureValidation = await verifyOrderSignature(
    order,
    signature,
    chainId,
    verifyingContract
  );

  if (!signatureValidation.valid) {
    return {
      valid: false,
      error: signatureValidation.error,
    };
  }

  return { valid: true };
}
