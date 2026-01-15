/**
 * 数据仓库层
 * 封装常用数据库操作，自动选择读写连接
 */

import { DatabasePool, getDatabasePool } from "./connectionPool.js";
import { logger } from "../monitoring/logger.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// 类型定义
// ============================================================

export interface Order {
  id: string;
  market_key: string;
  outcome_index: number;
  user_address: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
  filled_quantity: number;
  status: "pending" | "open" | "filled" | "partial" | "cancelled";
  order_type: "limit" | "market";
  signature: string;
  nonce: number;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  market_key: string;
  outcome_index: number;
  maker_order_id: string;
  taker_order_id: string;
  maker_address: string;
  taker_address: string;
  price: number;
  quantity: number;
  is_buyer_maker: boolean;
  tx_hash?: string;
  settled: boolean;
  created_at: string;
}

export interface Market {
  id: string;
  market_key: string;
  title: string;
  description: string;
  outcome_count: number;
  outcomes: string[];
  status: "active" | "paused" | "resolved";
  resolution?: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 基础仓库类
// ============================================================

export abstract class BaseRepository<T> {
  protected pool: DatabasePool;
  protected tableName: string;

  constructor(tableName: string) {
    this.pool = getDatabasePool();
    this.tableName = tableName;
  }

  /**
   * 根据 ID 获取记录 (读操作)
   */
  async findById(id: string): Promise<T | null> {
    return this.pool.executeRead(`${this.tableName}_find_by_id`, async (client) => {
      const { data, error } = await client.from(this.tableName).select("*").eq("id", id).single();

      if (error && !error.message.includes("No rows")) {
        logger.error(`Failed to find ${this.tableName} by id`, { id }, error);
        throw error;
      }

      return data as T | null;
    });
  }

  /**
   * 查询记录 (读操作)
   */
  async find(
    filters: Record<string, unknown>,
    options?: { limit?: number; offset?: number; orderBy?: string; ascending?: boolean }
  ): Promise<T[]> {
    return this.pool.executeRead(`${this.tableName}_find`, async (client) => {
      let query = client.from(this.tableName).select("*");

      // 应用过滤条件
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }

      // 应用排序
      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? false });
      }

      // 应用分页
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`Failed to find ${this.tableName}`, { filters }, error);
        throw error;
      }

      return (data as T[]) || [];
    });
  }

  /**
   * 创建记录 (写操作)
   */
  async create(record: Partial<T>): Promise<T> {
    return this.pool.executeWrite(`${this.tableName}_create`, async (client) => {
      const { data, error } = await client.from(this.tableName).insert(record).select().single();

      if (error) {
        logger.error(`Failed to create ${this.tableName}`, { record }, error);
        throw error;
      }

      return data as T;
    });
  }

  /**
   * 更新记录 (写操作)
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    return this.pool.executeWrite(`${this.tableName}_update`, async (client) => {
      const { data, error } = await client
        .from(this.tableName)
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        logger.error(`Failed to update ${this.tableName}`, { id, updates }, error);
        throw error;
      }

      return data as T;
    });
  }

  /**
   * 删除记录 (写操作)
   */
  async delete(id: string): Promise<boolean> {
    return this.pool.executeWrite(`${this.tableName}_delete`, async (client) => {
      const { error } = await client.from(this.tableName).delete().eq("id", id);

      if (error) {
        logger.error(`Failed to delete ${this.tableName}`, { id }, error);
        throw error;
      }

      return true;
    });
  }

  /**
   * 批量创建 (写操作)
   */
  async createMany(records: Partial<T>[]): Promise<T[]> {
    return this.pool.executeWrite(`${this.tableName}_create_many`, async (client) => {
      const { data, error } = await client.from(this.tableName).insert(records).select();

      if (error) {
        logger.error(`Failed to create many ${this.tableName}`, { count: records.length }, error);
        throw error;
      }

      return (data as T[]) || [];
    });
  }

  /**
   * 获取原始客户端 (用于复杂查询)
   */
  getReadClient(): SupabaseClient | null {
    return this.pool.getReadClient();
  }

  getWriteClient(): SupabaseClient | null {
    return this.pool.getWriteClient();
  }
}

// ============================================================
// 订单仓库
// ============================================================

export class OrderRepository extends BaseRepository<Order> {
  constructor() {
    super("orders");
  }

  /**
   * 获取用户的未完成订单
   */
  async findOpenOrdersByUser(userAddress: string, marketKey?: string): Promise<Order[]> {
    return this.pool.executeRead("orders_find_open_by_user", async (client) => {
      let query = client
        .from(this.tableName)
        .select("*")
        .eq("user_address", userAddress)
        .in("status", ["open", "partial"]);

      if (marketKey) {
        query = query.eq("market_key", marketKey);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data as Order[]) || [];
    });
  }

