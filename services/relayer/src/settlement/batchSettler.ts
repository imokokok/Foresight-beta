/**
 * 批量结算服务
 * 实现 Polymarket 风格的 Operator 批量链上结算
 */

import { ethers, Contract, Wallet, JsonRpcProvider } from "ethers";
import { EventEmitter } from "events";
import type {
  SettlementFill,
  SettlementBatch,
  SettlementQueueConfig,
  SettlementEvent,
  SettlementStats,
  BatchStatus,
} from "./types.js";
import { DEFAULT_SETTLEMENT_CONFIG } from "./types.js";
import { supabaseAdmin } from "../supabase.js";
import { getRedisClient } from "../redis/client.js";
import { generateRandomId } from "../monitoring/index.js";
import { settlementLogger } from "../monitoring/logger.js";

// 合约 ABI (只需要 batchFill 函数)
const MARKET_ABI = [
  "function batchFill((address maker, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 salt, uint256 expiry)[] calldata orders, bytes[] calldata signatures, uint256[] calldata fillAmounts) external",
  "function fillOrderSigned((address maker, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 salt, uint256 expiry) calldata order, bytes calldata signature, uint256 fillAmount) external",
  "event OrderFilledSigned(address indexed maker, address indexed taker, uint256 indexed outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 fee, uint256 salt)",
];

const clobIface = new ethers.Interface([
  "event OrderFilledSigned(address maker, address taker, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 fee, uint256 salt)",
]);

/**
 * 批量结算器
 */
export class BatchSettler extends EventEmitter {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  private config: SettlementQueueConfig;

  // 结算队列
  private pendingFills: Map<string, SettlementFill> = new Map();
  private batches: Map<string, SettlementBatch> = new Map();

  // 定时器
  private batchTimer: NodeJS.Timeout | null = null;
  private confirmTimer: NodeJS.Timeout | null = null;
  private failedFillTimer: NodeJS.Timeout | null = null;

  // 统计
  private stats: SettlementStats = {
    pendingFills: 0,
    pendingBatches: 0,
    submittedBatches: 0,
    confirmedBatches: 0,
    failedBatches: 0,
    totalFillsSettled: 0,
    totalGasUsed: 0n,
    averageBatchSize: 0,
    averageConfirmationTime: 0,
  };

  private isShuttingDown = false;
  private createBatchInFlight = false;
  private checkConfirmationsInFlight = false;
  private retryFailedFillsInFlight = false;

  constructor(
    private chainId: number,
    private marketAddress: string,
    privateKey: string,
    rpcUrl: string,
    config: Partial<SettlementQueueConfig> = {}
  ) {
    super();
    this.provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
    this.config = { ...DEFAULT_SETTLEMENT_CONFIG, ...config };

    settlementLogger.info("BatchSettler initialized", {
      marketAddress,
      chainId,
      operatorAddress: this.wallet.address,
    });
  }

  /**
   * 启动结算服务
   */
  start(): void {
    // 定期检查是否需要创建批次
    this.batchTimer = setInterval(() => {
      void this.checkAndCreateBatch().catch((error) => {
        settlementLogger.error("BatchSettler checkAndCreateBatch failed", undefined, error);
      });
    }, 1000);

    // 定期检查待确认的交易
    this.confirmTimer = setInterval(() => {
      void this.checkConfirmations().catch((error) => {
        settlementLogger.error("BatchSettler checkConfirmations failed", undefined, error);
      });
    }, 3000);

    this.failedFillTimer = setInterval(() => {
      void this.retryFailedFills().catch((error) => {
        settlementLogger.error("BatchSettler retryFailedFills failed", undefined, error);
      });
    }, this.config.failedFillRetryIntervalMs);

    settlementLogger.info("BatchSettler started");
  }

  /**
   * 添加待结算的撮合
   */
  addFill(fill: SettlementFill): void {
    if (this.isShuttingDown) {
      throw new Error("Settler is shutting down");
    }

    this.pendingFills.set(fill.id, fill);
    this.stats.pendingFills = this.pendingFills.size;

    settlementLogger.info("BatchSettler fill queued", {
      fillId: fill.id,
      pending: this.pendingFills.size,
    });

    // 检查是否达到批量大小
    if (this.pendingFills.size >= this.config.maxBatchSize) {
      void this.createBatch();
    }
  }

