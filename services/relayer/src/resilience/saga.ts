/**
 * Saga 分布式事务模式
 * 实现跨服务的最终一致性
 */

import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import { logger } from "../monitoring/logger.js";
import { Counter, Gauge, Histogram } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";
import { supabaseAdmin } from "../supabase.js";
import { releaseUsdcReservation } from "../matching/riskManagement.js";
import { orderNotionalUsdc } from "../matching/orderManagement.js";

// ============================================================
// 指标定义
// ============================================================

const sagaExecutionsTotal = new Counter({
  name: "foresight_saga_executions_total",
  help: "Total saga executions",
  labelNames: ["saga", "result"] as const, // success, failed, compensated
  registers: [metricsRegistry],
});

const sagaStepsTotal = new Counter({
  name: "foresight_saga_steps_total",
  help: "Total saga steps executed",
  labelNames: ["saga", "step", "result"] as const,
  registers: [metricsRegistry],
});

const sagaDuration = new Histogram({
  name: "foresight_saga_duration_ms",
  help: "Saga execution duration",
  labelNames: ["saga"] as const,
  buckets: [100, 500, 1000, 2500, 5000, 10000, 30000],
  registers: [metricsRegistry],
});

const sagaActiveCount = new Gauge({
  name: "foresight_saga_active",
  help: "Currently active sagas",
  labelNames: ["saga"] as const,
  registers: [metricsRegistry],
});

// ============================================================
// 类型定义
// ============================================================

export interface SagaStep<TContext> {
  name: string;
  execute: (context: TContext) => Promise<void>;
  compensate: (context: TContext) => Promise<void>;
  /** 是否可重试 */
  retryable?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟 (毫秒) */
  retryDelay?: number;
}

export interface SagaConfig {
  name: string;
  /** 最大执行时间 (毫秒) */
  timeout?: number;
  /** 补偿超时 (毫秒) */
  compensationTimeout?: number;
}

export enum SagaStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  COMPENSATING = "compensating",
  COMPENSATED = "compensated",
  COMPENSATION_FAILED = "compensation_failed",
}

export interface SagaExecution<TContext> {
  id: string;
  sagaName: string;
  context: TContext;
  status: SagaStatus;
  currentStep: number;
  completedSteps: string[];
  error?: Error;
  startedAt: number;
  completedAt?: number;
}

// ============================================================
// Saga 定义
// ============================================================

export class SagaDefinition<TContext> {
  private steps: SagaStep<TContext>[] = [];
  private config: SagaConfig;

  constructor(config: SagaConfig) {
    this.config = {
      timeout: 60000,
      compensationTimeout: 30000,
      ...config,
    };
  }

  /**
   * 添加步骤
   */
  addStep(step: SagaStep<TContext>): this {
    this.steps.push({
      retryable: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...step,
    });
    return this;
  }

  /**
   * 获取步骤
   */
  getSteps(): SagaStep<TContext>[] {
    return [...this.steps];
  }

  /**
   * 获取配置
   */
  getConfig(): SagaConfig {
    return this.config;
  }
}

// ============================================================
// Saga 执行器
// ============================================================

export class SagaExecutor<TContext> extends EventEmitter {
  private definition: SagaDefinition<TContext>;
  private activeExecutions: Map<string, SagaExecution<TContext>> = new Map();

  constructor(definition: SagaDefinition<TContext>) {
    super();
    this.definition = definition;
  }

