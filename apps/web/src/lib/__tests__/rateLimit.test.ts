import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, RateLimits, getIP } from "../rateLimit";

describe("Rate Limiting", () => {
  beforeEach(() => {
    // 清理之前的测试数据
    vi.clearAllMocks();
    // 使用真实计时器
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", async () => {
      const identifier = "test-user-1";
      const config = { limit: 5, interval: 60000 };

      // 前5次请求应该都成功
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(identifier, config);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(5 - i - 1);
      }
    });

    it("should isolate rate limits by namespace", async () => {
      const identifier = "test-user-ns";
      const config = { limit: 1, interval: 60000 };

      const ns1a = await checkRateLimit(identifier, config, "ns1");
      const ns2a = await checkRateLimit(identifier, config, "ns2");
      const ns1b = await checkRateLimit(identifier, config, "ns1");

      expect(ns1a.success).toBe(true);
      expect(ns2a.success).toBe(true);
      expect(ns1b.success).toBe(false);
    });

    it("should block requests exceeding limit", async () => {
      const identifier = "test-user-2";
      const config = { limit: 3, interval: 60000 };

      // 前3次成功
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(identifier, config);
      }

      // 第4次应该被限流
      const result = await checkRateLimit(identifier, config);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should reset after window expires", async () => {
      const identifier = "test-user-3";
      const config = { limit: 2, interval: 100 }; // 100ms 窗口

      // 用完限额
      await checkRateLimit(identifier, config);
      await checkRateLimit(identifier, config);

      const blocked = await checkRateLimit(identifier, config);
      expect(blocked.success).toBe(false);

      // 等待窗口过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = await checkRateLimit(identifier, config);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it("should track different identifiers separately", async () => {
      const config = { limit: 2, interval: 60000 };

      const user1 = await checkRateLimit("user-1", config);
      const user2 = await checkRateLimit("user-2", config);

      expect(user1.success).toBe(true);
      expect(user2.success).toBe(true);
      expect(user1.remaining).toBe(1);
      expect(user2.remaining).toBe(1);
    });
  });

  describe("getIP", () => {
    it("should extract IP from x-forwarded-for", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        },
      });

      const ip = getIP(request);
      expect(ip).toBe("1.2.3.4");
    });

    it("should fallback to x-real-ip", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-real-ip": "1.2.3.4",
        },
      });

      const ip = getIP(request);
      expect(ip).toBe("1.2.3.4");
    });

    it("should return unknown if no IP headers", () => {
      const request = new Request("http://localhost");

      const ip = getIP(request);
      expect(ip).toBe("unknown");
    });
  });

  describe("RateLimits presets", () => {
    it("should have correct strict config", () => {
      expect(RateLimits.strict).toEqual({
        limit: 5,
        interval: 60000,
      });
    });

    it("should have correct moderate config", () => {
      expect(RateLimits.moderate).toEqual({
        limit: 20,
        interval: 60000,
      });
    });

    it("should have correct relaxed config", () => {
      expect(RateLimits.relaxed).toEqual({
        limit: 60,
        interval: 60000,
      });
    });
  });
});