  /**
   * 检查是否需要创建批次
   */
  private async checkAndCreateBatch(): Promise<void> {
    if (this.pendingFills.size === 0) return;
    if (this.isShuttingDown) return;
    if (this.createBatchInFlight) return;

    // 获取最早的 fill
    const fills = Array.from(this.pendingFills.values());
    const oldestFill = fills.reduce((oldest, fill) =>
      fill.timestamp < oldest.timestamp ? fill : oldest
    );

    const waitTime = Date.now() - oldestFill.timestamp;

    // 达到最小批量大小 或 等待时间超过阈值
    if (
      this.pendingFills.size >= this.config.minBatchSize ||
      waitTime >= this.config.maxBatchWaitMs
    ) {
      await this.createBatch();
    }
  }

  /**
   * 创建批次并提交
   */
  private async createBatch(): Promise<void> {
    if (this.pendingFills.size === 0) return;
    if (this.isShuttingDown) return;
    if (this.createBatchInFlight) return;
    this.createBatchInFlight = true;

    try {
      // 取出待处理的 fills (最多 maxBatchSize)
      const fills = Array.from(this.pendingFills.values()).slice(0, this.config.maxBatchSize);

      // 从 pending 中移除
      for (const fill of fills) {
        this.pendingFills.delete(fill.id);
      }

      // 创建批次
      const batch: SettlementBatch = {
        id: `batch-${Date.now()}-${generateRandomId(9)}`,
        chainId: this.chainId,
        marketAddress: this.marketAddress,
        fills,
        status: "pending",
        createdAt: Date.now(),
        retryCount: 0,
      };

      this.batches.set(batch.id, batch);
      this.stats.pendingBatches++;
      this.stats.pendingFills = this.pendingFills.size;

      this.emitEvent({ type: "batch_created", batch });

      settlementLogger.info("BatchSettler batch created", {
        batchId: batch.id,
        fills: fills.length,
      });

      // 异步提交
      void this.submitBatch(batch);
    } finally {
      this.createBatchInFlight = false;
    }
  }

