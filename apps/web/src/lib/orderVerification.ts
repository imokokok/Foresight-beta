import { ethers } from 'ethers';
import { ORDER_TYPES, type EIP712Order, type EIP712Domain } from '@/types/market';

/**
 * 创建 EIP-712 Domain
 */
export function createOrderDomain(chainId: number, verifyingContract: string): EIP712Domain {
  return {
    name: 'Foresight Market',
    version: '1',
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
  verifyingContract: string
): Promise<{ valid: boolean; recoveredAddress?: string; error?: string }> {
  try {
    // 规范化地址
    const normalizedMaker = order.maker.toLowerCase();
    const normalizedContract = verifyingContract.toLowerCase();

    // 创建 domain
    const domain = createOrderDomain(chainId, normalizedContract);

    // 验证签名并恢复地址
    const recoveredAddress = ethers.verifyTypedData(
      domain,
      ORDER_TYPES,
      order,
      signature
    );

    // 检查恢复的地址是否与 maker 匹配
    const valid = recoveredAddress.toLowerCase() === normalizedMaker;

    if (!valid) {
      return {
        valid: false,
        recoveredAddress,
        error: `签名地址不匹配: 期望 ${normalizedMaker}, 实际 ${recoveredAddress.toLowerCase()}`,
      };
    }

    return {
      valid: true,
      recoveredAddress,
    };
  } catch (error: any) {
    console.error('Order signature verification error:', error);
    return {
      valid: false,
      error: error.message || '签名验证失败',
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
    return { valid: false, error: 'maker 地址格式无效' };
  }

  // 验证价格范围 (假设使用 6 位小数的 USDC)
  const price = BigInt(order.price);
  const amount = BigInt(order.amount);
  const MAX_PRICE = BigInt(1_000_000); // 1 USDC = 1,000,000 (6 decimals)
  
  if (price <= BigInt(0) || price > MAX_PRICE) {
    return { valid: false, error: '价格必须在 0 到 1 USDC 之间' };
  }

  // 验证数量
  if (amount <= BigInt(0)) {
    return { valid: false, error: '数量必须大于 0' };
  }

  // 验证 outcomeIndex
  if (order.outcomeIndex < 0 || order.outcomeIndex > 255) {
    return { valid: false, error: 'outcomeIndex 无效' };
  }

  // 验证过期时间
  if (order.expiry > 0) {
    const maxExpiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 年
    if (order.expiry > maxExpiry) {
      return { valid: false, error: '过期时间过长（最多 1 年）' };
    }

    if (isOrderExpired(order.expiry)) {
      return { valid: false, error: '订单已过期' };
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

