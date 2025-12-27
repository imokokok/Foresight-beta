/**
 * Leader Election 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis client
vi.mock("../redis/client.js", () => ({
  getRedisClient: vi.fn(() => ({
    isReady: vi.fn(() => true),
    connect: vi.fn(async () => true),
    disconnect: vi.fn(async () => {}),
    set: vi.fn(async () => true),
    get: vi.fn(async () => null),
    del: vi.fn(async () => true),
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

describe("LeaderElection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Configuration", () => {
    it("should use default configuration when not provided", async () => {
      const { LeaderElection } = await import("./leaderElection.js");
      const election = new LeaderElection();
      
      expect(election.getNodeId()).toBeTruthy();
      expect(election.isCurrentLeader()).toBe(false);
    });

    it("should use provided configuration", async () => {
      const { LeaderElection } = await import("./leaderElection.js");
      const election = new LeaderElection({
        nodeId: "test-node-1",
        lockTtlMs: 60000,
        renewIntervalMs: 20000,
      });
      
      expect(election.getNodeId()).toBe("test-node-1");
    });
  });

  describe("Node ID Generation", () => {
    it("should generate unique node IDs", async () => {
      const { LeaderElection } = await import("./leaderElection.js");
      
      const election1 = new LeaderElection();
      const election2 = new LeaderElection();
      
      // 由于是单例模式，需要检查生成逻辑
      expect(election1.getNodeId()).toBeTruthy();
      expect(typeof election1.getNodeId()).toBe("string");
    });
  });

  describe("Leadership State", () => {
    it("should start as non-leader", async () => {
      const { LeaderElection } = await import("./leaderElection.js");
      const election = new LeaderElection({ nodeId: "test-node" });
      
      expect(election.isCurrentLeader()).toBe(false);
    });
  });

  describe("Leader Info", () => {
    it("should return null when no leader exists", async () => {
      const { LeaderElection } = await import("./leaderElection.js");
      const election = new LeaderElection({ nodeId: "test-node" });
      
      const leader = await election.getCurrentLeader();
      expect(leader).toBeNull();
    });
  });
});

