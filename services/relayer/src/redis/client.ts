/**
 * Redis 客户端
 * 用于订单簿快照持久化和状态同步
 */

import { createClient, RedisClientType } from "redis";
import { randomBytes } from "node:crypto";
import { redisLogger as logger } from "../monitoring/logger.js";
import {
  redisOperationsTotal,
  redisOperationLatency,
  redisConnectionStatus,
} from "../monitoring/metrics.js";

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
};

class RedisClient {
  private client: RedisClientType | null = null;
  private config: RedisConfig;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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
   * 获取带前缀的 key
   */
  private prefixKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  getPrefixedKey(key: string): string {
    return this.prefixKey(key);
  }

  // ============================================================
  // 基础操作
  // ============================================================

  async get(key: string): Promise<string | null> {
    if (!this.isReady()) return null;

    const start = Date.now();
    try {
      const result = await this.client!.get(this.prefixKey(key));
      redisOperationsTotal.inc({ operation: "get", status: "success" });
      redisOperationLatency.observe({ operation: "get" }, Date.now() - start);
      return result;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "get", status: "error" });
      redisOperationLatency.observe({ operation: "get" }, Date.now() - start);
      logger.error("Redis GET failed", { key }, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isReady()) return false;

    const start = Date.now();
    try {
      if (ttlSeconds) {
        await this.client!.setEx(this.prefixKey(key), ttlSeconds, value);
      } else {
        await this.client!.set(this.prefixKey(key), value);
      }
      redisOperationsTotal.inc({ operation: "set", status: "success" });
      redisOperationLatency.observe({ operation: "set" }, Date.now() - start);
      return true;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "set", status: "error" });
      redisOperationLatency.observe({ operation: "set" }, Date.now() - start);
      logger.error("Redis SET failed", { key }, error);
      return false;
    }
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isReady()) return false;

    const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.trunc(ttlSeconds) : 0;
    if (!ttl) return false;

    const start = Date.now();
    try {
      const result = await this.client!.set(this.prefixKey(key), value, { NX: true, EX: ttl });
      const ok = result === "OK";
      redisOperationsTotal.inc({ operation: "setnx", status: ok ? "success" : "error" });
      redisOperationLatency.observe({ operation: "setnx" }, Date.now() - start);
      return ok;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "setnx", status: "error" });
      redisOperationLatency.observe({ operation: "setnx" }, Date.now() - start);
      logger.error("Redis SETNX failed", { key }, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isReady()) return false;

    const start = Date.now();
    try {
      await this.client!.del(this.prefixKey(key));
      redisOperationsTotal.inc({ operation: "del", status: "success" });
      redisOperationLatency.observe({ operation: "del" }, Date.now() - start);
      return true;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "del", status: "error" });
      redisOperationLatency.observe({ operation: "del" }, Date.now() - start);
      logger.error("Redis DEL failed", { key }, error);
      return false;
    }
  }

  // ============================================================
  // Hash 操作 (用于订单簿)
  // ============================================================

  async hGet(key: string, field: string): Promise<string | null> {
    if (!this.isReady()) return null;

    const start = Date.now();
    try {
      const result = await this.client!.hGet(this.prefixKey(key), field);
      redisOperationsTotal.inc({ operation: "hget", status: "success" });
      redisOperationLatency.observe({ operation: "hget" }, Date.now() - start);
      return result ?? null;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "hget", status: "error" });
      redisOperationLatency.observe({ operation: "hget" }, Date.now() - start);
      logger.error("Redis HGET failed", { key, field }, error);
      return null;
    }
  }

  async hSet(key: string, field: string, value: string): Promise<boolean> {
    if (!this.isReady()) return false;

    const start = Date.now();
    try {
      await this.client!.hSet(this.prefixKey(key), field, value);
      redisOperationsTotal.inc({ operation: "hset", status: "success" });
      redisOperationLatency.observe({ operation: "hset" }, Date.now() - start);
      return true;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "hset", status: "error" });
      redisOperationLatency.observe({ operation: "hset" }, Date.now() - start);
      logger.error("Redis HSET failed", { key, field }, error);
      return false;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string> | null> {
    if (!this.isReady()) return null;

    const start = Date.now();
    try {
      const result = await this.client!.hGetAll(this.prefixKey(key));
      redisOperationsTotal.inc({ operation: "hgetall", status: "success" });
      redisOperationLatency.observe({ operation: "hgetall" }, Date.now() - start);
      return result;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "hgetall", status: "error" });
      redisOperationLatency.observe({ operation: "hgetall" }, Date.now() - start);
      logger.error("Redis HGETALL failed", { key }, error);
      return null;
    }
  }

  async hSetMultiple(key: string, fields: Record<string, string>): Promise<boolean> {
    if (!this.isReady()) return false;

    const start = Date.now();
    try {
      await this.client!.hSet(this.prefixKey(key), fields);
      redisOperationsTotal.inc({ operation: "hset_multi", status: "success" });
      redisOperationLatency.observe({ operation: "hset_multi" }, Date.now() - start);
      return true;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "hset_multi", status: "error" });
      redisOperationLatency.observe({ operation: "hset_multi" }, Date.now() - start);
      logger.error("Redis HSET multi failed", { key }, error);
      return false;
    }
  }

  async hDel(key: string, ...fields: string[]): Promise<boolean> {
    if (!this.isReady()) return false;

    const start = Date.now();
    try {
      await this.client!.hDel(this.prefixKey(key), fields);
      redisOperationsTotal.inc({ operation: "hdel", status: "success" });
      redisOperationLatency.observe({ operation: "hdel" }, Date.now() - start);
      return true;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "hdel", status: "error" });
      redisOperationLatency.observe({ operation: "hdel" }, Date.now() - start);
      logger.error("Redis HDEL failed", { key, fields }, error);
      return false;
    }
  }

  // ============================================================
  // List 操作 (用于事件队列)
  // ============================================================

  async lPush(key: string, ...values: string[]): Promise<number> {
    if (!this.isReady()) return 0;

    const start = Date.now();
    try {
      const result = await this.client!.lPush(this.prefixKey(key), values);
      redisOperationsTotal.inc({ operation: "lpush", status: "success" });
      redisOperationLatency.observe({ operation: "lpush" }, Date.now() - start);
      return result;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "lpush", status: "error" });
      redisOperationLatency.observe({ operation: "lpush" }, Date.now() - start);
      logger.error("Redis LPUSH failed", { key }, error);
      return 0;
    }
  }

  async rPop(key: string): Promise<string | null> {
    if (!this.isReady()) return null;

    const start = Date.now();
    try {
      const result = await this.client!.rPop(this.prefixKey(key));
      redisOperationsTotal.inc({ operation: "rpop", status: "success" });
      redisOperationLatency.observe({ operation: "rpop" }, Date.now() - start);
      return result;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "rpop", status: "error" });
      redisOperationLatency.observe({ operation: "rpop" }, Date.now() - start);
      logger.error("Redis RPOP failed", { key }, error);
      return null;
    }
  }

  // ============================================================
  // 过期时间操作
  // ============================================================

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isReady()) return false;

    try {
      await this.client!.expire(this.prefixKey(key), seconds);
      return true;
    } catch (error: any) {
      logger.error("Redis EXPIRE failed", { key, seconds }, error);
      return false;
    }
  }

  // ============================================================
  // 原子操作
  // ============================================================

  async incr(key: string): Promise<number> {
    if (!this.isReady()) return 0;

    const start = Date.now();
    try {
      const result = await this.client!.incr(this.prefixKey(key));
      redisOperationsTotal.inc({ operation: "incr", status: "success" });
      redisOperationLatency.observe({ operation: "incr" }, Date.now() - start);
      return result;
    } catch (error: any) {
      redisOperationsTotal.inc({ operation: "incr", status: "error" });
      redisOperationLatency.observe({ operation: "incr" }, Date.now() - start);
      logger.error("Redis INCR failed", { key }, error);
      return 0;
    }
  }

  /**
   * 获取原始客户端 (用于高级操作)
   */
  getRawClient(): RedisClientType | null {
    return this.client;
  }

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
      try {
        const result = await raw.set(fullKey, token, { NX: true, PX: ttlMs });
        if (result === "OK") {
          return token;
        }
      } catch (error: any) {
        logger.error("Redis acquireLock failed", { key }, error);
        return null;
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return null;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    if (!this.isReady()) return false;
    const raw = this.getRawClient();
    if (!raw) return false;

    const fullKey = this.prefixKey(key);
    const script =
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

    try {
      const result = await raw.eval(script, { keys: [fullKey], arguments: [token] });
      return Number(result) === 1;
    } catch (error: any) {
      logger.error("Redis releaseLock failed", { key }, error);
      return false;
    }
  }

  async refreshLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    if (!this.isReady()) return false;
    const raw = this.getRawClient();
    if (!raw) return false;
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.trunc(ttlMs) : 0;
    if (!ttl) return false;

    const fullKey = this.prefixKey(key);
    const script =
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end';

    try {
      const result = await raw.eval(script, {
        keys: [fullKey],
        arguments: [token, String(ttl)],
      });
      return Number(result) === 1;
    } catch (error: any) {
      logger.error("Redis refreshLock failed", { key }, error);
      return false;
    }
  }
}

// ============================================================
// 单例实例
// ============================================================

let redisInstance: RedisClient | null = null;

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

export async function initRedis(): Promise<boolean> {
  const client = getRedisClient();
  return client.connect();
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.disconnect();
    redisInstance = null;
  }
}

export { RedisClient };