  /**
   * 提交批次到链上
   */
  private async submitBatch(batch: SettlementBatch): Promise<void> {
    if (this.isShuttingDown) return;
    batch.status = "submitting";

    try {
      // 检查 Gas 价格
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;

      if (gasPrice > this.config.maxGasPrice) {
        settlementLogger.warn("BatchSettler gas price too high", {
          batchId: batch.id,
          gasPrice: gasPrice.toString(),
          maxGasPrice: this.config.maxGasPrice.toString(),
        });
        batch.retryCount++;
        if (batch.retryCount < this.config.maxRetries) {
          batch.status = "retrying";
          const delay =
            this.config.retryDelayMs *
            Math.pow(this.config.retryBackoffMultiplier, Math.max(0, batch.retryCount - 1));
          setTimeout(() => void this.submitBatch(batch), delay);
        } else {
          batch.status = "failed";
          batch.error = "Gas price too high";
          this.stats.failedBatches++;
          this.stats.pendingBatches--;
          this.emitEvent({ type: "batch_failed", batchId: batch.id, error: batch.error });
          await this.saveFailedBatch(batch);
        }
        return;
      }

      const contract = new Contract(this.marketAddress, MARKET_ABI, this.wallet);

      // 准备批量调用参数
      const orders = batch.fills.map((fill) => ({
        maker: fill.order.maker,
        outcomeIndex: fill.order.outcomeIndex,
        isBuy: fill.order.isBuy,
        price: fill.order.price,
        amount: fill.order.amount,
        salt: fill.order.salt,
        expiry: fill.order.expiry,
      }));

      const signatures = batch.fills.map((fill) => fill.signature);
      const fillAmounts = batch.fills.map((fill) => fill.fillAmount);

      settlementLogger.info("BatchSettler submitting batch", {
        batchId: batch.id,
        orders: orders.length,
      });

      // 估算 Gas
      let gasEstimate: bigint;
      try {
        gasEstimate = await contract.batchFill.estimateGas(orders, signatures, fillAmounts);
        // 加 20% 余量
        gasEstimate = (gasEstimate * 120n) / 100n;
      } catch (estimateError: any) {
        settlementLogger.error(
          "BatchSettler gas estimation failed",
          { batchId: batch.id, error: String(estimateError?.message || estimateError) },
          estimateError
        );
        batch.status = "failed";
        batch.error = `Gas estimation failed: ${estimateError.message}`;
        this.stats.failedBatches++;
        this.stats.pendingBatches--;
        this.emitEvent({ type: "batch_failed", batchId: batch.id, error: batch.error });
        await this.saveFailedBatch(batch);
        return;
      }

      // 发送交易
      const tx = await contract.batchFill(orders, signatures, fillAmounts, {
        gasLimit: gasEstimate,
        gasPrice: (gasPrice * BigInt(Math.floor(this.config.gasPriceMultiplier * 100))) / 100n,
      });

      batch.txHash = tx.hash;
      batch.status = "submitted";
      batch.submittedAt = Date.now();

      this.stats.submittedBatches++;
      this.stats.pendingBatches--;

      settlementLogger.info("BatchSettler batch submitted", { batchId: batch.id, txHash: tx.hash });
      this.emitEvent({ type: "batch_submitted", batchId: batch.id, txHash: tx.hash });

      // 保存到数据库
      await this.saveBatchToDb(batch);
    } catch (error: any) {
      settlementLogger.error(
        "BatchSettler failed to submit batch",
        { batchId: batch.id, error: String(error?.message || error) },
        error
      );

      batch.retryCount++;

      if (batch.retryCount < this.config.maxRetries) {
        batch.status = "retrying";
        const delay =
          this.config.retryDelayMs *
          Math.pow(this.config.retryBackoffMultiplier, batch.retryCount - 1);

        settlementLogger.info("BatchSettler retrying batch", {
          batchId: batch.id,
          delayMs: delay,
          attempt: batch.retryCount,
          maxRetries: this.config.maxRetries,
        });

        setTimeout(() => void this.submitBatch(batch), delay);
      } else {
        batch.status = "failed";
        batch.error = error.message;
        this.stats.failedBatches++;
        this.stats.pendingBatches--;

        this.emitEvent({ type: "batch_failed", batchId: batch.id, error: error.message });

        // 将失败的 fills 记录到数据库
        await this.saveFailedBatch(batch);
      }
    }
  }

  /**
   * 检查待确认的交易
   */
  private async checkConfirmations(): Promise<void> {
    if (this.checkConfirmationsInFlight) return;
    this.checkConfirmationsInFlight = true;
    const submittedBatches = Array.from(this.batches.values()).filter(
      (b) => b.status === "submitted" && b.txHash
    );

    try {
      for (const batch of submittedBatches) {
        try {
          const receipt = await this.provider.getTransactionReceipt(batch.txHash!);

          if (receipt) {
            const currentBlock = await this.provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber;

            if (confirmations >= this.config.confirmations) {
              batch.status = "confirmed";
              batch.blockNumber = receipt.blockNumber;
              batch.gasUsed = receipt.gasUsed;
              batch.confirmedAt = Date.now();

              this.stats.confirmedBatches++;
              this.stats.submittedBatches--;
              this.stats.totalFillsSettled += batch.fills.length;
              this.stats.totalGasUsed += receipt.gasUsed;

              // 更新平均批量大小
              const totalBatches = this.stats.confirmedBatches;
              this.stats.averageBatchSize =
                (this.stats.averageBatchSize * (totalBatches - 1) + batch.fills.length) /
                totalBatches;

              // 更新平均确认时间
              const confirmTime = batch.confirmedAt! - batch.submittedAt!;
              this.stats.averageConfirmationTime =
                (this.stats.averageConfirmationTime * (totalBatches - 1) + confirmTime) /
                totalBatches;

              settlementLogger.info("BatchSettler batch confirmed", {
                batchId: batch.id,
                blockNumber: receipt.blockNumber,
              });
              this.emitEvent({
                type: "batch_confirmed",
                batchId: batch.id,
                blockNumber: receipt.blockNumber,
              });

              await this.saveConfirmationToDb(batch);

              await this.ingestFillsFromReceipt(receipt, batch.chainId);
              for (const fill of batch.fills) {
                this.emitEvent({
                  type: "fill_settled",
                  fillId: fill.id,
                  txHash: batch.txHash!,
                  fill,
                });
                await this.markFailedFillResolved(fill.id);
              }

              // 清理已确认的批次
              this.batches.delete(batch.id);
            }
          } else {
            // 检查超时
            const elapsed = Date.now() - batch.submittedAt!;
            if (elapsed > this.config.confirmationTimeoutMs) {
              settlementLogger.warn("BatchSettler confirmation timeout", { batchId: batch.id });
              batch.status = "failed";
              batch.error = "Confirmation timeout";
              this.stats.failedBatches++;
              this.stats.submittedBatches--;

              this.emitEvent({
                type: "batch_failed",
                batchId: batch.id,
                error: "Confirmation timeout",
              });
              await this.saveFailureToDb(batch);
              await this.saveFailedBatch(batch);
            }
          }
        } catch (error: any) {
          settlementLogger.error(
            "BatchSettler error checking confirmation",
            { batchId: batch.id, error: String(error?.message || error) },
            error
          );
        }
      }
    } finally {
      this.checkConfirmationsInFlight = false;
    }
  }