  /**
   * 获取市场的订单簿
   */
  async findOrderBookOrders(
    marketKey: string,
    outcomeIndex: number,
    side: "buy" | "sell",
    limit: number = 100
  ): Promise<Order[]> {
    return this.pool.executeRead("orders_find_orderbook", async (client) => {
      const { data, error } = await client
        .from(this.tableName)
        .select("*")
        .eq("market_key", marketKey)
        .eq("outcome_index", outcomeIndex)
        .eq("side", side)
        .in("status", ["open", "partial"])
        .order("price", { ascending: side === "sell" })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data as Order[]) || [];
    });
  }

  /**
   * 更新订单状态
   */
  async updateStatus(
    orderId: string,
    status: Order["status"],
    filledQuantity?: number
  ): Promise<Order> {
    const updates: Partial<Order> = { status, updated_at: new Date().toISOString() };
    if (filledQuantity !== undefined) {
      updates.filled_quantity = filledQuantity;
    }
    return this.update(orderId, updates);
  }

  /**
   * 批量取消订单
   */
  async cancelOrders(orderIds: string[]): Promise<number> {
    return this.pool.executeWrite("orders_cancel_many", async (client) => {
      const { data, error } = await client
        .from(this.tableName)
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .in("id", orderIds)
        .select();

      if (error) {
        throw error;
      }

      return data?.length || 0;
    });
  }
}

// ============================================================
// 成交仓库
// ============================================================

export class TradeRepository extends BaseRepository<Trade> {
  constructor() {
    super("trades");
  }

  /**
   * 获取未结算的成交
   */
  async findUnsettledTrades(limit: number = 100): Promise<Trade[]> {
    return this.pool.executeRead("trades_find_unsettled", async (client) => {
      const { data, error } = await client
        .from(this.tableName)
        .select("*")
        .eq("settled", false)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data as Trade[]) || [];
    });
  }

  /**
   * 获取市场的最近成交
   */
  async findRecentTrades(
    marketKey: string,
    outcomeIndex: number,
    limit: number = 50
  ): Promise<Trade[]> {
    return this.pool.executeRead("trades_find_recent", async (client) => {
      const { data, error } = await client
        .from(this.tableName)
        .select("*")
        .eq("market_key", marketKey)
        .eq("outcome_index", outcomeIndex)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data as Trade[]) || [];
    });
  }

  /**
   * 标记成交为已结算
   */
  async markSettled(tradeIds: string[], txHash: string): Promise<number> {
    return this.pool.executeWrite("trades_mark_settled", async (client) => {
      const { data, error } = await client
        .from(this.tableName)
        .update({ settled: true, tx_hash: txHash })
        .in("id", tradeIds)
        .select();

      if (error) {
        throw error;
      }

      return data?.length || 0;
    });
  }

  /**
   * 获取用户的成交历史
   */
  async findTradesByUser(
    userAddress: string,
    options?: { marketKey?: string; limit?: number; offset?: number }
  ): Promise<Trade[]> {
    return this.pool.executeRead("trades_find_by_user", async (client) => {
      let query = client
        .from(this.tableName)
        .select("*")
        .or(`maker_address.eq.${userAddress},taker_address.eq.${userAddress}`);

      if (options?.marketKey) {
        query = query.eq("market_key", options.marketKey);
      }

      query = query.order("created_at", { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data as Trade[]) || [];
    });
  }
}

// ============================================================
// 市场仓库
// ============================================================

export class MarketRepository extends BaseRepository<Market> {
  constructor() {
    super("markets");
  }

  /**
   * 根据 market_key 获取市场
   */
  async findByMarketKey(marketKey: string): Promise<Market | null> {
    return this.pool.executeRead("markets_find_by_key", async (client) => {
      const { data, error } = await client
        .from(this.tableName)
        .select("*")
        .eq("market_key", marketKey)
        .single();

      if (error && !error.message.includes("No rows")) {
        throw error;
      }

      return data as Market | null;
    });
  }

  /**
   * 获取活跃市场
   */
  async findActiveMarkets(limit: number = 100): Promise<Market[]> {
    return this.pool.executeRead("markets_find_active", async (client) => {
      const { data, error } = await client
        .from(this.tableName)
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data as Market[]) || [];
    });
  }
}

// ============================================================
// 单例实例
// ============================================================

let orderRepo: OrderRepository | null = null;
let tradeRepo: TradeRepository | null = null;
let marketRepo: MarketRepository | null = null;

export function getOrderRepository(): OrderRepository {
  if (!orderRepo) {
    orderRepo = new OrderRepository();
  }
  return orderRepo;
}

export function getTradeRepository(): TradeRepository {
  if (!tradeRepo) {
    tradeRepo = new TradeRepository();
  }
  return tradeRepo;
}

export function getMarketRepository(): MarketRepository {
  if (!marketRepo) {
    marketRepo = new MarketRepository();
  }
  return marketRepo;
}
