/**
 * 链上对账系统
 * 定期对比链上状态和数据库状态，确保一致性
 */

import { ethers, Contract, JsonRpcProvider } from "ethers";
import { EventEmitter } from "events";
import { logger } from "../monitoring/logger.js";
import { Counter, Gauge, Histogram } from "prom-client";
import { metricsRegistry } from "../monitoring/metrics.js";
import { getDatabasePool } from "../database/connectionPool.js";

// ============================================================
// 指标定义
// ============================================================

const reconciliationRunsTotal = new Counter({
  name: "foresight_reconciliation_runs_total",
  help: "Total reconciliation runs",
  labelNames: ["status"] as const, // success, failed
  registers: [metricsRegistry],
});

const reconciliationDiscrepancies = new Counter({
  name: "foresight_reconciliation_discrepancies_total",
  help: "Total discrepancies found",
  labelNames: ["type"] as const, // missing_onchain, missing_offchain, amount_mismatch
  registers: [metricsRegistry],
});

const reconciliationDuration = new Histogram({
  name: "foresight_reconciliation_duration_seconds",
  help: "Reconciliation duration in seconds",
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

const lastReconciliationTime = new Gauge({
  name: "foresight_reconciliation_last_run_timestamp",
  help: "Timestamp of last reconciliation run",
  registers: [metricsRegistry],
});

const pendingReconciliationItems = new Gauge({
  name: "foresight_reconciliation_pending_items",
  help: "Number of items pending reconciliation",
  registers: [metricsRegistry],
});

// ============================================================
// 合约 ABI
// ============================================================

const MARKET_ABI = [
  "event OrderFilledSigned(address indexed maker, address indexed taker, uint256 indexed outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 fee, uint256 salt)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address account) view returns (uint256)",
  "function balanceOf(address account, uint256 outcomeIndex) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

// ============================================================
// 类型定义
// ============================================================

export interface ReconciliationConfig {
  rpcUrl: string;
  marketAddress: string;
  usdcAddress?: string;
  chainId: number;
  /** 对账间隔 (毫秒) */
  intervalMs: number;
  /** 检查的区块范围 */
  blockRange: number;
  /** 是否自动修复差异 */
  autoFix: boolean;
  /** 金额差异容忍度 (wei) */
  amountTolerance: bigint;
}

export interface Discrepancy {
  id: string;
  type: "missing_onchain" | "missing_offchain" | "amount_mismatch" | "status_mismatch";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  details: {
    tradeId?: string;
    txHash?: string;
    expectedAmount?: string;
    actualAmount?: string;
    difference?: string;
    userAddress?: string;
    marketKey?: string;
  };
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  resolution?: string;
}

export interface ReconciliationReport {
  runId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  blocksScanned: number;
  tradesChecked: number;
  discrepancies: Discrepancy[];
  summary: {
    totalDiscrepancies: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    autoFixed: number;
  };
}

interface OnchainFill {
  txHash: string;
  blockNumber: number;
  logIndex: number;
  maker: string;
  taker: string;
  outcomeIndex: number;
  isBuy: boolean;
  price: bigint;
  amount: bigint;
  fee: bigint;
  salt: bigint;
}

// ============================================================
// 链上对账器
// ============================================================

export class ChainReconciler extends EventEmitter {
  private provider: JsonRpcProvider;
  private marketContract: Contract;
  private config: ReconciliationConfig;
  private isRunning: boolean = false;
  private reconciliationTimer: NodeJS.Timeout | null = null;
  private lastCheckedBlock: number = 0;
  private discrepancies: Map<string, Discrepancy> = new Map();

  constructor(config: Partial<ReconciliationConfig> = {}) {
    super();
    
    this.config = {
      rpcUrl: config.rpcUrl || process.env.RPC_URL || "",
      marketAddress: config.marketAddress || process.env.MARKET_ADDRESS || "",
      usdcAddress: config.usdcAddress || process.env.USDC_ADDRESS,
      chainId: config.chainId || parseInt(process.env.CHAIN_ID || "80002", 10),
      intervalMs: config.intervalMs || 300000, // 5 分钟
      blockRange: config.blockRange || 1000,
      autoFix: config.autoFix ?? false,
      amountTolerance: config.amountTolerance || 0n,
    };

    this.provider = new JsonRpcProvider(this.config.rpcUrl);
    this.marketContract = new Contract(this.config.marketAddress, MARKET_ABI, this.provider);
  }

  /**
   * 启动对账服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("ChainReconciler already running");
      return;
    }

    logger.info("Starting ChainReconciler", {
      marketAddress: this.config.marketAddress,
      chainId: this.config.chainId,
      intervalMs: this.config.intervalMs,
    });

    // 获取当前区块
    this.lastCheckedBlock = await this.provider.getBlockNumber() - this.config.blockRange;

    // 立即运行一次
    await this.runReconciliation();

    // 启动定时任务
    this.reconciliationTimer = setInterval(async () => {
      await this.runReconciliation();
    }, this.config.intervalMs);

    this.isRunning = true;
  }

  /**
   * 停止对账服务
   */
  async stop(): Promise<void> {
    if (this.reconciliationTimer) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
    this.isRunning = false;
    logger.info("ChainReconciler stopped");
  }

  /**
   * 运行对账
   */
  async runReconciliation(): Promise<ReconciliationReport> {
    const runId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const startTime = Date.now();
    
    logger.info("Starting reconciliation run", { runId });

    const report: ReconciliationReport = {
      runId,
      startTime,
      endTime: 0,
      durationMs: 0,
      blocksScanned: 0,
      tradesChecked: 0,
      discrepancies: [],
      summary: {
        totalDiscrepancies: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        autoFixed: 0,
      },
    };

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = this.lastCheckedBlock;
      const toBlock = currentBlock;

      report.blocksScanned = toBlock - fromBlock;

      // 1. 获取链上填充事件
      const onchainFills = await this.fetchOnchainFills(fromBlock, toBlock);
      logger.info("Fetched onchain fills", { count: onchainFills.length, fromBlock, toBlock });

      // 2. 获取数据库中的成交记录
      const offchainTrades = await this.fetchOffchainTrades(fromBlock, toBlock);
      report.tradesChecked = offchainTrades.length;

      // 3. 对比链上和链下数据
      const discrepancies = await this.compareRecords(onchainFills, offchainTrades);
      report.discrepancies = discrepancies;

      // 4. 统计差异
      for (const d of discrepancies) {
        report.summary.totalDiscrepancies++;
        report.summary[d.severity]++;
        
        this.discrepancies.set(d.id, d);
        reconciliationDiscrepancies.inc({ type: d.type });
      }

      // 5. 自动修复 (如果启用)
      if (this.config.autoFix) {
        const fixed = await this.autoFixDiscrepancies(discrepancies);
        report.summary.autoFixed = fixed;
      }

      // 更新检查点
      this.lastCheckedBlock = toBlock;

      report.endTime = Date.now();
      report.durationMs = report.endTime - startTime;

      // 更新指标
      reconciliationRunsTotal.inc({ status: "success" });
      reconciliationDuration.observe(report.durationMs / 1000);
      lastReconciliationTime.set(report.endTime);
      pendingReconciliationItems.set(this.discrepancies.size);

      logger.info("Reconciliation completed", {
        runId,
        durationMs: report.durationMs,
        blocksScanned: report.blocksScanned,
        tradesChecked: report.tradesChecked,
        discrepancies: report.summary.totalDiscrepancies,
      });

      this.emit("reconciliation_complete", report);

      return report;
    } catch (error: any) {
      reconciliationRunsTotal.inc({ status: "failed" });
      logger.error("Reconciliation failed", { runId }, error);

      report.endTime = Date.now();
      report.durationMs = report.endTime - startTime;

      this.emit("reconciliation_error", { runId, error: error.message });

      throw error;
    }
  }

  /**
   * 获取链上填充事件
   */
  private async fetchOnchainFills(fromBlock: number, toBlock: number): Promise<OnchainFill[]> {
    const fills: OnchainFill[] = [];

    try {
      const filter = this.marketContract.filters.OrderFilledSigned();
      const events = await this.marketContract.queryFilter(filter, fromBlock, toBlock);

      for (const event of events) {
        const { maker, taker, outcomeIndex, isBuy, price, amount, fee, salt } = (event as any).args;
        
        fills.push({
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          logIndex: event.index,
          maker,
          taker,
          outcomeIndex: Number(outcomeIndex),
          isBuy,
          price: BigInt(price),
          amount: BigInt(amount),
          fee: BigInt(fee),
          salt: BigInt(salt),
        });
      }
    } catch (error: any) {
      logger.error("Failed to fetch onchain fills", { fromBlock, toBlock }, error);
    }

    return fills;
  }

  /**
   * 获取数据库中的成交记录
   */
  private async fetchOffchainTrades(fromBlock: number, toBlock: number): Promise<any[]> {
    const pool = getDatabasePool();
    const client = pool.getReadClient();
    
    if (!client) {
      logger.warn("Database not available for reconciliation");
      return [];
    }

    try {
      // 获取在此区块范围内结算的成交
      const { data, error } = await client
        .from("trades")
        .select("*")
        .eq("settled", true)
        .gte("block_number", fromBlock)
        .lte("block_number", toBlock);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      logger.error("Failed to fetch offchain trades", { fromBlock, toBlock }, error);
      return [];
    }
  }

  /**
   * 对比链上和链下记录
   */
  private async compareRecords(
    onchainFills: OnchainFill[],
    offchainTrades: any[]
  ): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];

    // 创建链上填充的索引 (按 txHash + logIndex)
    const onchainIndex = new Map<string, OnchainFill>();
    for (const fill of onchainFills) {
      const key = `${fill.txHash}-${fill.logIndex}`;
      onchainIndex.set(key, fill);
    }

    // 创建链下成交的索引 (按 txHash)
    const offchainIndex = new Map<string, any>();
    for (const trade of offchainTrades) {
      if (trade.tx_hash) {
        offchainIndex.set(trade.tx_hash, trade);
      }
    }

    // 检查链下记录是否都在链上
    for (const trade of offchainTrades) {
      if (trade.tx_hash && trade.settled) {
        // 查找对应的链上记录
        const onchainFill = onchainFills.find(f => f.txHash === trade.tx_hash);
        
        if (!onchainFill) {
          discrepancies.push({
            id: `disc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            type: "missing_onchain",
            severity: "critical",
            description: "Trade marked as settled but no onchain event found",
            details: {
              tradeId: trade.id,
              txHash: trade.tx_hash,
              userAddress: trade.maker_address,
              marketKey: trade.market_key,
            },
            detectedAt: Date.now(),
            resolved: false,
          });
        } else {
          // 验证金额
          const offchainAmount = BigInt(Math.floor(trade.quantity * 1e18));
          const amountDiff = offchainAmount > onchainFill.amount 
            ? offchainAmount - onchainFill.amount 
            : onchainFill.amount - offchainAmount;
            
          if (amountDiff > this.config.amountTolerance) {
            discrepancies.push({
              id: `disc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              type: "amount_mismatch",
              severity: amountDiff > BigInt(1e18) ? "high" : "medium",
              description: "Trade amount mismatch between onchain and offchain",
              details: {
                tradeId: trade.id,
                txHash: trade.tx_hash,
                expectedAmount: offchainAmount.toString(),
                actualAmount: onchainFill.amount.toString(),
                difference: amountDiff.toString(),
              },
              detectedAt: Date.now(),
              resolved: false,
            });
          }
        }
      }
    }

    // 检查链上事件是否都有对应的链下记录
    for (const fill of onchainFills) {
      const offchainTrade = offchainIndex.get(fill.txHash);
      
      if (!offchainTrade) {
        discrepancies.push({
          id: `disc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: "missing_offchain",
          severity: "high",
          description: "Onchain fill event has no corresponding offchain trade",
          details: {
            txHash: fill.txHash,
            userAddress: fill.maker,
            expectedAmount: fill.amount.toString(),
          },
          detectedAt: Date.now(),
          resolved: false,
        });
      }
    }

    return discrepancies;
  }

  /**
   * 自动修复差异
   */
  private async autoFixDiscrepancies(discrepancies: Discrepancy[]): Promise<number> {
    let fixed = 0;

    for (const d of discrepancies) {
      if (d.resolved) continue;

      try {
        switch (d.type) {
          case "missing_offchain":
            // 从链上同步缺失的记录
            await this.syncFromChain(d);
            d.resolved = true;
            d.resolvedAt = Date.now();
            d.resolution = "Synced from chain";
            fixed++;
            break;

          case "status_mismatch":
            // 更新状态
            await this.fixStatusMismatch(d);
            d.resolved = true;
            d.resolvedAt = Date.now();
            d.resolution = "Status corrected";
            fixed++;
            break;

          // amount_mismatch 和 missing_onchain 需要人工处理
          default:
            logger.warn("Discrepancy requires manual intervention", { discrepancy: d });
        }
      } catch (error: any) {
        logger.error("Failed to auto-fix discrepancy", { discrepancy: d }, error);
      }
    }

    return fixed;
  }

  /**
   * 从链上同步记录
   */
  private async syncFromChain(discrepancy: Discrepancy): Promise<void> {
    const { txHash } = discrepancy.details;
    if (!txHash) return;

    const pool = getDatabasePool();
    const client = pool.getWriteClient();
    if (!client) return;

    // 获取交易收据和事件
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) return;

    // 解析事件
    const logs = receipt.logs
      .filter(log => log.address.toLowerCase() === this.config.marketAddress.toLowerCase())
      .map(log => {
        try {
          return this.marketContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // 创建缺失的记录
    for (const log of logs) {
      if (log && log.name === "OrderFilledSigned") {
        const { maker, taker, outcomeIndex, isBuy, price, amount, fee, salt } = log.args;
        
        await client.from("trades").insert({
          id: `sync-${txHash}-${salt}`,
          market_key: this.config.marketAddress,
          outcome_index: Number(outcomeIndex),
          maker_address: maker,
          taker_address: taker,
          price: Number(price) / 1e18,
          quantity: Number(amount) / 1e18,
          is_buyer_maker: isBuy,
          tx_hash: txHash,
          block_number: receipt.blockNumber,
          settled: true,
          created_at: new Date().toISOString(),
          synced_from_chain: true,
        });
      }
    }

    logger.info("Synced trade from chain", { txHash });
  }

  /**
   * 修复状态不匹配
   */
  private async fixStatusMismatch(discrepancy: Discrepancy): Promise<void> {
    const { tradeId, txHash } = discrepancy.details;
    if (!tradeId) return;

    const pool = getDatabasePool();
    const client = pool.getWriteClient();
    if (!client) return;

    // 检查链上状态
    if (txHash) {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (receipt && receipt.status === 1) {
        // 交易成功，更新状态
        await client.from("trades")
          .update({ settled: true, block_number: receipt.blockNumber })
          .eq("id", tradeId);
        
        logger.info("Fixed trade status", { tradeId, txHash });
      }
    }
  }

  /**
   * 获取当前差异列表
   */
  getDiscrepancies(): Discrepancy[] {
    return Array.from(this.discrepancies.values());
  }

  /**
   * 获取未解决的差异
   */
  getUnresolvedDiscrepancies(): Discrepancy[] {
    return Array.from(this.discrepancies.values()).filter(d => !d.resolved);
  }

  /**
   * 标记差异为已解决
   */
  resolveDiscrepancy(discrepancyId: string, resolution: string): boolean {
    const discrepancy = this.discrepancies.get(discrepancyId);
    if (discrepancy) {
      discrepancy.resolved = true;
      discrepancy.resolvedAt = Date.now();
      discrepancy.resolution = resolution;
      pendingReconciliationItems.set(this.getUnresolvedDiscrepancies().length);
      return true;
    }
    return false;
  }

  /**
   * 手动触发对账
   */
  async triggerReconciliation(): Promise<ReconciliationReport> {
    return this.runReconciliation();
  }

  /**
   * 获取对账状态
   */
  getStatus(): {
    isRunning: boolean;
    lastCheckedBlock: number;
    unresolvedDiscrepancies: number;
    totalDiscrepancies: number;
  } {
    return {
      isRunning: this.isRunning,
      lastCheckedBlock: this.lastCheckedBlock,
      unresolvedDiscrepancies: this.getUnresolvedDiscrepancies().length,
      totalDiscrepancies: this.discrepancies.size,
    };
  }
}

// ============================================================
// 单例
// ============================================================

let reconcilerInstance: ChainReconciler | null = null;

export function getChainReconciler(config?: Partial<ReconciliationConfig>): ChainReconciler {
  if (!reconcilerInstance) {
    reconcilerInstance = new ChainReconciler(config);
  }
  return reconcilerInstance;
}

export async function initChainReconciler(config?: Partial<ReconciliationConfig>): Promise<ChainReconciler> {
  const reconciler = getChainReconciler(config);
  await reconciler.start();
  return reconciler;
}

export async function closeChainReconciler(): Promise<void> {
  if (reconcilerInstance) {
    await reconcilerInstance.stop();
    reconcilerInstance = null;
  }
}