  /**
   * 保存批次到数据库
   */
  private async saveBatchToDb(batch: SettlementBatch): Promise<void> {
    if (!supabaseAdmin) return;

    await supabaseAdmin.from("settlement_batches").upsert({
      id: batch.id,
      chain_id: batch.chainId,
      market_address: batch.marketAddress,
      fill_count: batch.fills.length,
      status: batch.status,
      tx_hash: batch.txHash,
      submitted_at: batch.submittedAt ? new Date(batch.submittedAt).toISOString() : null,
      created_at: new Date(batch.createdAt).toISOString(),
    });
  }

  private async saveConfirmationToDb(batch: SettlementBatch): Promise<void> {
    if (!supabaseAdmin) return;
    await supabaseAdmin
      .from("settlement_batches")
      .update({
        status: "confirmed",
        block_number: batch.blockNumber,
        gas_used: batch.gasUsed ? batch.gasUsed.toString() : null,
        confirmed_at: batch.confirmedAt ? new Date(batch.confirmedAt).toISOString() : null,
      })
      .eq("id", batch.id);
  }

  private async saveFailureToDb(batch: SettlementBatch): Promise<void> {
    if (!supabaseAdmin) return;
    await supabaseAdmin
      .from("settlement_batches")
      .update({
        status: "failed",
        error: batch.error || "failed",
        retry_count: batch.retryCount,
      })
      .eq("id", batch.id);
  }

  /**
   * 保存失败的批次
   */
  private async saveFailedBatch(batch: SettlementBatch): Promise<void> {
    if (!supabaseAdmin) return;

    await supabaseAdmin.from("settlement_batches").upsert({
      id: batch.id,
      chain_id: batch.chainId,
      market_address: batch.marketAddress,
      fill_count: batch.fills.length,
      status: "failed",
      error: batch.error,
      retry_count: batch.retryCount,
      created_at: new Date(batch.createdAt).toISOString(),
    });

    // 记录失败的 fills 以便后续处理
    for (const fill of batch.fills) {
      const now = Date.now();
      const nextRetryAt = new Date(now + this.config.retryDelayMs).toISOString();
      const payload = this.buildFailedFillPayload(fill);
      await supabaseAdmin.from("failed_fills").upsert(
        {
          fill_id: fill.id,
          batch_id: batch.id,
          error: batch.error,
          chain_id: this.chainId,
          market_address: this.marketAddress.toLowerCase(),
          payload,
          retry_count: 0,
          next_retry_at: nextRetryAt,
          resolved_at: null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "fill_id" }
      );
    }
  }

  private buildFailedFillPayload(fill: SettlementFill): any {
    return {
      version: 1,
      chainId: this.chainId,
      marketAddress: this.marketAddress.toLowerCase(),
      fill: {
        id: fill.id,
        order: {
          maker: fill.order.maker.toLowerCase(),
          outcomeIndex: fill.order.outcomeIndex,
          isBuy: fill.order.isBuy,
          price: fill.order.price.toString(),
          amount: fill.order.amount.toString(),
          salt: fill.order.salt.toString(),
          expiry: fill.order.expiry.toString(),
        },
        signature: fill.signature,
        fillAmount: fill.fillAmount.toString(),
        taker: fill.taker.toLowerCase(),
        matchedPrice: fill.matchedPrice.toString(),
        makerFee: fill.makerFee.toString(),
        takerFee: fill.takerFee.toString(),
        timestamp: fill.timestamp,
      },
    };
  }

