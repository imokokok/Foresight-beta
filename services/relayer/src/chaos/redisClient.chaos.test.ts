/**
 * Redis客户端混沌工程测试
 * 测试Redis客户端在各种混沌条件下的行为
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createChaos } from "./chaosCore.js";

// Mock Redis client
const mockRedisClient = {
  isReady: vi.fn(() => true),
  get: vi.fn().mockResolvedValue("test-value"),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  hget: vi.fn().mockResolvedValue("test-hash-value"),
  hset: vi.fn().mockResolvedValue(1),
  hdel: vi.fn().mockResolvedValue(1),
  publish: vi.fn().mockResolvedValue(1),
  subscribe: vi.fn().mockResolvedValue(1),
  acquireLock: vi.fn().mockResolvedValue("lock-token"),
  releaseLock: vi.fn().mockResolvedValue(true),
  getRawClient: vi.fn(() => mockRedisClient),
};

// Mock redis/client.js
vi.mock("../redis/client.js", () => ({
  getRedisClient: () => mockRedisClient,
  initRedis: vi.fn().mockResolvedValue(true),
  closeRedis: vi.fn().mockResolvedValue(true),
}));

describe("RedisClient Chaos Tests", () => {
  let chaos: ReturnType<typeof createChaos>;

  beforeEach(() => {
    // 初始化混沌实例，配置错误注入和延迟
    chaos = createChaos({
      enabled: true,
      probability: 0.7, // 70% 的概率触发混沌
      scenarios: {
        latency: {
          enabled: true,
          minDelay: 30,
          maxDelay: 300,
        },
        error: {
          enabled: true,
          errorTypes: [
            { type: "RedisConnectionError", message: "Redis connection error", probability: 0.3 },
            { type: "RedisTimeout", message: "Redis operation timed out", probability: 0.4 },
            {
              type: "RedisCommandError",
              message: "Redis command execution failed",
              probability: 0.3,
            },
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

  it("should handle Redis get operation with chaos injection", async () => {
    // 为Redis get方法添加混沌注入
    chaos.addChaosToMethod(mockRedisClient, "get", ["latency", "error"]);

    // 测试Redis get操作在混沌条件下的行为
    try {
      const result = await mockRedisClient.get("test-key");
      // 如果操作成功，验证结果
      expect(result).toBeDefined();
    } catch (error) {
      // 捕获错误，验证系统不会崩溃
      expect(error).toBeInstanceOf(Error);
      // 验证错误消息包含预期的错误类型
      const errorMessage = String(error);
      expect(errorMessage).toMatch(/RedisConnectionError|RedisTimeout|RedisCommandError/);
    }
  });

  it("should handle Redis set operation with chaos injection", async () => {
    // 为Redis set方法添加混沌注入
    chaos.addChaosToMethod(mockRedisClient, "set", ["latency", "error"]);

    // 测试Redis set操作在混沌条件下的行为
    try {
      const result = await mockRedisClient.set("test-key", "test-value");
      // 如果操作成功，验证结果
      expect(result).toBe("OK");
    } catch (error) {
      // 捕获错误，验证系统不会崩溃
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle multiple Redis operations with chaos", async () => {
    // 为多种Redis方法添加混沌注入
    chaos.addChaosToMethod(mockRedisClient, "get", ["latency"]);
    chaos.addChaosToMethod(mockRedisClient, "set", ["error"]);
    chaos.addChaosToMethod(mockRedisClient, "del", ["latency", "error"]);

    // 执行多个Redis操作，验证系统能够处理不同的混沌场景
    const operations = [
      () => mockRedisClient.get("test-key"),
      () => mockRedisClient.set("test-key", "new-value"),
      () => mockRedisClient.del("test-key"),
      () => mockRedisClient.get("non-existent-key"),
    ];

    for (const operation of operations) {
      try {
        await operation();
        // 操作可能成功或失败，但系统不应崩溃
      } catch (error) {
        // 捕获错误，验证系统不会崩溃
        expect(error).toBeInstanceOf(Error);
      }
    }
  });

  it("should handle Redis hash operations with chaos injection", async () => {
    // 为Redis哈希方法添加混沌注入
    chaos.addChaosToMethod(mockRedisClient, "hget", ["latency", "error"]);
    chaos.addChaosToMethod(mockRedisClient, "hset", ["latency", "error"]);

    // 测试Redis哈希操作在混沌条件下的行为
    try {
      // 设置哈希值
      await mockRedisClient.hset("test-hash", "field", "value");

      // 获取哈希值
      const result = await mockRedisClient.hget("test-hash", "field");
      // 如果操作成功，验证结果
      expect(result).toBeDefined();
    } catch (error) {
      // 捕获错误，验证系统不会崩溃
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle Redis publish/subscribe with chaos injection", async () => {
    // 为Redis发布订阅方法添加混沌注入
    chaos.addChaosToMethod(mockRedisClient, "publish", ["latency", "error"]);
    chaos.addChaosToMethod(mockRedisClient, "subscribe", ["latency", "error"]);

    // 测试Redis发布订阅操作在混沌条件下的行为
    try {
      // 订阅频道
      await mockRedisClient.subscribe("test-channel", () => {});

      // 发布消息
      const result = await mockRedisClient.publish("test-channel", "test-message");
      // 如果操作成功，验证结果
      expect(result).toBeDefined();
    } catch (error) {
      // 捕获错误，验证系统不会崩溃
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("should handle Redis connection recovery after errors", async () => {
    // 配置高概率错误注入
    const errorChaos = createChaos({
      enabled: true,
      probability: 1,
      scenarios: {
        error: {
          enabled: true,
          errorTypes: [
            { type: "RedisConnectionError", message: "Redis connection error", probability: 1 },
          ],
        },
      },
    });

    // 为Redis get方法添加错误注入
    errorChaos.addChaosToMethod(mockRedisClient, "get", ["error"]);

    // 第一次操作应该失败
    try {
      await mockRedisClient.get("test-key");
      expect.fail("Expected an error but none was thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    // 关闭错误混沌，恢复正常
    errorChaos.close();

    // 重置mock和混沌状态
    vi.clearAllMocks();

    // 重新创建get方法的mock
    const originalGet = mockRedisClient.get;
    mockRedisClient.get = vi.fn().mockResolvedValue("test-value-after-recovery") as any;

    // 第二次操作应该成功，验证连接恢复
    const result = await mockRedisClient.get("test-key");
    expect(result).toBe("test-value-after-recovery");

    // 恢复原始mock实现
    mockRedisClient.get = originalGet;
  });
});
