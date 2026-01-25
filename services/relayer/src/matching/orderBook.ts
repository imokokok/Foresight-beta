/**
 * 内存订单簿实现
 * 使用红黑树结构实现高效的价格优先级队列
 */

import type { Order, PriceLevel, DepthSnapshot, OrderBookStats } from "./types.js";

/**
 * 价格级别节点 - 存储同一价格的所有订单
 */
class PriceLevelNode {
  price: bigint;
  orders: Map<string, Order> = new Map(); // orderId -> Order
  orderQueue: string[] = []; // 按时间优先排序的订单ID列表
  totalQuantity: bigint = 0n;

  constructor(price: bigint) {
    this.price = price;
  }

  addOrder(order: Order): void {
    if (this.orders.has(order.id)) {
      // 更新现有订单
      const oldOrder = this.orders.get(order.id)!;
      this.totalQuantity -= oldOrder.remainingAmount;
    } else {
      this.orderQueue.push(order.id);
    }
    this.orders.set(order.id, order);
    this.totalQuantity += order.remainingAmount;
  }

  removeOrder(orderId: string): Order | null {
    const order = this.orders.get(orderId);
    if (!order) return null;

    this.orders.delete(orderId);
    this.totalQuantity -= order.remainingAmount;
    this.orderQueue = this.orderQueue.filter((id) => id !== orderId);
    return order;
  }

  getFirstOrder(): Order | null {
    while (this.orderQueue.length > 0) {
      const orderId = this.orderQueue[0];
      const order = this.orders.get(orderId);
      if (order && order.remainingAmount > 0n) {
        return order;
      }
      // 移除无效订单
      this.orderQueue.shift();
      if (order) this.orders.delete(orderId);
    }
    return null;
  }

  getFirstOrderExcludingMaker(excludedMaker?: string): Order | null {
    const excluded = excludedMaker ? excludedMaker.toLowerCase() : null;
    for (let i = 0; i < this.orderQueue.length; ) {
      const orderId = this.orderQueue[i];
      const order = this.orders.get(orderId);
      if (!order || order.remainingAmount <= 0n) {
        this.orderQueue.splice(i, 1);
        if (order) this.orders.delete(orderId);
        continue;
      }
      if (excluded && order.maker === excluded) {
        i++;
        continue;
      }
      return order;
    }
    return null;
  }

  isEmpty(): boolean {
    return this.orders.size === 0 || this.totalQuantity === 0n;
  }

  toPriceLevel(): PriceLevel {
    return {
      price: this.price,
      totalQuantity: this.totalQuantity,
      orderCount: this.orders.size,
      orders: Array.from(this.orders.values()),
    };
  }
}

/**
 * 单边订单簿 (买盘或卖盘)
 */
class OneSideBook {
  private levels: Map<string, PriceLevelNode> = new Map(); // price.toString() -> PriceLevelNode
  private sortedPrices: bigint[] = [];
  private isBuy: boolean;

  constructor(isBuy: boolean) {
    this.isBuy = isBuy;
  }

  /**
   * 添加订单到订单簿
   */
  addOrder(order: Order): void {
    const priceKey = order.price.toString();

    let level = this.levels.get(priceKey);
    if (!level) {
      level = new PriceLevelNode(order.price);
      this.levels.set(priceKey, level);
      this.insertPrice(order.price);
    }

    level.addOrder(order);
  }

  /**
   * 移除订单
   */
  removeOrder(orderId: string, price: bigint): Order | null {
    const priceKey = price.toString();
    const level = this.levels.get(priceKey);
    if (!level) return null;

    const order = level.removeOrder(orderId);

    // 如果价格级别为空，移除它
    if (level.isEmpty()) {
      this.levels.delete(priceKey);
      this.removePrice(price);
    }

    return order;
  }

  /**
   * 获取最优价格
   */
  getBestPrice(): bigint | null {
    if (this.sortedPrices.length === 0) return null;
    return this.sortedPrices[0];
  }

  /**
   * 获取最优价格级别
   */
  getBestLevel(): PriceLevelNode | null {
    const bestPrice = this.getBestPrice();
    if (bestPrice === null) return null;
    return this.levels.get(bestPrice.toString()) || null;
  }

  getBestOrderExcludingMaker(excludedMaker?: string): Order | null {
    const excluded = excludedMaker ? excludedMaker.toLowerCase() : undefined;
    for (const price of this.sortedPrices) {
      const level = this.levels.get(price.toString());
      if (!level || level.isEmpty()) continue;
      const order = level.getFirstOrderExcludingMaker(excluded);
      if (order) return order;
    }
    return null;
  }

