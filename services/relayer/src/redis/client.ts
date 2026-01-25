/**
 * Redis 客户端类
 * 用于订单簿快照持久化和状态同步
 *
 * 主要功能:
 * - 基础键值操作 (get, set, del)
 * - Hash 操作 (用于订单簿数据存储)
 * - List 操作 (用于事件队列)
 * - 分布式锁支持 (acquireLock, releaseLock, refreshLock)
 * - 自动重连和熔断机制
 *
 * @example
 * ```typescript
 * const client = new RedisClient({ host: 'localhost', port: 6379 });
 * await client.connect();
 * await client.set('key', 'value');
 * const value = await client.get('key');
 * await client.disconnect();
 * ```
 */

import { createClient, RedisClientType } from "redis";
import { randomBytes } from "node:crypto";
import { redisLogger as logger } from "../monitoring/logger.js";
import {
  redisOperationsTotal,
  redisOperationLatency,
  redisConnectionStatus,
} from "../monitoring/metrics.js";
import { CircuitBreaker } from "../resilience/circuitBreaker.js";

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  commandTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  circuitBreaker?: {
    /**
     * 失败阈值百分比 (0-100)
     * 当失败率超过此值时，熔断器将从关闭状态转为打开状态
     * 默认值: 50
     */
    failureThreshold?: number;
    /**
     * 成功阈值 (连续成功次数)
     * 熔断器处于半开状态时，需要连续成功此次数才能恢复到关闭状态
     * 默认值: 3
     */
    successThreshold?: number;
    /**
     * 熔断器打开状态的持续时间 (毫秒)
     * 超过此时间后，熔断器会尝试转换为半开状态
     * 默认值: 30000 (30秒)
     */
    resetTimeout?: number;
    /**
     * 半开状态的最大持续时间 (毫秒)
     * 超过此时间后，无论成功与否都会转换状态
     * 默认值: 10000 (10秒)
     */
    halfOpenTimeout?: number;
    /**
     * 半开状态转换为关闭状态所需的最小成功率 (0-100)
     * 半开状态下请求的成功率需要达到此值才能恢复关闭状态
     * 默认值: 70
     */
    halfOpenSuccessThreshold?: number;
    /**
     * 错误率阈值 (0-1)
     * 当滑动窗口内的错误率超过此值时触发熔断
     * 默认值: 0.5
     */
    errorRateThreshold?: number;
    /**
     * 最小请求数
     * 滑动窗口内请求数少于此时不触发熔断
     * 默认值: 10
     */
    minRequests?: number;
  };
}

const DEFAULT_CONFIG: RedisConfig = {
  host: "localhost",
  port: 6379,
  db: 0,
  keyPrefix: "foresight:",
  connectTimeout: 5000,
  commandTimeout: 3000,
  retryAttempts: 3,
  retryDelay: 1000,
  circuitBreaker: {
    failureThreshold: 50,
    successThreshold: 3,
    resetTimeout: 30000,
    halfOpenTimeout: 10000,
    halfOpenSuccessThreshold: 70,
  },
};

