import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, RateLimits, getIP } from "../rateLimit";

describe("Rate Limiting", () => {
  beforeEach(() => {
    // 清理之前的测试数据
    vi.clearAllMocks();
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", () => {
      const identifier = "test-user-1";
      const config = { limit: 5, windowMs: 60000 };

      // 前5次请求应该都成功
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(identifier, config);
        expect(result.success).toBe(true);
        expect(result.limited).toBe(false);
        expect(result.remaining).toBe(5 - i - 1);
      }
    });

    it("should block requests exceeding limit", () => {
      const identifier = "test-user-2";
      const config = { limit: 3, windowMs: 60000 };

      // 前3次成功
      for (let i = 0; i < 3; i++) {
        checkRateLimit(identifier, config);
      }

      // 第4次应该被限流
      const result = checkRateLimit(identifier, config);
      expect(result.success).toBe(false);
      expect(result.limited).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it("should reset after window expires", () => {
      const identifier = "test-user-3";
      const config = { limit: 2, windowMs: 100 }; // 100ms 窗口

      // 用完限额
      checkRateLimit(identifier, config);
      checkRateLimit(identifier, config);

      const blocked = checkRateLimit(identifier, config);
      expect(blocked.success).toBe(false);

      // 等待窗口过期
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = checkRateLimit(identifier, config);
          expect(result.success).toBe(true);
          expect(result.remaining).toBe(1);
          resolve(undefined);
        }, 150);
      });
    });

    it("should track different identifiers separately", () => {
      const config = { limit: 2, windowMs: 60000 };

      const user1 = checkRateLimit("user-1", config);
      const user2 = checkRateLimit("user-2", config);

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
        windowMs: 60000,
      });
    });

    it("should have correct moderate config", () => {
      expect(RateLimits.moderate).toEqual({
        limit: 20,
        windowMs: 60000,
      });
    });

    it("should have correct relaxed config", () => {
      expect(RateLimits.relaxed).toEqual({
        limit: 100,
        windowMs: 60000,
      });
    });
  });
});
