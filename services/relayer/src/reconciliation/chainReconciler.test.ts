/**
 * 链上对账器单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ethers
vi.mock("ethers", () => ({
  JsonRpcProvider: vi.fn(() => ({
    getBlockNumber: vi.fn(async () => 1000000),
    getTransactionReceipt: vi.fn(async () => null),
  })),
  Contract: vi.fn(() => ({
    filters: {
      OrderFilledSigned: vi.fn(() => ({})),
    },
    queryFilter: vi.fn(async () => []),
    interface: {
      parseLog: vi.fn(() => null),
    },
  })),
}));

// Mock database pool
vi.mock("../database/connectionPool.js", () => ({
  getDatabasePool: vi.fn(() => ({
    getReadClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
    getWriteClient: vi.fn(() => null),
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

describe("ChainReconciler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuration", () => {
    it("should use default configuration when not provided", async () => {
      const { ChainReconciler } = await import("./chainReconciler.js");
      const reconciler = new ChainReconciler();
      
      const status = reconciler.getStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.lastCheckedBlock).toBe(0);
      expect(status.unresolvedDiscrepancies).toBe(0);
    });

    it("should accept custom configuration", async () => {
      const { ChainReconciler } = await import("./chainReconciler.js");
      const reconciler = new ChainReconciler({
        intervalMs: 60000,
        blockRange: 500,
        autoFix: true,
      });
      
      expect(reconciler.getStatus().isRunning).toBe(false);
    });
  });

  describe("Discrepancy Management", () => {
    it("should start with no discrepancies", async () => {
      const { ChainReconciler } = await import("./chainReconciler.js");
      const reconciler = new ChainReconciler();
      
      expect(reconciler.getDiscrepancies()).toEqual([]);
      expect(reconciler.getUnresolvedDiscrepancies()).toEqual([]);
    });

    it("should resolve discrepancy by ID", async () => {
      const { ChainReconciler } = await import("./chainReconciler.js");
      const reconciler = new ChainReconciler();
      
      // 尝试解决不存在的差异
      const result = reconciler.resolveDiscrepancy("non-existent", "Manual fix");
      
      expect(result).toBe(false);
    });
  });

  describe("Status", () => {
    it("should return correct initial status", async () => {
      const { ChainReconciler } = await import("./chainReconciler.js");
      const reconciler = new ChainReconciler();
      
      const status = reconciler.getStatus();
      
      expect(status).toEqual({
        isRunning: false,
        lastCheckedBlock: 0,
        unresolvedDiscrepancies: 0,
        totalDiscrepancies: 0,
      });
    });
  });
});

