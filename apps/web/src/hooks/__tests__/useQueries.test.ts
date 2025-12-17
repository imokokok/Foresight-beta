import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { QueryKeys } from "../useQueries";

describe("React Query Keys", () => {
  describe("QueryKeys", () => {
    it("should generate prediction keys correctly", () => {
      const key = QueryKeys.prediction(123);
      expect(key).toEqual(["prediction", 123]);
    });

    it("should generate predictions list key", () => {
      const key = QueryKeys.predictions;
      expect(key).toEqual(["predictions"]);
    });

    it("should generate user profile key", () => {
      const address = "0x1234567890123456789012345678901234567890";
      const key = QueryKeys.userProfile(address);
      expect(key).toEqual(["userProfile", address]);
    });

    it("should generate user portfolio key", () => {
      const address = "0x1234567890123456789012345678901234567890";
      const key = QueryKeys.userPortfolio(address);
      expect(key).toEqual(["userPortfolio", address]);
    });

    it("should generate orders key with params", () => {
      const params = {
        chainId: 11155111,
        contract: "0x123",
        maker: "0x456",
        status: "open",
      };
      const key = QueryKeys.orders(params);
      expect(key).toEqual(["orders", params]);
    });

    it("should generate order depth key", () => {
      const key = QueryKeys.orderDepth("0x123", 11155111, 0);
      expect(key).toEqual(["orderDepth", "0x123", 11155111, 0]);
    });

    it("should generate flags key", () => {
      const userId = "user-123";
      const key = QueryKeys.flags(userId);
      expect(key).toEqual(["flags", userId]);
    });

    it("should generate flag detail key", () => {
      const key = QueryKeys.flag(456);
      expect(key).toEqual(["flag", 456]);
    });

    it("should generate forum threads key", () => {
      const key = QueryKeys.forumThreads(789);
      expect(key).toEqual(["forumThreads", 789]);
    });

    it("should generate market key", () => {
      const key = QueryKeys.market("0xabc", 11155111);
      expect(key).toEqual(["market", "0xabc", 11155111]);
    });

    it("should generate categories key", () => {
      const key = QueryKeys.categories;
      expect(key).toEqual(["categories"]);
    });
  });

  describe("Query Key Patterns", () => {
    it("should allow filtering by key prefix", () => {
      const queryClient = new QueryClient();

      // 模拟场景：删除所有预测相关的缓存
      const predictionKeys = [
        QueryKeys.predictions,
        QueryKeys.prediction(1),
        QueryKeys.prediction(2),
        QueryKeys.predictionOutcomes(1),
      ];

      predictionKeys.forEach((key) => {
        const keyString = JSON.stringify(key);
        expect(keyString).toContain("prediction");
      });
    });

    it("should have unique keys for different resources", () => {
      const keys = [QueryKeys.prediction(1), QueryKeys.flag(1), QueryKeys.market("0x1", 1)];

      const keyStrings = keys.map((k) => JSON.stringify(k));
      const uniqueKeys = new Set(keyStrings);

      expect(uniqueKeys.size).toBe(keys.length);
    });
  });
});
