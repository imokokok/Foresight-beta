/**
 * 余额检查器
 * 检查用户链上余额与系统记录是否一致
 */

import { ethers, Contract, JsonRpcProvider } from "ethers";
import { logger } from "../monitoring/logger.js";
import { Counter, Gauge } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";
import { getDatabasePool } from "../database/connectionPool.js";

// ============================================================
// 指标定义
// ============================================================

const balanceChecksTotal = new Counter({
  name: "foresight_balance_checks_total",
  help: "Total balance checks performed",
  labelNames: ["status", "token"] as const,
  registers: [metricsRegistry],
});

const balanceMismatchesTotal = new Counter({
  name: "foresight_balance_mismatches_total",
  help: "Total balance mismatches found",
  labelNames: ["token", "severity"] as const,
  registers: [metricsRegistry],
});

const systemTotalBalance = new Gauge({
  name: "foresight_system_total_balance",
  help: "Total balance in the system",
  labelNames: ["token", "type"] as const, // type: onchain, offchain
  registers: [metricsRegistry],
});

// ============================================================
// 合约 ABI
// ============================================================

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const ERC1155_ABI = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
];

// ============================================================
// 类型定义
// ============================================================

export interface BalanceCheckConfig {
  rpcUrl: string;
  usdcAddress: string;
  marketAddress: string;
  chainId: number;
  /** 检查间隔 (毫秒) */
  intervalMs: number;
  /** 差异容忍度 (wei) */
  tolerance: bigint;
  /** 每批检查的用户数 */
  batchSize: number;
}

export interface BalanceCheckResult {
  userAddress: string;
  token: string;
  outcomeIndex?: number;
  onchainBalance: bigint;
  offchainBalance: bigint;
  difference: bigint;
  isMatch: boolean;
  checkedAt: number;
}

export interface BalanceReport {
  checkId: string;
  startTime: number;
  endTime: number;
  usersChecked: number;
  results: BalanceCheckResult[];
  mismatches: BalanceCheckResult[];
  summary: {
    totalOnchain: bigint;
    totalOffchain: bigint;
    totalDifference: bigint;
    mismatchCount: number;
  };
}

// ============================================================
// 余额检查器
// ============================================================