  private parseFailedFillPayload(payload: any): SettlementFill | null {
    const p = payload as any;
    if (!p || typeof p !== "object") return null;
    if (!p.fill || typeof p.fill !== "object") return null;
    const f = p.fill as any;
    if (!f.order || typeof f.order !== "object") return null;
    const o = f.order as any;

    try {
      const order = {
        maker: String(o.maker || "").toLowerCase(),
        outcomeIndex: Number(o.outcomeIndex),
        isBuy: Boolean(o.isBuy),
        price: BigInt(String(o.price)),
        amount: BigInt(String(o.amount)),
        salt: BigInt(String(o.salt)),
        expiry: BigInt(String(o.expiry)),
      };

      if (!order.maker || !Number.isFinite(order.outcomeIndex)) return null;

      return {
        id: String(f.id),
        order,
        signature: String(f.signature || ""),
        fillAmount: BigInt(String(f.fillAmount)),
        taker: String(f.taker || "").toLowerCase(),
        matchedPrice: BigInt(String(f.matchedPrice)),
        makerFee: BigInt(String(f.makerFee)),
        takerFee: BigInt(String(f.takerFee)),
        timestamp: Number(f.timestamp || Date.now()),
      };
    } catch {
      return null;
    }
  }

  private async retryFailedFills(): Promise<void> {
    if (!supabaseAdmin) return;
    if (this.isShuttingDown) return;
    if (this.retryFailedFillsInFlight) return;
    this.retryFailedFillsInFlight = true;

    const redis = getRedisClient();
    const lockKey = `failed_fills:retry:${this.chainId}:${this.marketAddress.toLowerCase()}`;
    const token = redis.isReady() ? await redis.acquireLock(lockKey, 15000, 0, 0) : null;
    if (redis.isReady() && !token) {
      this.retryFailedFillsInFlight = false;
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from("failed_fills")
        .select("id,fill_id,retry_count,next_retry_at,payload")
        .eq("chain_id", this.chainId)
        .eq("market_address", this.marketAddress.toLowerCase())
        .is("resolved_at", null)
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .order("created_at", { ascending: true })
        .limit(this.config.failedFillRetryBatchSize);

      if (error) {
        settlementLogger.warn("BatchSettler failed to load failed fills", {
          error: String((error as any)?.message || error),
        });
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const rowAny = row as any;
        const fill = this.parseFailedFillPayload(rowAny.payload);
        const attempt = Number(rowAny.retry_count || 0) + 1;

        if (attempt > this.config.failedFillMaxRetries) {
          await supabaseAdmin
            .from("failed_fills")
            .update({
              resolved_at: new Date().toISOString(),
              error: "Max retries exceeded",
            })
            .eq("id", rowAny.id)
            .is("resolved_at", null);
          const fillId = String(rowAny.fill_id || fill?.id || "");
          if (fillId) {
            this.emitEvent({
              type: "fill_failed",
              fillId,
              error: "Max retries exceeded",
              fill: fill || undefined,
            });
          }
          continue;
        }

        const delayMs =
          this.config.retryDelayMs *
          Math.pow(this.config.retryBackoffMultiplier, Math.max(0, attempt - 1));
        const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

        await supabaseAdmin
          .from("failed_fills")
          .update({
            retry_count: attempt,
            next_retry_at: nextRetryAt,
          })
          .eq("id", rowAny.id)
          .is("resolved_at", null);

        if (!fill) {
          await supabaseAdmin
            .from("failed_fills")
            .update({
              resolved_at: new Date().toISOString(),
              error: "Missing or invalid payload",
            })
            .eq("id", rowAny.id)
            .is("resolved_at", null);
          const fillId = String(rowAny.fill_id || "");
          if (fillId) {
            this.emitEvent({
              type: "fill_failed",
              fillId,
              error: "Missing or invalid payload",
            });
          }
          continue;
        }

        this.addFill(fill);
      }
    } finally {
      if (token) {
        await redis.releaseLock(lockKey, token);
      }
      this.retryFailedFillsInFlight = false;
    }
  }

