/**
 * 余额检查器
 * 检查用户链上余额与系统记录是否一致
 */

import { ethers, Contract, JsonRpcProvider } from "ethers";
import { randomUUID } from "crypto";
import { logger } from "../monitoring/logger.js";
import { Counter, Gauge } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";
import { getDatabasePool } from "../database/connectionPool.js";

function pickFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const v of values) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return undefined;
}

function getConfiguredChainId(): number {
  const raw = String(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || "").trim();
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 80002;
}

function getConfiguredRpcUrl(chainId?: number): string {
  const id = chainId ?? getConfiguredChainId();

  const generic = pickFirstNonEmptyString(process.env.RPC_URL, process.env.NEXT_PUBLIC_RPC_URL);
  if (generic) return generic;

  if (id === 80002) {
    return (
      pickFirstNonEmptyString(
        process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY,
        "https://rpc-amoy.polygon.technology/"
      ) || "https://rpc-amoy.polygon.technology/"
    );
  }
  if (id === 137) {
    return (
      pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_POLYGON, "https://polygon-rpc.com") ||
      "https://polygon-rpc.com"
    );
  }
  if (id === 11155111) {
    return (
      pickFirstNonEmptyString(process.env.NEXT_PUBLIC_RPC_SEPOLIA, "https://rpc.sepolia.org") ||
      "https://rpc.sepolia.org"
    );
  }

  return "http://127.0.0.1:8545";
}

function getConfiguredUsdcAddress(): string | undefined {
  return pickFirstNonEmptyString(
    process.env.COLLATERAL_TOKEN_ADDRESS,
    process.env.USDC_ADDRESS,
    process.env.NEXT_PUBLIC_USDC_ADDRESS,
    process.env.NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS
  );
}

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
  autoFix: boolean;
  includeProxyWallets: boolean;
  maxUsers: number;
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
    const usdcFromEnv = getConfiguredUsdcAddress();
    this.config = {
      rpcUrl: config.rpcUrl || getConfiguredRpcUrl(config.chainId),
      usdcAddress: config.usdcAddress || usdcFromEnv || "",
      marketAddress: config.marketAddress || process.env.MARKET_ADDRESS || "",
      chainId: config.chainId || getConfiguredChainId(),
      intervalMs: config.intervalMs || 3600000, // 1 小时
      tolerance: config.tolerance || BigInt(1e6), // 1 USDC
      batchSize: config.batchSize || 100,
      autoFix: config.autoFix ?? false,
      includeProxyWallets: config.includeProxyWallets ?? true,
      maxUsers: config.maxUsers || 10000,
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

    this.isRunning = true;
    try {
      await this.runCheck();

      this.checkTimer = setInterval(() => {
        if (!this.isRunning) return;
        void this.runCheck().catch((error: any) => {
          logger.error("Scheduled balance check failed", undefined, error);
        });
      }, this.config.intervalMs);
    } catch (error) {
      this.isRunning = false;
      if (this.checkTimer) {
        clearInterval(this.checkTimer);
        this.checkTimer = null;
      }
      throw error;
    }
  }

  /**
   * 停止余额检查
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    logger.info("BalanceChecker stopped");
  }

  /**
   * 运行余额检查
   */
  async runCheck(): Promise<BalanceReport> {
    const checkId = `balance-${Date.now()}-${randomUUID()}`;
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
            severity: result.difference > BigInt(100e6) ? "high" : "low",
          });
        }
      }

      if (this.config.autoFix && report.mismatches.length > 0) {
        await this.syncOffchainBalances(report.mismatches);
      }

      // 更新系统总余额指标
      systemTotalBalance.set(
        { token: "USDC", type: "onchain" },
        Number(report.summary.totalOnchain) / 1e6
      );
      systemTotalBalance.set(
        { token: "USDC", type: "offchain" },
        Number(report.summary.totalOffchain) / 1e6
      );

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
      const users = new Set<string>();

      if (this.config.includeProxyWallets) {
        const { data, error } = await client
          .from("user_profiles")
          .select("proxy_wallet_address")
          .not("proxy_wallet_address", "is", null)
          .neq("proxy_wallet_address", "")
          .limit(this.config.maxUsers);
        if (!error) {
          for (const row of (data || []) as any[]) {
            const addr = String(row?.proxy_wallet_address || "").toLowerCase();
            if (ethers.isAddress(addr)) users.add(addr);
          }
        }
      }

      const { data: balData, error: balErr } = await client
        .from("user_balances")
        .select("user_address")
        .gt("balance", 0)
        .limit(this.config.maxUsers);
      if (!balErr) {
        for (const row of (balData || []) as any[]) {
          const addr = String(row?.user_address || "").toLowerCase();
          if (ethers.isAddress(addr)) users.add(addr);
        }
      }

      return Array.from(users);
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
      const difference =
        onchainBalance > offchainBalance
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
        token: "USDC",
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
        const user = String((row as any)?.user_address || "").toLowerCase();
        const raw = (row as any)?.balance;
        let numeric = 0;
        if (typeof raw === "number") {
          numeric = raw;
        } else if (typeof raw === "string") {
          const parsed = parseFloat(raw);
          if (Number.isFinite(parsed)) numeric = parsed;
        }
        balances.set(user, BigInt(Math.floor(numeric * 1e6)));
      }
    } catch (error: any) {
      logger.error("Failed to get offchain balances", {}, error);
    }

    return balances;
  }

  private async syncOffchainBalances(mismatches: BalanceCheckResult[]): Promise<void> {
    const pool = getDatabasePool();
    const client = pool.getWriteClient();
    if (!client) return;

    const rows = mismatches.map((m) => ({
      user_address: m.userAddress.toLowerCase(),
      balance: ethers.formatUnits(m.onchainBalance, 6),
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      try {
        await client.from("user_balances").upsert(batch, { onConflict: "user_address" });
      } catch (error: any) {
        logger.warn("Failed to upsert user_balances batch", {}, error);
      }
    }
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

      const usdcDiff =
        usdcOnchain > usdcOffchain ? usdcOnchain - usdcOffchain : usdcOffchain - usdcOnchain;

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
      const totalUsdcLocked = BigInt(await this.usdcContract.balanceOf(this.config.marketAddress));

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

export async function initBalanceChecker(
  config?: Partial<BalanceCheckConfig>
): Promise<BalanceChecker> {
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
