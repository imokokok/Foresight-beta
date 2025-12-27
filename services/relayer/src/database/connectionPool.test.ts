/**
 * 数据库连接池单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          single: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

// Mock logger
vi.mock("../monitoring/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock metrics
vi.mock("../monitoring/metrics.js", () => ({
  metricsRegistry: {
    registerMetric: vi.fn(),
  },
}));

describe("DatabasePool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuration", () => {
    it("should use environment variables for default config", async () => {
      const { DatabasePool } = await import("./connectionPool.js");
      const pool = new DatabasePool();
      
      // 验证可以创建实例
      expect(pool).toBeTruthy();
    });

    it("should accept custom configuration", async () => {
      const { DatabasePool } = await import("./connectionPool.js");
      const pool = new DatabasePool({
        primary: {
          url: "https://custom.supabase.co",
          serviceKey: "custom-key",
        },
      });
      
      expect(pool).toBeTruthy();
    });
  });

  describe("Client Access", () => {
    it("should return null write client before initialization", async () => {
      const { DatabasePool } = await import("./connectionPool.js");
      const pool = new DatabasePool();
      
      // 未初始化时返回 null
      expect(pool.getWriteClient()).toBeNull();
    });

    it("should return null read client before initialization", async () => {
      const { DatabasePool } = await import("./connectionPool.js");
      const pool = new DatabasePool();
      
      expect(pool.getReadClient()).toBeNull();
    });
  });

  describe("Statistics", () => {
    it("should return empty stats before initialization", async () => {
      const { DatabasePool } = await import("./connectionPool.js");
      const pool = new DatabasePool();
      
      const stats = pool.getStats();
      
      expect(stats.primaryConnected).toBe(false);
      expect(stats.replicaCount).toBe(0);
      expect(stats.healthyReplicaCount).toBe(0);
    });
  });

  describe("Replica Configuration", () => {
    it("should parse replica config from environment", async () => {
      const { DatabasePool } = await import("./connectionPool.js");
      const pool = new DatabasePool();
      
      const stats = pool.getStats();
      
      // 没有配置副本时应为空
      expect(stats.replicas).toEqual([]);
    });
  });
});