  private async markFailedFillResolved(fillId: string): Promise<void> {
    if (!supabaseAdmin) return;
    await supabaseAdmin
      .from("failed_fills")
      .update({ resolved_at: new Date().toISOString() })
      .eq("fill_id", fillId)
      .is("resolved_at", null);
  }

  /**
   * 从交易收据摄入成交事件
   */
  private async ingestFillsFromReceipt(receipt: any, chainId: number): Promise<void> {
    if (!supabaseAdmin) return;

    const txHash = String(receipt.transactionHash || "");
    if (!txHash) return;

    const blockNumber = Number(receipt.blockNumber || 0);
    const block = blockNumber > 0 ? await this.provider.getBlock(blockNumber) : null;
    const ts = block ? (block as any).timestamp : 0;
    const tsNum = typeof ts === "bigint" ? Number(ts) : Number(ts || 0);
    const blockTsIso = new Date(tsNum * 1000).toISOString();

    const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
    for (const log of logs) {
      const addr = String(log?.address || "").toLowerCase();
      if (!addr || addr !== this.marketAddress.toLowerCase()) continue;
      let parsed: any;
      try {
        parsed = clobIface.parseLog({ topics: log.topics as string[], data: log.data });
      } catch {
        continue;
      }
      if (!parsed || parsed.name !== "OrderFilledSigned") continue;

      const maker = String((parsed.args as any).maker || "").toLowerCase();
      const taker = String((parsed.args as any).taker || "").toLowerCase();
      const outcomeIndex = Number((parsed.args as any).outcomeIndex);
      const isBuy = Boolean((parsed.args as any).isBuy);
      const price = BigInt((parsed.args as any).price).toString();
      const amount = BigInt((parsed.args as any).amount).toString();
      const fee = BigInt((parsed.args as any).fee).toString();
      const salt = BigInt((parsed.args as any).salt).toString();

      const logIndexRaw =
        typeof (log as any).logIndex === "number"
          ? (log as any).logIndex
          : typeof (log as any).index === "number"
            ? (log as any).index
            : 0;
      const logIndex = Number.isFinite(logIndexRaw) ? Number(logIndexRaw) : 0;

      await (supabaseAdmin as any).rpc("ingest_trade_event", {
        p_network_id: chainId,
        p_market_address: this.marketAddress.toLowerCase(),
        p_outcome_index: outcomeIndex,
        p_price: price,
        p_amount: amount,
        p_taker_address: taker,
        p_maker_address: maker,
        p_is_buy: isBuy,
        p_tx_hash: txHash.toLowerCase(),
        p_log_index: logIndex,
        p_block_number: BigInt(blockNumber).toString(),
        p_block_timestamp: blockTsIso,
        p_fee: fee,
        p_salt: salt,
      });
    }
  }

  /**
   * 发送事件
   */
  private emitEvent(event: SettlementEvent): void {
    this.emit("settlement_event", event);
  }

  /**
   * 获取统计信息
   */
  getStats(): SettlementStats {
    return { ...this.stats };
  }

  /**
   * 获取 Operator 地址
   */
  getOperatorAddress(): string {
    return this.wallet.address;
  }

  /**
   * 获取 Operator 余额
   */
  async getOperatorBalance(): Promise<{ eth: string; usdc?: string }> {
    const eth = await this.provider.getBalance(this.wallet.address);
    return { eth: ethers.formatEther(eth) };
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    settlementLogger.info("BatchSettler shutting down");
    this.isShuttingDown = true;

    // 停止定时器
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.confirmTimer) {
      clearInterval(this.confirmTimer);
      this.confirmTimer = null;
    }
    if (this.failedFillTimer) {
      clearInterval(this.failedFillTimer);
      this.failedFillTimer = null;
    }

    // 处理剩余的 pending fills
    if (this.pendingFills.size > 0) {
      settlementLogger.info("BatchSettler processing remaining fills", {
        fills: this.pendingFills.size,
      });
      await this.createBatch();
    }

    // 等待所有 submitted 批次确认 (最多等 30 秒)
    const startTime = Date.now();
    while (this.stats.submittedBatches > 0 && Date.now() - startTime < 30000) {
      await this.checkConfirmations();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    settlementLogger.info("BatchSettler shutdown complete");
  }
}
