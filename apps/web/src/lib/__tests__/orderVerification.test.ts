import { describe, it, expect, beforeEach } from "vitest";
import { ethers } from "ethers";
import {
  validateOrderParams,
  isOrderExpired,
  verifyOrderSignature,
  validateOrder,
} from "../orderVerification";
import type { EIP712Order } from "@/types/market";

describe("Order Verification - Params and Expiry", () => {
  let validOrder: EIP712Order;
  let testWallet: any;
  const chainId = 11155111; // Sepolia
  const verifyingContract = "0x1234567890123456789012345678901234567890";
  const testPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  beforeEach(() => {
    testWallet = new ethers.Wallet(testPrivateKey);
    validOrder = {
      maker: testWallet.address,
      outcomeIndex: 0,
      isBuy: true,
      price: "500000", // 0.5 USDC (6 decimals)
      amount: "10",
      salt: String(Date.now()),
      expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };
  });

  describe("validateOrderParams", () => {
    it("should accept valid order params", () => {
      const result = validateOrderParams(validOrder);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject invalid maker address", () => {
      const invalidOrder = { ...validOrder, maker: "invalid-address" };
      const result = validateOrderParams(invalidOrder);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("地址格式无效");
    });

    it("should reject price out of range", () => {
      const invalidOrder = { ...validOrder, price: "2000000" }; // > 1 USDC
      const result = validateOrderParams(invalidOrder);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("价格必须在");
    });

    it("should reject zero or negative amount", () => {
      const invalidOrder = { ...validOrder, amount: "0" };
      const result = validateOrderParams(invalidOrder);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("数量必须大于");
    });

    it("should reject invalid outcomeIndex", () => {
      const invalidOrder = { ...validOrder, outcomeIndex: -1 };
      const result = validateOrderParams(invalidOrder);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("outcomeIndex 无效");
    });

    it("should reject expired order", () => {
      const expiredOrder = {
        ...validOrder,
        expiry: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      const result = validateOrderParams(expiredOrder);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("已过期");
    });
  });

  describe("isOrderExpired", () => {
    it("should return false for future expiry", () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      expect(isOrderExpired(futureTimestamp)).toBe(false);
    });

    it("should return true for past expiry", () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
      expect(isOrderExpired(pastTimestamp)).toBe(true);
    });

    it("should return false for zero expiry (no expiration)", () => {
      expect(isOrderExpired(0)).toBe(false);
    });
  });
});

describe("Order Verification - Signature", () => {
  let validOrder: EIP712Order;
  let testWallet: any;
  const chainId = 11155111;
  const verifyingContract = "0x1234567890123456789012345678901234567890";
  const testPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const otherPrivateKey = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  beforeEach(() => {
    testWallet = new ethers.Wallet(testPrivateKey);
    validOrder = {
      maker: testWallet.address,
      outcomeIndex: 0,
      isBuy: true,
      price: "500000",
      amount: "10",
      salt: String(Date.now()),
      expiry: Math.floor(Date.now() / 1000) + 3600,
    };
  });

  describe("verifyOrderSignature", () => {
    it("should verify valid signature", async () => {
      // 创建有效签名
      const domain = {
        name: "Foresight Market",
        version: "1",
        chainId,
        verifyingContract,
      };

      const types = {
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

      const signature = await testWallet.signTypedData(domain, types, validOrder);

      const result = await verifyOrderSignature(validOrder, signature, chainId, verifyingContract);

      expect(result.valid).toBe(true);
      expect(result.recoveredAddress?.toLowerCase()).toBe(testWallet.address.toLowerCase());
    });

    it("should reject invalid signature", async () => {
      const invalidSignature = "0xinvalidsignature";

      const result = await verifyOrderSignature(
        validOrder,
        invalidSignature,
        chainId,
        verifyingContract
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject signature from wrong signer", async () => {
      const wrongWallet = new ethers.Wallet(otherPrivateKey);

      const domain = {
        name: "Foresight Market",
        version: "1",
        chainId,
        verifyingContract,
      };

      const types = {
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

      // 使用错误的钱包签名
      const signature = await wrongWallet.signTypedData(domain, types, validOrder);

      const result = await verifyOrderSignature(validOrder, signature, chainId, verifyingContract);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("签名地址不匹配");
    });
  });

  describe("validateOrder (完整验证)", () => {
    it("should validate complete order with valid signature", async () => {
      const domain = {
        name: "Foresight Market",
        version: "1",
        chainId,
        verifyingContract,
      };

      const types = {
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

      const signature = await testWallet.signTypedData(domain, types, validOrder);

      const result = await validateOrder(validOrder, signature, chainId, verifyingContract);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject order with invalid params", async () => {
      const invalidOrder = { ...validOrder, price: "-100" };
      const fakeSignature = "0x" + "a".repeat(130);

      const result = await validateOrder(invalidOrder, fakeSignature, chainId, verifyingContract);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