  /**
   * 执行 Saga
   */
  async execute(context: TContext): Promise<SagaExecution<TContext>> {
    const execution: SagaExecution<TContext> = {
      id: this.generateId(),
      sagaName: this.definition.getConfig().name,
      context,
      status: SagaStatus.PENDING,
      currentStep: 0,
      completedSteps: [],
      startedAt: Date.now(),
    };

    this.activeExecutions.set(execution.id, execution);
    sagaActiveCount.inc({ saga: execution.sagaName });

    const config = this.definition.getConfig();
    const steps = this.definition.getSteps();

    logger.info("Saga started", {
      sagaId: execution.id,
      sagaName: execution.sagaName,
      steps: steps.map((s) => s.name),
    });

    try {
      execution.status = SagaStatus.RUNNING;
      this.emit("started", execution);

      // 执行所有步骤
      for (let i = 0; i < steps.length; i++) {
        execution.currentStep = i;
        const step = steps[i];

        await this.executeStep(execution, step);
        execution.completedSteps.push(step.name);

        sagaStepsTotal.inc({
          saga: execution.sagaName,
          step: step.name,
          result: "success",
        });
      }

      // 所有步骤完成
      execution.status = SagaStatus.COMPLETED;
      execution.completedAt = Date.now();

      sagaExecutionsTotal.inc({ saga: execution.sagaName, result: "success" });
      sagaDuration.observe(
        { saga: execution.sagaName },
        execution.completedAt - execution.startedAt
      );

      logger.info("Saga completed successfully", {
        sagaId: execution.id,
        sagaName: execution.sagaName,
        duration: execution.completedAt - execution.startedAt,
      });

      this.emit("completed", execution);
    } catch (error: any) {
      execution.error = error;
      execution.status = SagaStatus.FAILED;

      const failedStep = steps[execution.currentStep];

      sagaStepsTotal.inc({
        saga: execution.sagaName,
        step: failedStep?.name || "unknown",
        result: "failed",
      });

      logger.error("Saga step failed, starting compensation", {
        sagaId: execution.id,
        sagaName: execution.sagaName,
        failedStep: failedStep?.name,
        error: error.message,
      });

      this.emit("failed", execution, error);

      // 执行补偿
      await this.compensate(execution);
    } finally {
      this.activeExecutions.delete(execution.id);
      sagaActiveCount.dec({ saga: execution.sagaName });
    }

    return execution;
  }

