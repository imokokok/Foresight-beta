import { describe, it, expect } from "vitest";
import {
  mockPrediction,
  mockOrder,
  mockUserProfile,
  mockMarket,
  createMockPrediction,
  createMockOrder,
  createMockUser,
} from "../mockData";

describe("Mock Data Factory", () => {
  describe("mockPrediction", () => {
    it("should have valid structure", () => {
      expect(mockPrediction).toHaveProperty("id");
      expect(mockPrediction).toHaveProperty("title");
      expect(mockPrediction).toHaveProperty("category");
      expect(mockPrediction).toHaveProperty("status");
      expect(mockPrediction.status).toBe("active");
    });

    it("should have required fields", () => {
      expect(mockPrediction.id).toBeTypeOf("number");
      expect(mockPrediction.title).toBeTypeOf("string");
      expect(mockPrediction.min_stake).toBeGreaterThan(0);
    });
  });

  describe("mockOrder", () => {
    it("should have valid structure", () => {
      expect(mockOrder).toHaveProperty("id");
      expect(mockOrder).toHaveProperty("maker_address");
      expect(mockOrder).toHaveProperty("price");
      expect(mockOrder).toHaveProperty("amount");
      expect(mockOrder.status).toBe("open");
    });

    it("should have valid boolean fields", () => {
      expect(typeof mockOrder.is_buy).toBe("boolean");
    });
  });

  describe("createMockPrediction", () => {
    it("should create prediction with overrides", () => {
      const custom = createMockPrediction({
        id: 999,
        title: "Custom Title",
        category: "自定义",
      });

      expect(custom.id).toBe(999);
      expect(custom.title).toBe("Custom Title");
      expect(custom.category).toBe("自定义");

      // 其他字段应该保持默认值
      expect(custom.status).toBe("active");
      expect(custom.min_stake).toBe(mockPrediction.min_stake);
    });

    it("should create prediction without overrides", () => {
      const prediction = createMockPrediction();
      expect(prediction).toEqual(mockPrediction);
    });
  });

  describe("createMockOrder", () => {
    it("should create order with overrides", () => {
      const custom = createMockOrder({
        id: 888,
        price: "750000",
        is_buy: false,
      });

      expect(custom.id).toBe(888);
      expect(custom.price).toBe("750000");
      expect(custom.is_buy).toBe(false);
    });
  });

  describe("createMockUser", () => {
    it("should create user with overrides", () => {
      const custom = createMockUser({
        username: "Alice",
        is_admin: true,
      });

      expect(custom.username).toBe("Alice");
      expect(custom.is_admin).toBe(true);
      expect(custom.email).toBe(mockUserProfile.email);
    });
  });

  describe("mockMarket", () => {
    it("should have valid addresses", () => {
      expect(mockMarket.verifying_contract).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(mockMarket.collateral_token).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(mockMarket.oracle_address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should have valid chain_id", () => {
      expect(mockMarket.chain_id).toBe(11155111); // Sepolia
    });

    it("should have valid fee_bps", () => {
      expect(mockMarket.fee_bps).toBeGreaterThanOrEqual(0);
      expect(mockMarket.fee_bps).toBeLessThanOrEqual(10000);
    });
  });
});
