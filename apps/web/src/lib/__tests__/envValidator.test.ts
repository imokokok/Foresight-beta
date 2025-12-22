/**
 * EnvValidator 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv, generateEnvExample } from "../envValidator";

describe("EnvValidator", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 重置环境变量
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateEnv", () => {
    it("should return errors for missing required env vars", () => {
      // 清空所有环境变量
      process.env = { NODE_ENV: "test" } as any;

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    it("should pass validation with all required env vars", () => {
      process.env = {
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
        NEXT_PUBLIC_CHAIN_ID: "80002",
        NEXT_PUBLIC_RPC_URL: "https://rpc.test.com",
        NEXT_PUBLIC_USDC_ADDRESS: "0x1234567890123456789012345678901234567890",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        JWT_SECRET: "a".repeat(32), // 至少 32 字符
      };

      const result = validateEnv();

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should warn about short JWT_SECRET", () => {
      process.env = {
        NODE_ENV: "test",
        NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
        NEXT_PUBLIC_CHAIN_ID: "80002",
        NEXT_PUBLIC_RPC_URL: "https://rpc.test.com",
        NEXT_PUBLIC_USDC_ADDRESS: "0x1234567890123456789012345678901234567890",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        JWT_SECRET: "short", // 太短
      };

      const result = validateEnv();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("JWT_SECRET"))).toBe(true);
    });
  });

  describe("generateEnvExample", () => {
    it("should generate valid .env.example content", () => {
      const content = generateEnvExample();

      expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(content).toContain("JWT_SECRET");
      expect(content).toContain("[必需]");
      expect(content).toContain("[可选]");
    });
  });
});
