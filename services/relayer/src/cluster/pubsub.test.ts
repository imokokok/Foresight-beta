/**
 * Redis Pub/Sub 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis client
const mockSubscribe = vi.fn();
const mockPublish = vi.fn();
const mockConnect = vi.fn(async () => {});
const mockQuit = vi.fn(async () => {});

vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    connect: mockConnect,
    quit: mockQuit,
    subscribe: mockSubscribe,
    publish: mockPublish,
    on: vi.fn(),
    duplicate: vi.fn(() => ({
      connect: mockConnect,
      quit: mockQuit,
      subscribe: mockSubscribe,
      on: vi.fn(),
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

describe("RedisPubSub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Configuration", () => {
    it("should use default configuration when not provided", async () => {
      const { RedisPubSub } = await import("./pubsub.js");
      const pubsub = new RedisPubSub();

      expect(pubsub.getNodeId()).toBeTruthy();
      expect(pubsub.isReady()).toBe(false);
    });

    it("should accept custom node ID", async () => {
      const { RedisPubSub } = await import("./pubsub.js");
      const pubsub = new RedisPubSub({}, "custom-node-id");

      expect(pubsub.getNodeId()).toBe("custom-node-id");
    });
  });

  describe("Channel Names", () => {
    it("should define correct channel constants", async () => {
      const { CHANNELS } = await import("./pubsub.js");

      expect(CHANNELS.WS_DEPTH).toBe("ws:depth");
      expect(CHANNELS.WS_TRADES).toBe("ws:trades");
      expect(CHANNELS.WS_STATS).toBe("ws:stats");
      expect(CHANNELS.CLUSTER_EVENTS).toBe("cluster:events");
    });
  });

  describe("Connection State", () => {
    it("should report not ready before connection", async () => {
      const { RedisPubSub } = await import("./pubsub.js");
      const pubsub = new RedisPubSub();

      expect(pubsub.isReady()).toBe(false);
    });
  });
});
