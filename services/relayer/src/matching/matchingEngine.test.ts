/**
 * 撮合引擎单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MatchingEngine, OrderInput } from "./matchingEngine.js";
import { OrderBook, OrderBookManager } from "./orderBook.js";
import type { Order, MatchResult } from "./types.js";

// Mock supabase
vi.mock("../supabase.js", () => ({
  supabaseAdmin: null,
}));

describe("MatchingEngine", () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    engine = new MatchingEngine({
      makerFeeBps: 0,
      takerFeeBps: 40,
      minOrderAmount: 1_000_000_000_000n, // 1e12
      maxOrderAmount: 1_000_000_000_000_000_000_000n, // 1e21
    });
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  describe("Order Validation", () => {
    it("should reject order with invalid maker address", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "invalid-address",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n, // 0.5 USDC
        amount: 1_000_000_000_000_000_000n, // 1 share
        salt: "12345",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };

      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid maker address");
    });

    it("should reject order with invalid price", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 0n, // Invalid: price = 0
        amount: 1_000_000_000_000_000_000n,
        salt: "12345",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };

      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Price");
    });

    it("should reject order with price > 1 USDC", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 2_000_000n, // 2 USDC - invalid
        amount: 1_000_000_000_000_000_000n,
        salt: "12345",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };

      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Price");
    });

    it("should reject order below minimum amount", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1n, // Too small
        salt: "12345",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };

      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("minimum");
    });

    it("should reject order with price not aligned to tick size", async () => {
      const engineWithTick = new MatchingEngine({
        makerFeeBps: 0,
        takerFeeBps: 40,
        minOrderAmount: 1_000_000_000_000n,
        maxOrderAmount: 1_000_000_000_000_000_000_000n,
        minPrice: 0n,
        maxPrice: 1_000_000n,
        priceTickSize: 100000n,
      });

      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 505000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "67890",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };

      const result = await engineWithTick.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("tick size");

      await engineWithTick.shutdown();
    });

    it("should reject order with invalid tif", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "99999",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "GTC" as any,
      };

      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("time in force");
    });

    it("should reject order when post-only combined with IOC/FOK", async () => {
      const common: Omit<OrderInput, "tif"> = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "88888",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        postOnly: true,
      };

      const iocResult = await engine.submitOrder({ ...common, tif: "IOC" });
      expect(iocResult.success).toBe(false);
      expect(iocResult.error).toContain("Post-only");

      const fokResult = await engine.submitOrder({ ...common, tif: "FOK" });
      expect(fokResult.success).toBe(false);
      expect(fokResult.error).toContain("Post-only");
    });
  });

  describe("Time in force and post-only behavior", () => {
    it("should place post-only order when it does not cross", async () => {
      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);

      const existingAsk: Order = createTestOrder({
        id: "ask-1",
        isBuy: false,
        price: 600000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });
      book.addOrder(existingAsk);

      const postOnlyOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "po-1",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        postOnly: true,
      };

      const result = await engine.submitOrder(postOnlyOrder);
      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(0);
      expect(result.remainingOrder).not.toBeNull();
      expect(book.getOrderCount()).toBe(2);
    });

    it("should reject post-only order that would execute immediately", async () => {
      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);

      const existingAsk: Order = createTestOrder({
        id: "ask-1",
        isBuy: false,
        price: 500000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });
      book.addOrder(existingAsk);

      const postOnlyOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "po-2",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        postOnly: true,
      };

      const result = await engine.submitOrder(postOnlyOrder);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Post-only");
      expect(book.getOrderCount()).toBe(1);
    });

    it("should execute IOC order and not leave resting quantity", async () => {
      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);

      const existingAsk: Order = createTestOrder({
        id: "ask-1",
        isBuy: false,
        price: 500000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });
      book.addOrder(existingAsk);

      const iocOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 600000n,
        amount: 2_000_000_000_000_000_000n,
        salt: "ioc-1",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "IOC",
      };

      const result = await engine.submitOrder(iocOrder);
      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].matchedAmount).toBe(1_000_000_000_000_000_000n);
      expect(result.remainingOrder).toBeNull();
      expect(book.getOrderCount()).toBe(0);
    });

    it("should cancel unfilled IOC order without placing it on book", async () => {
      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);

      const iocOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "ioc-2",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "IOC",
      };

      const result = await engine.submitOrder(iocOrder);
      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(0);
      expect(result.remainingOrder).toBeNull();
      expect(book.getOrderCount()).toBe(0);
    });

    it("should fully execute FOK order when liquidity is sufficient", async () => {
      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);

      const ask1: Order = createTestOrder({
        id: "ask-1",
        isBuy: false,
        price: 500000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });
      const ask2: Order = createTestOrder({
        id: "ask-2",
        isBuy: false,
        price: 500000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });
      book.addOrder(ask1);
      book.addOrder(ask2);

      const fokOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 600000n,
        amount: 2_000_000_000_000_000_000n,
        salt: "fok-1",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "FOK",
      };

      const result = await engine.submitOrder(fokOrder);
      expect(result.success).toBe(true);
      const totalMatched = result.matches.reduce((acc, m) => acc + m.matchedAmount, 0n);
      expect(totalMatched).toBe(2_000_000_000_000_000_000n);
      expect(result.remainingOrder).toBeNull();
      expect(book.getOrderCount()).toBe(0);
    });

    it("should not execute FOK order when liquidity is insufficient", async () => {
      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);

      const ask1: Order = createTestOrder({
        id: "ask-1",
        isBuy: false,
        price: 500000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });
      book.addOrder(ask1);

      const fokOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 600000n,
        amount: 2_000_000_000_000_000_000n,
        salt: "fok-2",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "FOK",
      };

      const result = await engine.submitOrder(fokOrder);
      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(0);
      expect(result.remainingOrder).toBeNull();
      expect(book.getOrderCount()).toBe(1);
    });
  });

  describe("Risk control and exposure limits", () => {
    it("should reject buy order when market long exposure exceeds limit", async () => {
      const engineWithLimit = new MatchingEngine({
        makerFeeBps: 0,
        takerFeeBps: 40,
        minOrderAmount: 1_000_000_000_000n,
        maxOrderAmount: 1_000_000_000_000_000_000_000n,
        maxMarketLongExposureUsdc: 1,
      });

      (engineWithLimit as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engineWithLimit as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const manager = (engineWithLimit as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);

      const existingBid: Order = createTestOrder({
        id: "bid-1",
        maker: "0x1234567890123456789012345678901234567890",
        isBuy: true,
        price: 600000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });
      book.addOrder(existingBid);

      const newBuyOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "risk-long-1",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };

      const result = await engineWithLimit.submitOrder(newBuyOrder);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Market long exposure limit exceeded");

      await engineWithLimit.shutdown();
    });

    it("should reject sell order when market short exposure exceeds limit", async () => {
      const engineWithLimit = new MatchingEngine({
        makerFeeBps: 0,
        takerFeeBps: 40,
        minOrderAmount: 1_000_000_000_000n,
        maxOrderAmount: 1_000_000_000_000_000_000_000n,
        maxMarketShortExposureUsdc: 1,
      });

      (engineWithLimit as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engineWithLimit as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const manager = (engineWithLimit as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);

      const existingAsk: Order = createTestOrder({
        id: "ask-1",
        maker: "0x1234567890123456789012345678901234567890",
        isBuy: false,
        price: 600000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });
      book.addOrder(existingAsk);

      const newSellOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: false,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "risk-short-1",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };

      const result = await engineWithLimit.submitOrder(newSellOrder);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Market short exposure limit exceeded");

      await engineWithLimit.shutdown();
    });
  });
});

describe("OrderBook", () => {
  let orderBook: OrderBook;

  beforeEach(() => {
    orderBook = new OrderBook("80002:1", 0);
  });

  describe("Order Management", () => {
    it("should add orders correctly", () => {
      const buyOrder = createTestOrder({
        id: "order-1",
        isBuy: true,
        price: 500000n,
        remainingAmount: 1_000_000_000_000_000_000n,
      });

      orderBook.addOrder(buyOrder);
      expect(orderBook.getOrderCount()).toBe(1);
      expect(orderBook.hasOrder("order-1")).toBe(true);
    });

    it("should remove orders correctly", () => {
      const order = createTestOrder({ id: "order-1" });
      orderBook.addOrder(order);

      const removed = orderBook.removeOrder("order-1");
      expect(removed).not.toBeNull();
      expect(removed?.id).toBe("order-1");
      expect(orderBook.getOrderCount()).toBe(0);
    });

    it("should return null when removing non-existent order", () => {
      const removed = orderBook.removeOrder("non-existent");
      expect(removed).toBeNull();
    });

    it("should get best bid correctly", () => {
      // Add multiple buy orders at different prices
      orderBook.addOrder(
        createTestOrder({
          id: "bid-1",
          isBuy: true,
          price: 400000n,
          sequence: 1n,
        })
      );
      orderBook.addOrder(
        createTestOrder({
          id: "bid-2",
          isBuy: true,
          price: 500000n, // Best bid
          sequence: 2n,
        })
      );
      orderBook.addOrder(
        createTestOrder({
          id: "bid-3",
          isBuy: true,
          price: 450000n,
          sequence: 3n,
        })
      );

      const bestBid = orderBook.getBestBid();
      expect(bestBid).not.toBeNull();
      expect(bestBid?.price).toBe(500000n);
    });

    it("should get best ask correctly", () => {
      // Add multiple sell orders at different prices
      orderBook.addOrder(
        createTestOrder({
          id: "ask-1",
          isBuy: false,
          price: 600000n,
          sequence: 1n,
        })
      );
      orderBook.addOrder(
        createTestOrder({
          id: "ask-2",
          isBuy: false,
          price: 500000n, // Best ask
          sequence: 2n,
        })
      );
      orderBook.addOrder(
        createTestOrder({
          id: "ask-3",
          isBuy: false,
          price: 550000n,
          sequence: 3n,
        })
      );

      const bestAsk = orderBook.getBestAsk();
      expect(bestAsk).not.toBeNull();
      expect(bestAsk?.price).toBe(500000n);
    });

    it("should calculate spread correctly", () => {
      orderBook.addOrder(
        createTestOrder({
          id: "bid-1",
          isBuy: true,
          price: 450000n,
        })
      );
      orderBook.addOrder(
        createTestOrder({
          id: "ask-1",
          isBuy: false,
          price: 550000n,
        })
      );

      const stats = orderBook.getStats();
      expect(stats.bestBid).toBe(450000n);
      expect(stats.bestAsk).toBe(550000n);
      expect(stats.spread).toBe(100000n); // 0.1 USDC spread
    });
  });

  describe("Depth Snapshot", () => {
    it("should return correct depth snapshot", () => {
      // Add bids
      orderBook.addOrder(
        createTestOrder({
          id: "bid-1",
          isBuy: true,
          price: 450000n,
          remainingAmount: 1_000_000_000_000_000_000n,
        })
      );
      orderBook.addOrder(
        createTestOrder({
          id: "bid-2",
          isBuy: true,
          price: 450000n, // Same price
          remainingAmount: 2_000_000_000_000_000_000n,
        })
      );
      orderBook.addOrder(
        createTestOrder({
          id: "bid-3",
          isBuy: true,
          price: 400000n,
          remainingAmount: 1_000_000_000_000_000_000n,
        })
      );

      // Add asks
      orderBook.addOrder(
        createTestOrder({
          id: "ask-1",
          isBuy: false,
          price: 550000n,
          remainingAmount: 1_000_000_000_000_000_000n,
        })
      );

      const snapshot = orderBook.getDepthSnapshot(10);

      expect(snapshot.bids.length).toBe(2); // 2 price levels
      expect(snapshot.asks.length).toBe(1);

      // First bid level should be highest price with combined quantity
      expect(snapshot.bids[0].price).toBe(450000n);
      expect(snapshot.bids[0].totalQuantity).toBe(3_000_000_000_000_000_000n);
      expect(snapshot.bids[0].orderCount).toBe(2);
    });
  });

  describe("Trade Recording", () => {
    it("should record trades and update volume", () => {
      orderBook.recordTrade(500000n, 1_000_000_000_000_000_000n);
      orderBook.recordTrade(550000n, 2_000_000_000_000_000_000n);

      const stats = orderBook.getStats();
      expect(stats.lastTradePrice).toBe(550000n);
      expect(stats.volume24h).toBe(3_000_000_000_000_000_000n);
    });
  });
});

describe("OrderBookManager", () => {
  let manager: OrderBookManager;

  beforeEach(() => {
    manager = new OrderBookManager();
  });

  it("should create order book on demand", () => {
    const book = manager.getOrCreateBook("80002:1", 0);
    expect(book).not.toBeNull();
    expect(book.marketKey).toBe("80002:1");
    expect(book.outcomeIndex).toBe(0);
  });

  it("should return existing order book", () => {
    const book1 = manager.getOrCreateBook("80002:1", 0);
    const book2 = manager.getOrCreateBook("80002:1", 0);
    expect(book1).toBe(book2);
  });

  it("should create separate books for different outcomes", () => {
    const book0 = manager.getOrCreateBook("80002:1", 0);
    const book1 = manager.getOrCreateBook("80002:1", 1);
    expect(book0).not.toBe(book1);
  });

  it("should return null for non-existent book", () => {
    const book = manager.getBook("non-existent", 0);
    expect(book).toBeNull();
  });

  it("should return correct global stats", () => {
    const book1 = manager.getOrCreateBook("80002:1", 0);
    const book2 = manager.getOrCreateBook("80002:1", 1);

    book1.addOrder(createTestOrder({ id: "order-1", outcomeIndex: 0 }));
    book1.addOrder(createTestOrder({ id: "order-2", outcomeIndex: 0 }));
    book2.addOrder(createTestOrder({ id: "order-3", outcomeIndex: 1 }));

    const stats = manager.getGlobalStats();
    expect(stats.totalBooks).toBe(2);
    expect(stats.totalOrders).toBe(3);
  });
});

// ============================================================
// Helper Functions
// ============================================================

function createTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id || `order-${Date.now()}`,
    marketKey: overrides.marketKey || "80002:1",
    maker: overrides.maker || "0x1234567890123456789012345678901234567890",
    outcomeIndex: overrides.outcomeIndex ?? 0,
    isBuy: overrides.isBuy ?? true,
    price: overrides.price ?? 500000n,
    amount: overrides.amount ?? 1_000_000_000_000_000_000n,
    remainingAmount: overrides.remainingAmount ?? 1_000_000_000_000_000_000n,
    salt: overrides.salt || "12345",
    expiry: overrides.expiry ?? 0,
    signature: overrides.signature || "0x1234",
    chainId: overrides.chainId ?? 80002,
    verifyingContract: overrides.verifyingContract || "0x1234567890123456789012345678901234567890",
    sequence: overrides.sequence ?? 0n,
    status: overrides.status || "open",
    createdAt: overrides.createdAt ?? Date.now(),
  };
}
