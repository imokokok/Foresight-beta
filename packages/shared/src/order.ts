import { z } from "zod";

export interface Order {
  id: string;
  marketKey: string;
  maker: string;
  outcomeIndex: number;
  isBuy: boolean;
  price: bigint;
  amount: bigint;
  remainingAmount: bigint;
  salt: string;
  expiry: number;
  signature: string;
  chainId: number;
  verifyingContract: string;
  sequence: bigint;
  status: OrderStatus;
  createdAt: number;
  tif?: TimeInForce;
  postOnly?: boolean;
}

export type TimeInForce = "IOC" | "FOK" | "FAK" | "GTC" | "GTD";

export type OrderStatus =
  | "pending"
  | "open"
  | "partially_filled"
  | "filled"
  | "canceled"
  | "expired"
  | "rejected";

export interface Match {
  id: string;
  makerOrder: Order;
  takerOrder: Order;
  matchedAmount: bigint;
  matchedPrice: bigint;
  makerFee: bigint;
  takerFee: bigint;
  timestamp: number;
}

export interface MatchResult {
  success: boolean;
  matches: Match[];
  remainingOrder: Order | null;
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

export interface PriceLevel {
  price: bigint;
  totalQuantity: bigint;
  orderCount: number;
  orders: Order[];
}

export interface DepthSnapshot {
  marketKey: string;
  outcomeIndex: number;
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
}

export interface OrderBookStats {
  marketKey: string;
  outcomeIndex: number;
  bestBid: bigint | null;
  bestAsk: bigint | null;
  spread: bigint | null;
  bidDepth: bigint;
  askDepth: bigint;
  lastTradePrice: bigint | null;
  volume24h: bigint;
}

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
  isBuyerMaker: boolean;
  price: bigint;
  amount: bigint;
  makerFee: bigint;
  takerFee: bigint;
  txHash?: string;
  blockNumber?: number;
  timestamp: number;
}

export interface EIP712Order {
  maker: string;
  outcomeIndex: bigint;
  isBuy: boolean;
  price: bigint;
  amount: bigint;
  salt: bigint;
  expiry: bigint;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export const ORDER_TYPES = {
  Order: [
    { name: "maker", type: "address" },
    { name: "outcomeIndex", type: "uint256" },
    { name: "isBuy", type: "bool" },
    { name: "price", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "salt", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

export const orderStatusSchema = z.enum([
  "pending",
  "open",
  "partially_filled",
  "filled",
  "canceled",
  "expired",
  "rejected",
]);

export const timeInForceSchema = z.enum(["IOC", "FOK", "FAK", "GTC", "GTD"]);

export const orderSchema = z.object({
  marketKey: z.string(),
  maker: z.string().startsWith("0x"),
  outcomeIndex: z.number().min(0),
  isBuy: z.boolean(),
  price: z.bigint().positive(),
  amount: z.bigint().positive(),
  remainingAmount: z.bigint().nonnegative(),
  salt: z.string(),
  expiry: z.number().int().nonnegative(),
  signature: z.string(),
  chainId: z.number().positive(),
  verifyingContract: z.string().startsWith("0x"),
  tif: timeInForceSchema.optional(),
  postOnly: z.boolean().optional(),
});
