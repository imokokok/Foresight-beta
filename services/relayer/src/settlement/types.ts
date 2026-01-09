/**
 * 批量结算服务类型定义
 * 对标 Polymarket 的 Operator 模式
 */

// ============ 结算相关类型 ============

export interface SettlementOrder {
  maker: string;
  outcomeIndex: number;
  isBuy: boolean;
  price: bigint;
  amount: bigint;
  salt: bigint;
  expiry: bigint;
}

export interface SettlementFill {
  id: string; // 撮合 ID
  order: SettlementOrder;
  signature: string;
  fillAmount: bigint;
  taker: string; // Taker 地址 (Operator 代为结算)
  matchedPrice: bigint;
  makerFee: bigint;
  takerFee: bigint;
  timestamp: number;
}

export interface SettlementBatch {
  id: string;
  chainId: number;
  marketAddress: string;
  fills: SettlementFill[];
  status: BatchStatus;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: bigint;
  createdAt: number;
  submittedAt?: number;
  confirmedAt?: number;
  error?: string;
  retryCount: number;
}

export type BatchStatus =
  | "pending" // 等待处理
  | "submitting" // 正在提交
  | "submitted" // 已提交,等待确认
  | "confirmed" // 已确认
  | "failed" // 失败
  | "retrying"; // 重试中

// ============ 结算队列类型 ============

export interface SettlementQueueConfig {
  // 批量配置
  maxBatchSize: number; // 每批最大数量 (合约限制 50)
  minBatchSize: number; // 最小批量大小 (触发结算)
  maxBatchWaitMs: number; // 最大等待时间 (ms)

  // 重试配置
  maxRetries: number; // 最大重试次数
  retryDelayMs: number; // 重试间隔
  retryBackoffMultiplier: number; // 退避乘数

  // Gas 配置
  maxGasPrice: bigint; // 最大 Gas 价格
  gasPriceMultiplier: number; // Gas 价格乘数 (1.1 = 10% 加速)

  // 确认配置
  confirmations: number; // 需要的区块确认数
  confirmationTimeoutMs: number; // 确认超时

  // 失败 fills 自动重试
  failedFillRetryIntervalMs: number;
  failedFillMaxRetries: number;
  failedFillRetryBatchSize: number;
}

export const DEFAULT_SETTLEMENT_CONFIG: SettlementQueueConfig = {
  maxBatchSize: 50,
  minBatchSize: 5,
  maxBatchWaitMs: 5000,
  maxRetries: 3,
  retryDelayMs: 2000,
  retryBackoffMultiplier: 2,
  maxGasPrice: BigInt(500 * 1e9), // 500 Gwei
  gasPriceMultiplier: 1.1,
  confirmations: 2,
  confirmationTimeoutMs: 60000,
  failedFillRetryIntervalMs: 10000,
  failedFillMaxRetries: 5,
  failedFillRetryBatchSize: 50,
};

// ============ Operator 类型 ============

export interface OperatorConfig {
  privateKey: string; // Operator 私钥
  rpcUrl: string; // RPC URL
  chainId: number; // 链 ID
  marketAddress: string; // 市场合约地址
}

// ============ 事件类型 ============

export type SettlementEvent =
  | { type: "batch_created"; batch: SettlementBatch }
  | { type: "batch_submitted"; batchId: string; txHash: string }
  | { type: "batch_confirmed"; batchId: string; blockNumber: number }
  | { type: "batch_failed"; batchId: string; error: string }
  | { type: "fill_settled"; fillId: string; txHash: string };

// ============ 统计类型 ============

export interface SettlementStats {
  pendingFills: number;
  pendingBatches: number;
  submittedBatches: number;
  confirmedBatches: number;
  failedBatches: number;
  totalFillsSettled: number;
  totalGasUsed: bigint;
  averageBatchSize: number;
  averageConfirmationTime: number;
}