  /**
   * 获取指定深度的价格级别
   */
  getDepth(maxLevels: number): PriceLevel[] {
    const result: PriceLevel[] = [];
    const count = Math.min(maxLevels, this.sortedPrices.length);

    for (let i = 0; i < count; i++) {
      const priceKey = this.sortedPrices[i].toString();
      const level = this.levels.get(priceKey);
      if (level && !level.isEmpty()) {
        result.push(level.toPriceLevel());
      }
    }

    return result;
  }

  /**
   * 获取总深度
   */
  getTotalDepth(): bigint {
    let total = 0n;
    for (const level of this.levels.values()) {
      total += level.totalQuantity;
    }
    return total;
  }

  /**
   * 插入价格到排序数组 (维护排序)
   */
  private insertPrice(price: bigint): void {
    // 二分查找插入位置
    let left = 0;
    let right = this.sortedPrices.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const cmp = this.comparePrice(price, this.sortedPrices[mid]);
      if (cmp < 0) {
        right = mid;
      } else {
        left = mid + 1;
      }
    }

    this.sortedPrices.splice(left, 0, price);
  }

  /**
   * 移除价格
   */
  private removePrice(price: bigint): void {
    const index = this.sortedPrices.findIndex((p) => p === price);
    if (index !== -1) {
      this.sortedPrices.splice(index, 1);
    }
  }

  /**
   * 价格比较 (买盘降序, 卖盘升序)
   */
  private comparePrice(a: bigint, b: bigint): number {
    if (this.isBuy) {
      return b > a ? -1 : b < a ? 1 : 0;
    } else {
      return a < b ? -1 : a > b ? 1 : 0;
    }
  }

  /**
   * 清空订单簿
   */
  clear(): void {
    this.levels.clear();
    this.sortedPrices = [];
  }

  /**
   * 获取订单数量
   */
  getOrderCount(): number {
    let count = 0;
    for (const level of this.levels.values()) {
      count += level.orders.size;
    }
    return count;
  }

  getAllOrders(): Order[] {
    const all: Order[] = [];
    for (const price of this.sortedPrices) {
      const level = this.levels.get(price.toString());
      if (!level) continue;
      for (const orderId of level.orderQueue) {
        const order = level.orders.get(orderId);
        if (!order) continue;
        if (order.remainingAmount <= 0n) continue;
        all.push(order);
      }
    }
    return all;
  }
}

/**
 * 完整订单簿 - 管理一个市场的一个 outcome 的买卖双边
 */
export class OrderBook {
  readonly marketKey: string;
  readonly outcomeIndex: number;

  private bids: OneSideBook; // 买盘
  private asks: OneSideBook; // 卖盘
  private orderIndex: Map<string, { price: bigint; isBuy: boolean }> = new Map();
  private lastTradePrice: bigint | null = null;
  private volume24h: bigint = 0n;
  private lastVolumeReset: number = Date.now();

  constructor(marketKey: string, outcomeIndex: number) {
    this.marketKey = marketKey;
    this.outcomeIndex = outcomeIndex;
    this.bids = new OneSideBook(true);
    this.asks = new OneSideBook(false);
  }

  /**
   * 添加订单
   */
  addOrder(order: Order): void {
    // 验证订单属于此订单簿
    if (order.marketKey !== this.marketKey || order.outcomeIndex !== this.outcomeIndex) {
      throw new Error("Order does not belong to this order book");
    }

    const book = order.isBuy ? this.bids : this.asks;
    book.addOrder(order);

    // 更新索引
    this.orderIndex.set(order.id, { price: order.price, isBuy: order.isBuy });
  }

  /**
   * 移除订单
   */
  removeOrder(orderId: string): Order | null {
    const info = this.orderIndex.get(orderId);
    if (!info) return null;

    const book = info.isBuy ? this.bids : this.asks;
    const order = book.removeOrder(orderId, info.price);

    if (order) {
      this.orderIndex.delete(orderId);
    }

    return order;
  }

  /**
   * 更新订单 (部分成交后)
   */
  updateOrder(order: Order): void {
    const info = this.orderIndex.get(order.id);
    if (!info) {
      // 新订单
      this.addOrder(order);
      return;
    }

    const book = info.isBuy ? this.bids : this.asks;

    if (order.remainingAmount <= 0n) {
      // 完全成交,移除订单
      book.removeOrder(order.id, info.price);
      this.orderIndex.delete(order.id);
    } else {
      // 更新剩余量
      book.addOrder(order);
    }
  }

