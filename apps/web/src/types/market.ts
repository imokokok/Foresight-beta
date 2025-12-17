// 市场相关类型定义
export interface Market {
  id: number;
  chain_id: number;
  verifying_contract: string;
  collateral_token: string;
  oracle_address: string;
  fee_bps: number;
  resolution_time: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  chain_id: number;
  verifying_contract: string;
  maker_address: string;
  maker_salt: string;
  outcome_index: number;
  is_buy: boolean;
  price: string;
  amount: string;
  remaining: string;
  expiry: Date | null;
  signature: string;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  created_at: string;
}

export interface OrderDepth {
  price: string;
  qty: string;
  totalQty?: string;
}

export interface OrderBookDepth {
  buy: OrderDepth[];
  sell: OrderDepth[];
  bestBid: string;
  bestAsk: string;
}

// EIP-712 订单类型
export interface EIP712Order {
  maker: string;
  outcomeIndex: number;
  isBuy: boolean;
  price: string;
  amount: string;
  salt: string;
  expiry: number;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export const ORDER_TYPES = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'outcomeIndex', type: 'uint256' },
    { name: 'isBuy', type: 'bool' },
    { name: 'price', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'salt', type: 'uint256' },
    { name: 'expiry', type: 'uint256' }
  ]
} as const;