class RedisClient {
  private client: RedisClientType | null = null;
  private config: RedisConfig;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private circuitBreaker: CircuitBreaker; // 熔断机制实例

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const cbConfig = this.config.circuitBreaker || {};
    this.circuitBreaker = new CircuitBreaker({
      name: "redis-client",
      failureThreshold: cbConfig.failureThreshold ?? 5,
      successThreshold: cbConfig.successThreshold ?? 3,
      openDuration: cbConfig.resetTimeout || this.config.circuitBreaker?.resetTimeout || 30000,
      timeout: this.config.commandTimeout || 10000,
      windowSize: 60000,
      errorRateThreshold: cbConfig.errorRateThreshold ?? 0.5,
      minRequests: cbConfig.minRequests ?? 10,
    });
  }

  /**
   * 通用Redis操作执行方法
   * 统一处理Redis操作的执行、重试和错误处理
   */
  private async executeWithRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    retryAttempts: number = this.config.retryAttempts || 3,
    retryDelay: number = this.config.retryDelay || 1000
  ): Promise<T | null> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      if (!this.isReady()) {
        logger.warn(`Redis operation ${operation} skipped, client not ready`, { attempt });
        return null;
      }

      const start = Date.now();
      try {
        // 使用熔断器包装操作
        const result = await this.circuitBreaker.execute(async () => {
          return await fn();
        });

        // 记录成功指标
        redisOperationsTotal.inc({ operation, status: "success" });
        redisOperationLatency.observe({ operation }, Date.now() - start);

        // 如果是重试成功，记录恢复事件
        if (attempt > 0) {
          logger.info(`Redis operation ${operation} recovered after ${attempt} retries`, {
            operation,
            attempt,
          });
        }

        return result;
      } catch (error: any) {
        // 记录错误指标
        redisOperationsTotal.inc({ operation, status: "error" });
        redisOperationLatency.observe({ operation }, Date.now() - start);

        lastError = error;

        // 如果是最后一次尝试，记录错误
        if (attempt >= retryAttempts) {
          logger.error(`Redis operation ${operation} failed after ${retryAttempts} retries`, {
            operation,
            error: error.message,
          });
          return null;
        }

        // 记录重试事件
        logger.warn(
          `Redis operation ${operation} failed, retrying (${attempt + 1}/${retryAttempts})`,
          {
            operation,
            error: error.message,
          }
        );

        // 指数退避延迟
        await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }

    // 理论上不会到这里，但为了类型安全
    logger.error(`Redis operation ${operation} failed unexpectedly`, {
      operation,
      error: lastError?.message || "Unknown error",
    });
    return null;
  }

  /**
   * 连接到 Redis
   */
  async connect(): Promise<boolean> {
    if (this.client && this.isConnected) {
      return true;
    }

    try {
      const url = this.config.url || `redis://${this.config.host}:${this.config.port}`;

      this.client = createClient({
        url,
        password: this.config.password,
        database: this.config.db,
        socket: {
          connectTimeout: this.config.connectTimeout,
          reconnectStrategy: (retries) => {
            if (retries > (this.config.retryAttempts || 3)) {
              logger.error("Redis max retries reached, giving up");
              return new Error("Max retries reached");
            }
            const delay = Math.min(retries * (this.config.retryDelay || 1000), 5000);
            logger.info("Redis reconnecting", { retries, delay });
            return delay;
          },
        },
      });

      this.client.on("connect", () => {
        logger.info("Redis connecting");
      });

      this.client.on("ready", () => {
        this.isConnected = true;
        redisConnectionStatus.set(1);
        logger.info("Redis connected and ready");
      });

      this.client.on("error", (err) => {
        logger.error("Redis error", {}, err);
        redisConnectionStatus.set(0);
      });

      this.client.on("end", () => {
        this.isConnected = false;
        redisConnectionStatus.set(0);
        logger.warn("Redis connection closed");
      });

      await this.client.connect();
      return true;
    } catch (error: any) {
      logger.error("Failed to connect to Redis", {}, error);
      redisConnectionStatus.set(0);
      return false;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      redisConnectionStatus.set(0);
      logger.info("Redis disconnected");
    }
  }

  /**
   * 检查连接状态
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Ping 测试
   */
  async ping(): Promise<boolean> {
    if (!this.isReady()) return false;

    const start = Date.now();
    try {
      await this.client!.ping();
      redisOperationsTotal.inc({ operation: "ping", status: "success" });
      redisOperationLatency.observe({ operation: "ping" }, Date.now() - start);
      return true;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "ping", status: "error" });
      redisOperationLatency.observe({ operation: "ping" }, Date.now() - start);
      logger.error("Redis ping failed", {}, error);
      return false;
    }
  }

  /**
   * 获取带前缀的键名
   * @param key - 原始键名
   * @returns 带配置前缀的完整键名
   */
  private prefixKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * 获取带前缀的键名 (公开方法)
   * @param key - 原始键名
   * @returns 带配置前缀的完整键名
   * @example
   * ```typescript
   * const fullKey = client.getPrefixedKey('order:123');
   * // 返回: 'foresight:order:123'
   * ```
   */

  getPrefixedKey(key: string): string {
    return this.prefixKey(key);
  }

  // ============================================================
  // 基础操作
  // ============================================================

  async get(key: string): Promise<string | null> {
    return this.executeWithRetry<string | null>("get", async () => {
      return await this.client!.get(this.prefixKey(key));
    });
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const result = await this.executeWithRetry<string | null>("set", async () => {
      if (ttlSeconds) {
        return await this.client!.setEx(this.prefixKey(key), ttlSeconds, value);
      } else {
        return await this.client!.set(this.prefixKey(key), value);
      }
    });
    return result === "OK";
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.trunc(ttlSeconds) : 0;
    if (!ttl) return false;

    const result = await this.executeWithRetry<string | null>("setnx", async () => {
      return await this.client!.set(this.prefixKey(key), value, { NX: true, EX: ttl });
    });
    return result === "OK";
  }

  async del(key: string): Promise<boolean> {
    const result = await this.executeWithRetry<number>("del", async () => {
      return await this.client!.del(this.prefixKey(key));
    });
    return result !== null;
  }

  // ============================================================
  // Hash 操作 (用于订单簿)
  // ============================================================

  async hGet(key: string, field: string): Promise<string | null> {
    return this.executeWithRetry<string | undefined>("hget", async () => {
      return await this.client!.hGet(this.prefixKey(key), field);
    }).then((result) => result ?? null);
  }

  async hSet(key: string, field: string, value: string): Promise<boolean> {
    const result = await this.executeWithRetry<number>("hset", async () => {
      return await this.client!.hSet(this.prefixKey(key), field, value);
    });
    return result !== null;
  }

  async hGetAll(key: string): Promise<Record<string, string> | null> {
    return this.executeWithRetry<Record<string, string>>("hgetall", async () => {
      return await this.client!.hGetAll(this.prefixKey(key));
    });
  }

  async hSetMultiple(key: string, fields: Record<string, string>): Promise<boolean> {
    const result = await this.executeWithRetry<number>("hset_multi", async () => {
      return await this.client!.hSet(this.prefixKey(key), fields);
    });
    return result !== null;
  }

  async hDel(key: string, ...fields: string[]): Promise<boolean> {
    const result = await this.executeWithRetry<number>("hdel", async () => {
      return await this.client!.hDel(this.prefixKey(key), fields);
    });
    return result !== null;
  }

  // ============================================================
  // List 操作 (用于事件队列)
  // ============================================================

  async lPush(key: string, ...values: string[]): Promise<number> {
    const result = await this.executeWithRetry<number>("lpush", async () => {
      return await this.client!.lPush(this.prefixKey(key), values);
    });
    return result || 0;
  }

  async rPop(key: string): Promise<string | null> {
    return this.executeWithRetry<string | null>("rpop", async () => {
      return await this.client!.rPop(this.prefixKey(key));
    });
  }

  // ============================================================
  // 过期时间操作
  // ============================================================

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.executeWithRetry<boolean>("expire", async () => {
      return await this.client!.expire(this.prefixKey(key), seconds);
    });
    return result || false;
  }

  // ============================================================
  // 原子操作
  // ============================================================

  async incr(key: string): Promise<number> {
    const result = await this.executeWithRetry<number>("incr", async () => {
      return await this.client!.incr(this.prefixKey(key));
    });
    return result || 0;
  }

  /**
   * 获取原始客户端 (用于高级操作)
   */
  getRawClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * 获取分布式锁
   * 使用 Redis SET NX PX 命令实现原子性的锁获取
   *
   * @param key - 锁的键名
   * @param ttlMs - 锁的存活时间 (毫秒)
   * @param retries - 重试次数，默认 20
   * @param delayMs - 重试间隔 (毫秒)，默认 50
   * @returns 成功返回锁的唯一标识符 (用于释放锁)，失败返回 null
   *
   * @example
   * ```typescript
   * const lockToken = await client.acquireLock('my-lock', 5000);
   * if (lockToken) {
   *   try {
   *     // 临界区代码
   *   } finally {
   *     await client.releaseLock('my-lock', lockToken);
   *   }
   * }
   * ```
   */
  async acquireLock(
    key: string,
    ttlMs: number,
    retries: number = 20,
    delayMs: number = 50
  ): Promise<string | null> {
    if (!this.isReady()) return null;
    const raw = this.getRawClient();
    if (!raw) return null;

    const fullKey = this.prefixKey(key);

    for (let attempt = 0; attempt <= retries; attempt++) {
      const token = randomBytes(16).toString("hex");

      const result = await this.executeWithRetry<string | null>(
        "acquireLock",
        async () => {
          return await raw.set(fullKey, token, { NX: true, PX: ttlMs });
        },
        1,
        0
      ); // 单次尝试，不重试

      if (result === "OK") {
        return token;
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return null;
  }

  /**
   * 释放分布式锁
   * 使用 Lua 脚本确保原子性：只有持有锁的客户端才能释放
   *
   * @param key - 锁的键名
   * @param token - 获取锁时返回的唯一标识符
   * @returns 成功返回 true，锁不存在或 token 不匹配返回 false
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    const result = await this.executeWithRetry<number>("releaseLock", async () => {
      const raw = this.getRawClient();
      if (!raw) throw new Error("Raw client not available");

      const fullKey = this.prefixKey(key);
      const script =
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

      const result = await raw.eval(script, { keys: [fullKey], arguments: [token] });
      return Number(result);
    });
    return result === 1;
  }

  /**
   * 延长分布式锁的存活时间
   * 使用 Lua 脚本确保原子性：只有持有锁的客户端才能延长
   *
   * @param key - 锁的键名
   * @param token - 获取锁时返回的唯一标识符
   * @param ttlMs - 新的存活时间 (毫秒)
   * @returns 成功返回 true，锁不存在或 token 不匹配返回 false
   */
  async refreshLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.trunc(ttlMs) : 0;
    if (!ttl) return false;

    const result = await this.executeWithRetry<number>("refreshLock", async () => {
      const raw = this.getRawClient();
      if (!raw) throw new Error("Raw client not available");

      const fullKey = this.prefixKey(key);
      const script =
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end';

      const result = await raw.eval(script, {
        keys: [fullKey],
        arguments: [token, String(ttl)],
      });
      return Number(result);
    });
    return result === 1;
  }
}