  /**
   * 执行单个步骤 (带重试)
   */
  private async executeStep(
    execution: SagaExecution<TContext>,
    step: SagaStep<TContext>
  ): Promise<void> {
    const maxRetries = step.maxRetries || 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug("Executing saga step", {
          sagaId: execution.id,
          step: step.name,
          attempt: attempt + 1,
        });

        await step.execute(execution.context);
        return;
      } catch (error: any) {
        lastError = error;

        if (attempt < maxRetries && step.retryable) {
          const delay = (step.retryDelay || 1000) * Math.pow(2, attempt);
          logger.warn("Saga step failed, retrying", {
            sagaId: execution.id,
            step: step.name,
            attempt: attempt + 1,
            retryIn: delay,
            error: error.message,
          });
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 执行补偿
   */
  private async compensate(execution: SagaExecution<TContext>): Promise<void> {
    execution.status = SagaStatus.COMPENSATING;
    this.emit("compensating", execution);

    const steps = this.definition.getSteps();
    const completedSteps = [...execution.completedSteps].reverse();

    logger.info("Starting compensation", {
      sagaId: execution.id,
      sagaName: execution.sagaName,
      stepsToCompensate: completedSteps,
    });

    let compensationFailed = false;

    for (const stepName of completedSteps) {
      const step = steps.find((s) => s.name === stepName);
      if (!step) continue;

      try {
        logger.debug("Executing compensation step", {
          sagaId: execution.id,
          step: step.name,
        });

        await step.compensate(execution.context);

        sagaStepsTotal.inc({
          saga: execution.sagaName,
          step: `${step.name}_compensate`,
          result: "success",
        });
      } catch (error: any) {
        compensationFailed = true;

        sagaStepsTotal.inc({
          saga: execution.sagaName,
          step: `${step.name}_compensate`,
          result: "failed",
        });

        logger.error("Compensation step failed", {
          sagaId: execution.id,
          step: step.name,
          error: error.message,
        });

        // 继续补偿其他步骤
      }
    }

    if (compensationFailed) {
      execution.status = SagaStatus.COMPENSATION_FAILED;
      sagaExecutionsTotal.inc({ saga: execution.sagaName, result: "compensation_failed" });
      this.emit("compensationFailed", execution);
    } else {
      execution.status = SagaStatus.COMPENSATED;
      execution.completedAt = Date.now();
      sagaExecutionsTotal.inc({ saga: execution.sagaName, result: "compensated" });

      sagaDuration.observe(
        { saga: execution.sagaName },
        execution.completedAt - execution.startedAt
      );

      logger.info("Saga compensation completed", {
        sagaId: execution.id,
        sagaName: execution.sagaName,
      });

      this.emit("compensated", execution);
    }
  }

  /**
   * 生成执行 ID
   */
  private generateId(): string {
    return `saga-${Date.now()}-${randomUUID()}`;
  }

  /**
   * 延时
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取活跃执行
   */
  getActiveExecutions(): SagaExecution<TContext>[] {
    return Array.from(this.activeExecutions.values());
  }
}

// ============================================================
// 预定义 Saga: 订单处理
// ============================================================

export interface OrderSagaContext {
  orderId: string;
  marketKey: string;
  userId: string;
  amount: bigint;
  price: bigint;
  side: "buy" | "sell";
  // 执行过程中填充
  matchResult?: { matchedAmount: bigint; fills: any[] };
  settlementBatchId?: string;
  balanceUpdated?: boolean;
}

export function createOrderSaga(): SagaDefinition<OrderSagaContext> {
  return new SagaDefinition<OrderSagaContext>({ name: "order-processing" })
    .addStep({
      name: "validate-order",
      execute: async (ctx) => {
        if (!ctx.orderId || !ctx.marketKey || !ctx.userId) {
          throw new Error("Invalid order parameters");
        }
        if (ctx.amount <= 0n || ctx.price <= 0n) {
          throw new Error("Invalid amount or price");
        }
        logger.debug("Order validated", { orderId: ctx.orderId });
      },
      compensate: async (ctx) => {
        logger.debug("Validate order compensation (no-op)", { orderId: ctx.orderId });
      },
    })
    .addStep({
      name: "reserve-balance",
      execute: async (ctx) => {
        if (ctx.side === "buy") {
          const reserveMicro = orderNotionalUsdc(ctx.amount, ctx.price);
          if (reserveMicro > 0n && supabaseAdmin) {
            const { data, error } = await supabaseAdmin.rpc("reserve_user_balance", {
              p_user_address: ctx.userId,
              p_amount: (reserveMicro / 1_000_000n).toString(),
            });
            if (error) {
              throw new Error(`Failed to reserve balance: ${error.message}`);
            }
          }
        }
        logger.debug("Balance reserved", { orderId: ctx.orderId, side: ctx.side });
      },
      compensate: async (ctx) => {
        if (ctx.side === "buy") {
          const reserveMicro = orderNotionalUsdc(ctx.amount, ctx.price);
          if (reserveMicro > 0n) {
            await releaseUsdcReservation(ctx.userId, reserveMicro);
          }
        }
        logger.debug("Balance released", { orderId: ctx.orderId });
      },
      retryable: true,
      maxRetries: 3,
      retryDelay: 1000,
    })
    .addStep({
      name: "execute-matching",
      execute: async (ctx) => {
        logger.debug("Matching execution deferred to matchingEngine", {
          orderId: ctx.orderId,
        });
        ctx.matchResult = { matchedAmount: 0n, fills: [] };
      },
      compensate: async (ctx) => {
        if (ctx.matchResult && ctx.matchResult.matchedAmount > 0n) {
          logger.warn("Matching compensation - requires manual intervention", {
            orderId: ctx.orderId,
            matchedAmount: ctx.matchResult.matchedAmount.toString(),
          });
        }
      },
      retryable: false,
    })
    .addStep({
      name: "submit-settlement",
      execute: async (ctx) => {
        ctx.settlementBatchId = `batch-${Date.now()}`;
        logger.debug("Settlement batch created", {
          orderId: ctx.orderId,
          batchId: ctx.settlementBatchId,
        });
      },
      compensate: async (ctx) => {
        if (ctx.settlementBatchId) {
          logger.warn("Settlement compensation - requires manual intervention", {
            orderId: ctx.orderId,
            batchId: ctx.settlementBatchId,
          });
        }
      },
      retryable: true,
      maxRetries: 5,
      retryDelay: 2000,
    })
    .addStep({
      name: "update-balances",
      execute: async (ctx) => {
        ctx.balanceUpdated = true;
        logger.debug("Balances marked for update", { orderId: ctx.orderId });
      },
      compensate: async (ctx) => {
        ctx.balanceUpdated = false;
        logger.debug("Balance update rolled back", { orderId: ctx.orderId });
      },
    });
}

// ============================================================
// 便捷函数
// ============================================================

const sagaRegistry: Map<string, SagaExecutor<any>> = new Map();

export function registerSaga<TContext>(
  name: string,
  definition: SagaDefinition<TContext>
): SagaExecutor<TContext> {
  const executor = new SagaExecutor(definition);
  sagaRegistry.set(name, executor);
  return executor;
}

export function getSagaExecutor<TContext>(name: string): SagaExecutor<TContext> | undefined {
  return sagaRegistry.get(name);
}

export async function executeSaga<TContext>(
  name: string,
  context: TContext
): Promise<SagaExecution<TContext>> {
  const executor = sagaRegistry.get(name);
  if (!executor) {
    throw new Error(`Saga "${name}" not registered`);
  }
  return executor.execute(context);
}
