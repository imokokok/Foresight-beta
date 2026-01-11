/**
 * Meta Transaction (Gas 代付) 服务
 * 让用户无需持有原生代币也能交易
 */

import { ethers, Contract, Wallet, JsonRpcProvider } from "ethers";
import type { SettlementOrder } from "./types.js";
import { settlementLogger } from "../monitoring/logger.js";

// EIP-2612 Permit 签名类型
const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

// EIP-712 Order 类型
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

export interface PermitData {
  owner: string;
  spender: string;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
  signature: string;
}

export interface MetaTransactionRequest {
  // 订单数据
  order: SettlementOrder;
  orderSignature: string;
  fillAmount: bigint;

  // Permit 数据 (可选，用于授权 USDC)
  permit?: PermitData;

  // 请求元数据
  requestedAt: number;
  userAddress: string;
}

/**
 * Meta Transaction 处理器
 */
export class MetaTransactionHandler {
  private provider: JsonRpcProvider;
  private operator: Wallet;

  constructor(
    private chainId: number,
    private marketAddress: string,
    private usdcAddress: string,
    operatorPrivateKey: string,
    rpcUrl: string
  ) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.operator = new Wallet(operatorPrivateKey, this.provider);
  }

  /**
   * 验证订单签名
   */
  async verifyOrderSignature(
    order: SettlementOrder,
    signature: string,
    expectedSigner: string
  ): Promise<boolean> {
    try {
      const domain = {
        name: "Foresight Market",
        version: "1",
        chainId: this.chainId,
        verifyingContract: this.marketAddress,
      };

      const orderData = {
        maker: order.maker,
        outcomeIndex: order.outcomeIndex,
        isBuy: order.isBuy,
        price: order.price,
        amount: order.amount,
        salt: order.salt,
        expiry: order.expiry,
      };

      const recovered = ethers.verifyTypedData(domain, ORDER_TYPES, orderData, signature);
      return recovered.toLowerCase() === expectedSigner.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * 验证 Permit 签名
   */
  async verifyPermitSignature(permit: PermitData): Promise<boolean> {
    try {
      // 获取 USDC 合约的 domain
      const usdcContract = new Contract(
        this.usdcAddress,
        [
          "function name() view returns (string)",
          "function version() view returns (string)",
          "function nonces(address) view returns (uint256)",
        ],
        this.provider
      );

      const [name, version, currentNonce] = await Promise.all([
        usdcContract.name(),
        usdcContract.version().catch(() => "1"), // 有些代币没有 version
        usdcContract.nonces(permit.owner),
      ]);

      // 验证 nonce
      if (permit.nonce !== currentNonce) {
        return false;
      }

      // 验证 deadline
      if (permit.deadline < BigInt(Math.floor(Date.now() / 1000))) {
        return false;
      }

      const domain = {
        name,
        version,
        chainId: this.chainId,
        verifyingContract: this.usdcAddress,
      };

      const permitData = {
        owner: permit.owner,
        spender: permit.spender,
        value: permit.value,
        nonce: permit.nonce,
        deadline: permit.deadline,
      };

      const recovered = ethers.verifyTypedData(domain, PERMIT_TYPES, permitData, permit.signature);
      return recovered.toLowerCase() === permit.owner.toLowerCase();
    } catch (error) {
      settlementLogger.error("MetaTx permit verification error", undefined, error);
      return false;
    }
  }

  /**
   * 处理 Meta Transaction 请求
   */
  async processMetaTransaction(request: MetaTransactionRequest): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      // 1. 验证订单签名
      const orderValid = await this.verifyOrderSignature(
        request.order,
        request.orderSignature,
        request.userAddress
      );

      if (!orderValid) {
        return { success: false, error: "Invalid order signature" };
      }

      // 2. 如果有 Permit，验证并执行
      if (request.permit) {
        const permitValid = await this.verifyPermitSignature(request.permit);
        if (!permitValid) {
          return { success: false, error: "Invalid permit signature" };
        }

        // 执行 permit
        await this.executePermit(request.permit);
      }

      // 3. 验证用户有足够的余额和授权
      const balanceCheck = await this.checkUserBalanceAndAllowance(
        request.userAddress,
        request.order,
        request.fillAmount
      );

      if (!balanceCheck.success) {
        return { success: false, error: balanceCheck.error };
      }

      // 4. 由 Operator 代为提交交易
      // (实际填充由 BatchSettler 处理)
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行 Permit
   */
  private async executePermit(permit: PermitData): Promise<string> {
    const usdcContract = new Contract(
      this.usdcAddress,
      [
        "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
      ],
      this.operator
    );

    // 解析签名
    const sig = ethers.Signature.from(permit.signature);

    const tx = await usdcContract.permit(
      permit.owner,
      permit.spender,
      permit.value,
      permit.deadline,
      sig.v,
      sig.r,
      sig.s
    );

    await tx.wait();
    return tx.hash;
  }

  /**
   * 检查用户余额和授权
   */
  private async checkUserBalanceAndAllowance(
    userAddress: string,
    order: SettlementOrder,
    fillAmount: bigint
  ): Promise<{ success: boolean; error?: string }> {
    const usdcContract = new Contract(
      this.usdcAddress,
      [
        "function balanceOf(address) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)",
      ],
      this.provider
    );

    // 计算需要的 USDC 数量
    const cost = (fillAmount * order.price) / BigInt(1e18);

    if (order.isBuy) {
      // 买入: Maker 需要 USDC
      // (这里假设 userAddress 是 Taker)
      const balance = await usdcContract.balanceOf(userAddress);
      if (balance < cost) {
        return { success: false, error: `Insufficient USDC balance: ${balance} < ${cost}` };
      }

      const allowance = await usdcContract.allowance(userAddress, this.marketAddress);
      if (allowance < cost) {
        return { success: false, error: `Insufficient USDC allowance: ${allowance} < ${cost}` };
      }
    }
    // 卖出: Taker 需要 USDC, Maker 需要 Outcome Token
    // 这里需要检查 Outcome Token 余额

    return { success: true };
  }

  /**
   * 生成 Permit 签名请求消息
   */
  async getPermitMessage(
    owner: string,
    spender: string,
    value: bigint,
    deadline: bigint
  ): Promise<{
    domain: any;
    types: any;
    message: any;
    nonce: bigint;
  }> {
    const usdcContract = new Contract(
      this.usdcAddress,
      [
        "function name() view returns (string)",
        "function version() view returns (string)",
        "function nonces(address) view returns (uint256)",
      ],
      this.provider
    );

    const [name, version, nonce] = await Promise.all([
      usdcContract.name(),
      usdcContract.version().catch(() => "1"),
      usdcContract.nonces(owner),
    ]);

    const domain = {
      name,
      version,
      chainId: this.chainId,
      verifyingContract: this.usdcAddress,
    };

    const message = {
      owner,
      spender,
      value,
      nonce,
      deadline,
    };

    return { domain, types: PERMIT_TYPES, message, nonce };
  }
}

/**
 * 生成订单签名消息
 */
export function getOrderSignMessage(
  chainId: number,
  marketAddress: string,
  order: SettlementOrder
): { domain: any; types: any; message: any } {
  const domain = {
    name: "Foresight Market",
    version: "1",
    chainId,
    verifyingContract: marketAddress,
  };

  const message = {
    maker: order.maker,
    outcomeIndex: order.outcomeIndex,
    isBuy: order.isBuy,
    price: order.price,
    amount: order.amount,
    salt: order.salt,
    expiry: order.expiry,
  };

  return { domain, types: ORDER_TYPES, message };
}