// ============================================================
// 单例实例管理
// ============================================================

let redisInstance: RedisClient | null = null;

/**
 * 获取 Redis 客户端单例
 * 如果实例不存在则创建新实例，支持从环境变量读取配置
 *
 * @returns RedisClient 单例
 *
 * @example
 * ```typescript
 * import { getRedisClient } from './redis/client.js';
 *
 * const client = getRedisClient();
 * await client.connect();
 * ```
 */

export function getRedisClient(): RedisClient {
  if (!redisInstance) {
    const config: RedisConfig = {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || "0", 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || "foresight:",
    };
    redisInstance = new RedisClient(config);
  }
  return redisInstance;
}

/**
 * 初始化 Redis 连接
 * 连接到 Redis 服务器并初始化监控指标
 *
 * @returns 连接成功返回 true，失败返回 false
 *
 * @example
 * ```typescript
 * import { initRedis } from './redis/client.js';
 *
 * const connected = await initRedis();
 * if (connected) {
 *   console.log('Redis 连接成功');
 * }
 * ```
 */
export async function initRedis(): Promise<boolean> {
  const client = getRedisClient();
  return client.connect();
}

/**
 * 关闭 Redis 连接
 * 断开与 Redis 服务器的连接并清理资源
 *
 * @example
 * ```typescript
 * import { closeRedis } from './redis/client.js';
 *
 * // 程序退出前调用
 * process.on('SIGINT', async () => {
 *   await closeRedis();
 *   process.exit(0);
 * });
 * ```
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.disconnect();
    redisInstance = null;
  }
}

export { RedisClient };