  /**
   * 获取买盘最优价格的订单
   */
  getBestBid(): Order | null {
    const level = this.bids.getBestLevel();
    return level?.getFirstOrder() || null;
  }

  /**
   * 获取卖盘最优价格的订单
   */
  getBestAsk(): Order | null {
    const level = this.asks.getBestLevel();
    return level?.getFirstOrder() || null;
  }

  /**
   * 获取对手盘最优订单 (用于撮合)
   */
  getBestCounterOrder(isBuy: boolean, excludedMaker?: string): Order | null {
    const excluded = excludedMaker ? excludedMaker.toLowerCase() : undefined;
    if (excluded) {
      return isBuy
        ? this.asks.getBestOrderExcludingMaker(excluded)
        : this.bids.getBestOrderExcludingMaker(excluded);
    }
    return isBuy ? this.getBestAsk() : this.getBestBid();
  }

  /**
   * 记录成交
   */
  recordTrade(price: bigint, amount: bigint): void {
    this.lastTradePrice = price;

    // 24小时成交量滚动统计
    const now = Date.now();
    if (now - this.lastVolumeReset > 24 * 60 * 60 * 1000) {
      this.volume24h = 0n;
      this.lastVolumeReset = now;
    }
    this.volume24h += amount;
  }

  /**
   * 获取深度快照
   */
  getDepthSnapshot(maxLevels: number = 20): DepthSnapshot {
    return {
      marketKey: this.marketKey,
      outcomeIndex: this.outcomeIndex,
      bids: this.bids.getDepth(maxLevels),
      asks: this.asks.getDepth(maxLevels),
      timestamp: Date.now(),
    };
  }

  /**
   * 获取订单簿统计
   */
  getStats(): OrderBookStats {
    const bestBid = this.bids.getBestPrice();
    const bestAsk = this.asks.getBestPrice();

    let spread: bigint | null = null;
    if (bestBid !== null && bestAsk !== null) {
      spread = bestAsk - bestBid;
    }

    return {
      marketKey: this.marketKey,
      outcomeIndex: this.outcomeIndex,
      bestBid,
      bestAsk,
      spread,
      bidDepth: this.bids.getTotalDepth(),
      askDepth: this.asks.getTotalDepth(),
      lastTradePrice: this.lastTradePrice,
      volume24h: this.volume24h,
    };
  }

  getAllOrders(): { bidOrders: Order[]; askOrders: Order[] } {
    return {
      bidOrders: this.bids.getAllOrders(),
      askOrders: this.asks.getAllOrders(),
    };
  }

  restoreStats(lastTradePrice: bigint | null, volume24h: bigint): void {
    this.lastTradePrice = lastTradePrice;
    this.volume24h = volume24h;
    this.lastVolumeReset = Date.now();
  }

  /**
   * 清空订单簿
   */
  clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.orderIndex.clear();
  }

  /**
   * 获取订单总数
   */
  getOrderCount(): number {
    return this.bids.getOrderCount() + this.asks.getOrderCount();
  }

  /**
   * 检查订单是否存在
   */
  hasOrder(orderId: string): boolean {
    return this.orderIndex.has(orderId);
  }
}

/**
 * 订单簿管理器 - 管理所有市场的订单簿
 */
export class OrderBookManager {
  private books: Map<string, OrderBook> = new Map(); // marketKey:outcomeIndex -> OrderBook

  /**
   * 获取或创建订单簿
   */
  getOrCreateBook(marketKey: string, outcomeIndex: number): OrderBook {
    const key = `${marketKey}:${outcomeIndex}`;

    let book = this.books.get(key);
    if (!book) {
      book = new OrderBook(marketKey, outcomeIndex);
      this.books.set(key, book);
    }

    return book;
  }

  /**
   * 获取订单簿
   */
  getBook(marketKey: string, outcomeIndex: number): OrderBook | null {
    return this.books.get(`${marketKey}:${outcomeIndex}`) || null;
  }

  /**
   * 获取所有订单簿
   */
  getAllBooks(): OrderBook[] {
    return Array.from(this.books.values());
  }

  /**
   * 移除订单簿
   */
  removeBook(marketKey: string, outcomeIndex: number): void {
    this.books.delete(`${marketKey}:${outcomeIndex}`);
  }

  /**
   * 清空所有订单簿
   */
  clear(): void {
    this.books.clear();
  }

  /**
   * 获取统计信息
   */
  getGlobalStats(): { totalBooks: number; totalOrders: number } {
    let totalOrders = 0;
    for (const book of this.books.values()) {
      totalOrders += book.getOrderCount();
    }
    return {
      totalBooks: this.books.size,
      totalOrders,
    };
  }
}
