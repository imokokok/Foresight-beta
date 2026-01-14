/**
 * 数据库连接池混沌工程测试
 * 测试数据库连接池在各种混沌条件下的行为
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DatabasePool } from "../database/connectionPool.js";
import { createChaos } from "./chaosCore.js";

// Mock supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  execute: vi.fn().mockResolvedValue({ data: [], error: null }),
};

// Mock supabase-js
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe("DatabasePool Chaos Tests", () => {
  let pool: DatabasePool;
  let chaos: ReturnType<typeof createChaos>;

  beforeEach(() => {
    // 初始化数据库连接池
    pool = new DatabasePool({
      primary: {
        url: "https://test.supabase.co",
        serviceKey: "test-service-key",
      },
      options: {
        healthCheckInterval: 1000,
      },
    });

    // 初始化混沌实例，配置错误注入和延迟
    chaos = createChaos({
      enabled: true,
      probability: 0.8, // 80% 的概率触发混沌
      scenarios: {
        latency: {
          enabled: true,
          minDelay: 50,
          maxDelay: 500,
        },
        error: {
          enabled: true,
          errorTypes: [
            { type: "DBConnectionError", message: "Database connection error", probability: 0.3 },
            { type: "DBQueryTimeout", message: "Query timed out", probability: 0.3 },
            { type: "DBInternalError", message: "Internal database error", probability: 0.4 },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    // 清理资源
    chaos.close();
    vi.clearAllMocks();
  });

  it("should handle database connection with chaos injection", async () => {
    // 测试数据库连接初始化在混沌条件下的行为
    await expect(pool.initialize()).resolves.not.toThrow();
  });

  it("should handle getWriteClient with chaos injection", async () => {
    await pool.initialize();

    // 为客户端获取方法添加混沌注入
    chaos.addChaosToMethod(pool, "getWriteClient", ["latency"]);

    // 测试获取写入客户端在混沌条件下的行为
    const client = pool.getWriteClient();
    expect(client).toBeDefined();
  });

  it("should handle getReadClient with chaos injection", async () => {
    await pool.initialize();

    // 为客户端获取方法添加混沌注入
    chaos.addChaosToMethod(pool, "getReadClient", ["latency", "error"]);

    // 测试获取读取客户端在混沌条件下的行为
    try {
      const client = pool.getReadClient();
      expect(client).toBeDefined();
    } catch (error) {
      // 捕获错误，验证系统不会崩溃
      expect(error).toBeInstanceOf(Error);
      // 验证错误消息包含预期的错误类型
      const errorMessage = String(error);
      expect(errorMessage).toMatch(/DBConnectionError|DBQueryTimeout|DBInternalError/);
    }
  });

  it("should handle multiple client requests with chaos", async () => {
    await pool.initialize();

    // 为客户端获取方法添加混沌注入
    chaos.addChaosToMethod(pool, "getWriteClient", ["latency"]);
    chaos.addChaosToMethod(pool, "getReadClient", ["error"]);

    // 执行多个客户端请求，验证系统能够处理不同的混沌场景
    const operations = [
      () => pool.getWriteClient(),
      () => pool.getReadClient(),
      () => pool.getWriteClient(),
      () => pool.getReadClient(),
    ];

    for (const operation of operations) {
      try {
        const client = operation();
        // 即使有错误，系统也不应该崩溃
        expect(client).toBeDefined();
      } catch (error) {
        // 捕获错误，验证系统不会崩溃
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it("should handle database connection recovery after errors", async () => {
    await pool.initialize();

    // 配置高概率错误注入
    const errorChaos = createChaos({
      enabled: true,
      probability: 1,
      scenarios: {
        error: {
          enabled: true,
          errorTypes: [
            { type: "DBConnectionError", message: "Database connection error", probability: 1 },
          ],
        },
      },
    });

    // 为客户端获取方法添加错误注入
    errorChaos.addChaosToMethod(pool, "getReadClient", ["error"]);

    // 第一次获取客户端应该失败
    try {
      pool.getReadClient();
      expect.fail("Expected an error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    // 关闭错误混沌，恢复正常
    errorChaos.close();

    // 重置mock
    mockSupabaseClient.execute.mockResolvedValue({ data: [], error: null });

    // 第二次获取客户端应该成功，验证连接恢复
    const client = pool.getReadClient();
    expect(client).toBeDefined();
  });
});
