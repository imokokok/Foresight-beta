/**
 * 熔断器实现
 * 防止级联故障，实现快速失败和自动恢复
 */

import { EventEmitter } from "events";
import { logger } from "../monitoring/logger.js";
import { Counter, Gauge, Histogram } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";

// ============================================================
// 指标定义
// ============================================================

const circuitBreakerState = new Gauge({
  name: "foresight_circuit_breaker_state",
  help: "Circuit breaker state (0=closed, 1=open, 2=half-open)",
  labelNames: ["name"] as const,
  registers: [metricsRegistry],
});

const circuitBreakerCallsTotal = new Counter({
  name: "foresight_circuit_breaker_calls_total",
  help: "Total circuit breaker calls",
  labelNames: ["name", "result"] as const, // success, failure, rejected
  registers: [metricsRegistry],
});

const circuitBreakerLatency = new Histogram({
  name: "foresight_circuit_breaker_latency_ms",
  help: "Circuit breaker call latency",
  labelNames: ["name"] as const,
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

export enum CircuitState {
  CLOSED = 0, // 正常状态，允许请求
  OPEN = 1, // 熔断状态，拒绝请求
  HALF_OPEN = 2, // 半开状态，允许部分请求探测
}

export interface CircuitBreakerConfig {
  /** 熔断器名称 */
  name: string;
  /** 失败阈值 (连续失败次数) */
  failureThreshold: number;
  /** 成功阈值 (半开状态需要连续成功次数) */
  successThreshold: number;
  /** 熔断持续时间 (毫秒) */
  openDuration: number;
  /** 超时时间 (毫秒) */
  timeout: number;
  /** 监控窗口大小 (毫秒) */
  windowSize: number;
  /** 错误率阈值 (0-1) */
  errorRateThreshold: number;
  /** 最小请求数 (达到后才计算错误率) */
  minRequests: number;
  /** 降级回调 */
  fallback?: (error: Error) => unknown;
}

interface CallResult {
  success: boolean;
  timestamp: number;
  duration: number;
  error?: Error;
}

// ============================================================
// 熔断器实现
// ============================================================

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastStateChange: number = Date.now();
  private results: CallResult[] = [];
  private config: CircuitBreakerConfig;
  private halfOpenAttempts: number = 0;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    super();

    this.config = {
      name: config.name,
      failureThreshold: config.failureThreshold ?? 10,
      successThreshold: config.successThreshold ?? 5,
      openDuration: config.openDuration ?? 30000,
      timeout: config.timeout ?? 10000,
      windowSize: config.windowSize ?? 60000,
      errorRateThreshold: config.errorRateThreshold ?? 0.5,
      minRequests: config.minRequests ?? 20,
      fallback: config.fallback,
    };

    this.updateMetrics();
    logger.info("CircuitBreaker initialized", { name: this.config.name });
  }

  /**
   * 执行受保护的操作
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 检查是否应该允许请求
    if (!this.shouldAllowRequest()) {
      circuitBreakerCallsTotal.inc({ name: this.config.name, result: "rejected" });

      const error = new Error(`Circuit breaker ${this.config.name} is OPEN`);

      if (this.config.fallback) {
        return this.config.fallback(error) as T;
      }

      throw error;
    }

    const start = Date.now();

    try {
      // 添加超时
      const result = await this.withTimeout(fn(), this.config.timeout);

      this.recordSuccess(Date.now() - start);
      circuitBreakerCallsTotal.inc({ name: this.config.name, result: "success" });
      circuitBreakerLatency.observe({ name: this.config.name }, Date.now() - start);

      return result;
    } catch (error: any) {
      this.recordFailure(error, Date.now() - start);
      circuitBreakerCallsTotal.inc({ name: this.config.name, result: "failure" });
      circuitBreakerLatency.observe({ name: this.config.name }, Date.now() - start);

      if (this.config.fallback) {
        return this.config.fallback(error as Error) as T;
      }

      throw error;
    }
  }

  /**
   * 添加超时
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 检查是否应该允许请求
   */
  private shouldAllowRequest(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // 检查是否应该转换到半开状态
        if (now - this.lastStateChange >= this.config.openDuration) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // 半开状态只允许有限的请求
        if (this.halfOpenAttempts < this.config.successThreshold) {
          this.halfOpenAttempts++;
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  /**
   * 记录成功
   */
  private recordSuccess(duration: number): void {
    this.results.push({
      success: true,
      timestamp: Date.now(),
      duration,
    });
    if (this.results.length > this.config.minRequests * 2) {
      this.cleanupResults();
    }

    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount = 0;
        break;

      case CircuitState.HALF_OPEN:
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo(CircuitState.CLOSED);
        }
        break;
    }
  }

  /**
   * 记录失败
   */
  private recordFailure(error: Error, duration: number): void {
    this.results.push({
      success: false,
      timestamp: Date.now(),
      duration,
      error,
    });
    if (this.results.length > this.config.minRequests * 2) {
      this.cleanupResults();
    }

    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount++;

        if (this.shouldTrip()) {
          this.transitionTo(CircuitState.OPEN);
        }
        break;

      case CircuitState.HALF_OPEN:
        this.transitionTo(CircuitState.OPEN);
        break;
    }
  }

  /**
   * 检查是否应该熔断
   */
  private shouldTrip(): boolean {
    // 连续失败达到阈值
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // 错误率达到阈值
    const recentResults = this.getRecentResults();
    if (recentResults.length >= this.config.minRequests) {
      const failures = recentResults.filter((r) => !r.success).length;
      const errorRate = failures / recentResults.length;
      if (errorRate >= this.config.errorRateThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取最近的结果
   */
  private getRecentResults(): CallResult[] {
    const cutoff = Date.now() - this.config.windowSize;
    return this.results.filter((r) => r.timestamp > cutoff);
  }

  /**
   * 清理过期结果
   */
  private cleanupResults(): void {
    const cutoff = Date.now() - this.config.windowSize;
    this.results = this.results.filter((r) => r.timestamp > cutoff);
  }

  /**
   * 状态转换
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    // 重置计数器
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    }

    this.updateMetrics();

    logger.info("CircuitBreaker state changed", {
      name: this.config.name,
      from: CircuitState[oldState],
      to: CircuitState[newState],
    });

    this.emit("stateChange", { from: oldState, to: newState });
  }

  /**
   * 更新指标
   */
  private updateMetrics(): void {
    circuitBreakerState.set({ name: this.config.name }, this.state);
  }

  /**
   * 手动打开熔断器
   */
  trip(): void {
    if (this.state !== CircuitState.OPEN) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * 手动重置熔断器
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * 获取状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    state: string;
    failureCount: number;
    successCount: number;
    recentCalls: number;
    recentFailures: number;
    errorRate: number;
  } {
    const recentResults = this.getRecentResults();
    const recentFailures = recentResults.filter((r) => !r.success).length;

    return {
      state: CircuitState[this.state],
      failureCount: this.failureCount,
      successCount: this.successCount,
      recentCalls: recentResults.length,
      recentFailures,
      errorRate: recentResults.length > 0 ? recentFailures / recentResults.length : 0,
    };
  }
}

// ============================================================
// 熔断器管理器
// ============================================================

class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * 获取或创建熔断器
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker({ name, ...config });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  /**
   * 获取所有熔断器状态
   */
  getAllStats(): Record<string, ReturnType<CircuitBreaker["getStats"]>> {
    const stats: Record<string, ReturnType<CircuitBreaker["getStats"]>> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// ============================================================
// 便捷函数
// ============================================================

/**
 * 使用熔断器包装函数
 */
export function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = circuitBreakerRegistry.get(name, config);
  return breaker.execute(fn);
}

/**
 * 创建熔断器装饰器
 */
export function circuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const breaker = circuitBreakerRegistry.get(name, config);

    descriptor.value = async function (...args: any[]) {
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
