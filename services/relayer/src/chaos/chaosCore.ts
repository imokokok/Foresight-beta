/**
 * 混沌工程核心库
 * 提供基本的混沌注入功能
 */

/**
 * 混沌场景类型
 */
export type ChaosScenario = "latency" | "error" | "cpuSpike" | "memoryLeak";

/**
 * 混沌配置选项
 */
export interface ChaosConfig {
  enabled: boolean;
  probability: number; // 触发混沌的概率 (0-1)
  scenarios: {
    latency?: {
      enabled: boolean;
      minDelay: number; // 最小延迟 (ms)
      maxDelay: number; // 最大延迟 (ms)
    };
    error?: {
      enabled: boolean;
      errorTypes: Array<{
        type: string;
        message: string;
        probability: number;
      }>;
    };
    cpuSpike?: {
      enabled: boolean;
      duration: number; // CPU 峰值持续时间 (ms)
      intensity: number; // CPU 峰值强度 (0-1)
    };
    memoryLeak?: {
      enabled: boolean;
      leakRate: number; // 内存泄漏速率 (bytes per operation)
    };
  };
}

/**
 * 混沌实例
 */
export class Chaos {
  private config: ChaosConfig;
  private memoryLeaks: Buffer[] = [];

  constructor(config: ChaosConfig) {
    this.config = config;
  }

  /**
   * 随机决定是否触发混沌
   */
  private shouldTrigger(): boolean {
    return this.config.enabled && Math.random() < this.config.probability;
  }

  /**
   * 触发延迟混沌
   */
  private async triggerLatency(): Promise<void> {
    const { latency } = this.config.scenarios;
    if (!latency?.enabled) return;

    const delay = Math.random() * (latency.maxDelay - latency.minDelay) + latency.minDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * 触发错误混沌
   */
  private triggerError(): void {
    const { error } = this.config.scenarios;
    if (!error?.enabled || error.errorTypes.length === 0) return;

    // 根据概率选择错误类型
    const random = Math.random();
    let cumulativeProbability = 0;

    for (const errorType of error.errorTypes) {
      cumulativeProbability += errorType.probability;
      if (random < cumulativeProbability) {
        throw new Error(`${errorType.type}: ${errorType.message}`);
      }
    }
  }

  /**
   * 触发CPU峰值混沌
   */
  private async triggerCpuSpike(): Promise<void> {
    const { cpuSpike } = this.config.scenarios;
    if (!cpuSpike?.enabled) return;

    const startTime = Date.now();
    while (Date.now() - startTime < cpuSpike.duration) {
      // 执行一些CPU密集型操作
      Math.sqrt(Math.random());
    }
  }

  /**
   * 触发内存泄漏混沌
   */
  private triggerMemoryLeak(): void {
    const { memoryLeak } = this.config.scenarios;
    if (!memoryLeak?.enabled) return;

    // 分配一些内存并保留引用
    const leakBuffer = Buffer.alloc(memoryLeak.leakRate);
    this.memoryLeaks.push(leakBuffer);
  }

  /**
   * 注入混沌到函数调用
   */
  public async inject<T>(fn: () => Promise<T> | T, scenarios?: ChaosScenario[]): Promise<T> {
    if (!this.shouldTrigger()) {
      return typeof fn === "function" ? await fn() : fn;
    }

    // 应用指定的混沌场景
    const selectedScenarios = scenarios || ["latency", "error", "cpuSpike", "memoryLeak"];

    // 随机排序场景，以不同顺序应用
    const shuffledScenarios = [...selectedScenarios].sort(() => Math.random() - 0.5);

    // 应用混沌场景
    for (const scenario of shuffledScenarios) {
      switch (scenario) {
        case "latency":
          await this.triggerLatency();
          break;
        case "error":
          this.triggerError();
          break;
        case "cpuSpike":
          await this.triggerCpuSpike();
          break;
        case "memoryLeak":
          this.triggerMemoryLeak();
          break;
      }
    }

    // 执行原始函数
    return typeof fn === "function" ? await fn() : fn;
  }

  /**
   * 为对象方法添加混沌注入
   */
  public addChaosToMethod<T>(obj: T, methodName: keyof T, scenarios?: ChaosScenario[]): void {
    const originalMethod = obj[methodName];
    if (typeof originalMethod !== "function") {
      throw new Error(`Method ${String(methodName)} is not a function`);
    }

    // 替换为带有混沌注入的方法
    (obj as any)[methodName] = async (...args: any[]) => {
      return this.inject(() => (originalMethod as Function).apply(obj, args), scenarios);
    };
  }

  /**
   * 关闭混沌实例，释放资源
   */
  public close(): void {
    // 释放内存泄漏
    this.memoryLeaks = [];
  }
}

/**
 * 创建混沌实例
 */
export function createChaos(config: ChaosConfig): Chaos {
  return new Chaos(config);
}
