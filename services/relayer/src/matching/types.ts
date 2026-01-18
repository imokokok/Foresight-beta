/**
 * 订单撮合引擎类型定义
 * 对标 Polymarket 的链下撮合 + 链上结算架构
 */

// ============ 订单相关类型 ============

export interface Order {
  id: string;
  marketKey: string; // 市场标识: chainId:eventId
  maker: string; // 订单创建者地址
  outcomeIndex: number; // 结果索引 (0=Yes, 1=No)
  isBuy: boolean; // 买/卖方向
  price: bigint; // 价格 (6 decimals, max 1_000_000 = 1 USDC)
  amount: bigint; // 订单总量 (18 decimals)
  remainingAmount: bigint; // 剩余未成交量
  salt: string; // 唯一盐值
  expiry: number; // 过期时间戳 (0=永不过期)
  signature: string; // EIP-712 签名
  chainId: number; // 链 ID
  verifyingContract: string; // 验证合约地址
  sequence: bigint; // 排序序号 (时间优先)
  status: OrderStatus; // 订单状态
  createdAt: number; // 创建时间戳
  tif?: "IOC" | "FOK" | "FAK" | "GTC" | "GTD";
  postOnly?: boolean;
}

export type OrderStatus =
  | "pending" // 等待验证
  | "open" // 活跃挂单
  | "partially_filled" // 部分成交
  | "filled" // 完全成交
  | "canceled" // 已取消
  | "expired" // 已过期
  | "rejected"; // 被拒绝

// ============ 撮合相关类型 ============

export interface Match {
  id: string; // 撮合 ID
  makerOrder: Order; // Maker 订单
  takerOrder: Order; // Taker 订单
  matchedAmount: bigint; // 成交数量
  matchedPrice: bigint; // 成交价格 (Maker 价格)
  makerFee: bigint; // Maker 手续费
  takerFee: bigint; // Taker 手续费
  timestamp: number; // 撮合时间
}

export interface MatchResult {
  success: boolean;
  matches: Match[];
  remainingOrder: Order | null; // 未完全成交的剩余订单
  error?: string;
  errorCode?: OrderErrorCode;
}

export type OrderErrorCode =
  | "INVALID_MARKET_KEY"
  | "INVALID_OUTCOME_INDEX"
  | "INVALID_CHAIN_ID"
  | "INVALID_VERIFYING_CONTRACT"
  | "INVALID_MAKER"
  | "INVALID_SALT"
  | "INVALID_EXPIRY"
  | "INVALID_SIGNATURE"
  | "INVALID_PRICE"
  | "INVALID_TICK_SIZE"
  | "INVALID_AMOUNT"
  | "INVALID_TIME_IN_FORCE"
  | "INVALID_POST_ONLY"
  | "ORDER_EXPIRED"
  | "DUPLICATE_ORDER"
  | "INSUFFICIENT_BALANCE"
  | "MARKET_LONG_EXPOSURE_LIMIT"
  | "MARKET_SHORT_EXPOSURE_LIMIT"
  | "BALANCE_CHECK_FAILED"
  | "ORDERBOOK_BUSY";

// ============ 订单簿相关类型 ============

export interface PriceLevel {
  price: bigint;
  totalQuantity: bigint;
  orderCount: number;
  orders: Order[]; // 按时间优先排序
}

export interface DepthSnapshot {
  marketKey: string;
  outcomeIndex: number;
  bids: PriceLevel[]; // 买盘 (价格降序)
  asks: PriceLevel[]; // 卖盘 (价格升序)
  timestamp: number;
}

export interface OrderBookStats {
  marketKey: string;
  outcomeIndex: number;
  bestBid: bigint | null;
  bestAsk: bigint | null;
  spread: bigint | null;
  bidDepth: bigint; // 买盘总深度
  askDepth: bigint; // 卖盘总深度
  lastTradePrice: bigint | null;
  volume24h: bigint;
}

// ============ 交易相关类型 ============

export interface Trade {
  id: string;
  matchId: string;
  marketKey: string;
  outcomeIndex: number;
  maker: string;
  taker: string;
  makerOrderId?: string;
  takerOrderId?: string;
  makerSalt?: string;
  takerSalt?: string;
  isBuyerMaker: boolean; // Maker 是否是买方
  price: bigint;
  amount: bigint;
  makerFee: bigint;
  takerFee: bigint;
  txHash?: string; // 链上结算交易哈希
  blockNumber?: number;
  timestamp: number;
}

// ============ 事件类型 (用于 WebSocket 推送) ============

export type MarketEvent =
  | { type: "order_placed"; order: Order }
  | {
      type: "order_canceled";
      orderId: string;
      marketKey: string;
      outcomeIndex?: number;
      releasedUsdcMicro?: string;
    }
  | { type: "order_updated"; order: Order }
  | { type: "trade"; trade: Trade }
  | { type: "depth_update"; depth: DepthSnapshot }
  | { type: "stats_update"; stats: OrderBookStats };

// ============ 配置类型 ============

export interface MatchingEngineConfig {
  makerFeeBps: number;
  takerFeeBps: number;
  maxOrdersPerMarket: number;
  maxOrdersPerUser: number;
  minOrderAmount: bigint;
  maxOrderAmount: bigint;
  priceDecimals: number;
  amountDecimals: number;
  minPrice: bigint;
  maxPrice: bigint;
  priceTickSize: bigint;
  batchSettlementInterval: number;
  batchSettlementThreshold: number;
  enableSelfTradeProtection?: boolean;
  maxMarketLongExposureUsdc?: number;
  maxMarketShortExposureUsdc?: number;
  gtdMaxExpiryDays?: number;
}

export const DEFAULT_CONFIG: MatchingEngineConfig = {
  makerFeeBps: 0,
  takerFeeBps: 0,
  maxOrdersPerMarket: 10000,
  maxOrdersPerUser: 100,
  minOrderAmount: 1_000_000_000_000n,
  maxOrderAmount: 1_000_000_000_000_000_000_000n,
  priceDecimals: 6,
  amountDecimals: 18,
  minPrice: 1n,
  maxPrice: 1_000_000n,
  priceTickSize: 1n,
  batchSettlementInterval: 5000,
  batchSettlementThreshold: 10,
  enableSelfTradeProtection: false,
  maxMarketLongExposureUsdc: 0,
  maxMarketShortExposureUsdc: 0,
  gtdMaxExpiryDays: 0,
};