export class BalanceChecker {
  private provider: JsonRpcProvider;
  private usdcContract: Contract;
  private marketContract: Contract;
  private config: BalanceCheckConfig;
  private isRunning: boolean = false;
  private checkTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<BalanceCheckConfig> = {}) {
    this.config = {
      rpcUrl: config.rpcUrl || process.env.RPC_URL || "",
      usdcAddress: config.usdcAddress || process.env.USDC_ADDRESS || "",
      marketAddress: config.marketAddress || process.env.MARKET_ADDRESS || "",
      chainId: config.chainId || parseInt(process.env.CHAIN_ID || "80002", 10),
      intervalMs: config.intervalMs || 3600000, // 1 小时
      tolerance: config.tolerance || BigInt(1e6), // 1 USDC
      batchSize: config.batchSize || 100,
    };

    this.provider = new JsonRpcProvider(this.config.rpcUrl);
    this.usdcContract = new Contract(this.config.usdcAddress, ERC20_ABI, this.provider);
    this.marketContract = new Contract(this.config.marketAddress, ERC1155_ABI, this.provider);
  }

  /**
   * 启动余额检查
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("BalanceChecker already running");
      return;
    }

    logger.info("Starting BalanceChecker", {
      usdcAddress: this.config.usdcAddress,
      marketAddress: this.config.marketAddress,
      intervalMs: this.config.intervalMs,
    });

    // 立即运行一次
    await this.runCheck();

    // 启动定时任务
    this.checkTimer = setInterval(async () => {
      await this.runCheck();
    }, this.config.intervalMs);

    this.isRunning = true;
  }

  /**
   * 停止余额检查
   */
  async stop(): Promise<void> {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.isRunning = false;
    logger.info("BalanceChecker stopped");
  }

  /**
   * 运行余额检查
   */
  async runCheck(): Promise<BalanceReport> {
    const checkId = `balance-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    logger.info("Starting balance check", { checkId });

    const report: BalanceReport = {
      checkId,
      startTime,
      endTime: 0,
      usersChecked: 0,
      results: [],
      mismatches: [],
      summary: {
        totalOnchain: 0n,
        totalOffchain: 0n,
        totalDifference: 0n,
        mismatchCount: 0,
      },
    };

    try {
      // 获取所有有余额的用户
      const users = await this.getActiveUsers();
      
      // 分批检查
      for (let i = 0; i < users.length; i += this.config.batchSize) {
        const batch = users.slice(i, i + this.config.batchSize);
        const batchResults = await this.checkBatch(batch);
        
        report.results.push(...batchResults);
        report.usersChecked += batch.length;
      }

      // 统计
      for (const result of report.results) {
        report.summary.totalOnchain += result.onchainBalance;
        report.summary.totalOffchain += result.offchainBalance;
        
        if (!result.isMatch) {
          report.mismatches.push(result);
          report.summary.mismatchCount++;
          report.summary.totalDifference += result.difference;
          
          balanceMismatchesTotal.inc({ 
            token: result.token, 
            severity: result.difference > BigInt(100e6) ? "high" : "low" 
          });
        }
      }

      // 更新系统总余额指标
      systemTotalBalance.set({ token: "USDC", type: "onchain" }, 
        Number(report.summary.totalOnchain) / 1e6);
      systemTotalBalance.set({ token: "USDC", type: "offchain" }, 
        Number(report.summary.totalOffchain) / 1e6);

      report.endTime = Date.now();

      logger.info("Balance check completed", {
        checkId,
        usersChecked: report.usersChecked,
        mismatchCount: report.summary.mismatchCount,
        durationMs: report.endTime - startTime,
      });

      return report;
    } catch (error: any) {
      logger.error("Balance check failed", { checkId }, error);
      report.endTime = Date.now();
      throw error;
    }
  }

  /**
   * 获取活跃用户列表
   */
  private async getActiveUsers(): Promise<string[]> {
    const pool = getDatabasePool();
    const client = pool.getReadClient();
    
    if (!client) {
      logger.warn("Database not available for balance check");
      return [];
    }

    try {
      // 获取有交易记录的用户
      const { data, error } = await client
        .from("user_balances")
        .select("user_address")
        .gt("balance", 0);

      if (error) {
        throw error;
      }

      return (data || []).map(d => d.user_address);
    } catch (error: any) {
      logger.error("Failed to get active users", {}, error);
      return [];
    }
  }

  /**
   * 批量检查用户余额
   */
  private async checkBatch(users: string[]): Promise<BalanceCheckResult[]> {
    const results: BalanceCheckResult[] = [];

    // 获取链上 USDC 余额
    const onchainBalances = await Promise.all(
      users.map(async (user) => {
        try {
          const balance = await this.usdcContract.balanceOf(user);
          return { user, balance: BigInt(balance) };
        } catch {
          return { user, balance: 0n };
        }
      })
    );

    // 获取链下余额
    const offchainBalances = await this.getOffchainBalances(users);

    // 对比
    for (const { user, balance: onchainBalance } of onchainBalances) {
      const offchainBalance = offchainBalances.get(user) || 0n;
      const difference = onchainBalance > offchainBalance 
        ? onchainBalance - offchainBalance 
        : offchainBalance - onchainBalance;
      const isMatch = difference <= this.config.tolerance;

      results.push({
        userAddress: user,
        token: "USDC",
        onchainBalance,
        offchainBalance,
        difference,
        isMatch,
        checkedAt: Date.now(),
      });

      balanceChecksTotal.inc({ 
        status: isMatch ? "match" : "mismatch", 
        token: "USDC" 
      });
    }

    return results;
  }

  /**
   * 获取链下余额
   */
  private async getOffchainBalances(users: string[]): Promise<Map<string, bigint>> {
    const pool = getDatabasePool();
    const client = pool.getReadClient();
    const balances = new Map<string, bigint>();
    
    if (!client) {
      return balances;
    }

    try {
      const { data, error } = await client
        .from("user_balances")
        .select("user_address, balance")
        .in("user_address", users);

      if (error) {
        throw error;
      }

      for (const row of data || []) {
        // 假设 balance 是以 USDC 为单位 (6 位小数)
        balances.set(row.user_address, BigInt(Math.floor(row.balance * 1e6)));
      }
    } catch (error: any) {
      logger.error("Failed to get offchain balances", {}, error);
    }

    return balances;
  }

  /**
   * 检查单个用户余额
   */
  async checkUser(userAddress: string): Promise<BalanceCheckResult[]> {
    const results: BalanceCheckResult[] = [];

    try {
      // USDC 余额
      const usdcOnchain = BigInt(await this.usdcContract.balanceOf(userAddress));
      const offchainBalances = await this.getOffchainBalances([userAddress]);
      const usdcOffchain = offchainBalances.get(userAddress) || 0n;
      
      const usdcDiff = usdcOnchain > usdcOffchain 
        ? usdcOnchain - usdcOffchain 
        : usdcOffchain - usdcOnchain;

      results.push({
        userAddress,
        token: "USDC",
        onchainBalance: usdcOnchain,
        offchainBalance: usdcOffchain,
        difference: usdcDiff,
        isMatch: usdcDiff <= this.config.tolerance,
        checkedAt: Date.now(),
      });

      // TODO: 检查 ERC1155 outcome token 余额

    } catch (error: any) {
      logger.error("Failed to check user balance", { userAddress }, error);
    }

    return results;
  }

  /**
   * 检查合约总锁仓量
   */
  async checkTotalValueLocked(): Promise<{
    totalUsdcLocked: bigint;
    totalPositions: bigint;
    timestamp: number;
  }> {
    try {
      // 获取市场合约的 USDC 余额
      const totalUsdcLocked = BigInt(
        await this.usdcContract.balanceOf(this.config.marketAddress)
      );

      // TODO: 计算所有持仓总量

      const result = {
        totalUsdcLocked,
        totalPositions: 0n,
        timestamp: Date.now(),
      };

      logger.info("TVL checked", {
        totalUsdcLocked: ethers.formatUnits(totalUsdcLocked, 6),
      });

      return result;
    } catch (error: any) {
      logger.error("Failed to check TVL", {}, error);
      throw error;
    }
  }

  /**
   * 获取检查状态
   */
  getStatus(): {
    isRunning: boolean;
    config: BalanceCheckConfig;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }
}

// ============================================================
// 单例
// ============================================================

let checkerInstance: BalanceChecker | null = null;

export function getBalanceChecker(config?: Partial<BalanceCheckConfig>): BalanceChecker {
  if (!checkerInstance) {
    checkerInstance = new BalanceChecker(config);
  }
  return checkerInstance;
}

export async function initBalanceChecker(config?: Partial<BalanceCheckConfig>): Promise<BalanceChecker> {
  const checker = getBalanceChecker(config);
  await checker.start();
  return checker;
}

export async function closeBalanceChecker(): Promise<void> {
  if (checkerInstance) {
    await checkerInstance.stop();
    checkerInstance = null;
  }
}

