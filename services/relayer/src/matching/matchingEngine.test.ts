/**
 * 撮合引擎单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MatchingEngine, OrderInput } from "./matchingEngine.js";
import { OrderBook, OrderBookManager } from "./orderBook.js";
import type { Order, MatchResult } from "./types.js";
import { ethers } from "ethers";

// Mock supabase
let supabaseAdminMock: any = null;
vi.mock("../supabase.js", () => ({
  get supabaseAdmin() {
    return supabaseAdminMock;
  },
}));

let redisReady = false;
const loadSnapshotMock = vi.fn();
const queueSnapshotMock = vi.fn();
const queuePublicSnapshotMock = vi.fn();
const deleteOrderbookStateMock = vi.fn();
const lRangeMock = vi.fn();

vi.mock("../redis/client.js", () => ({
  getRedisClient: () => ({
    isReady: () => redisReady,
    acquireLock: async () => (redisReady ? "token" : null),
    releaseLock: async () => true,
    getRawClient: () =>
      redisReady
        ? {
            lRange: lRangeMock,
          }
        : null,
  }),
}));

vi.mock("../redis/orderbookSnapshot.js", () => ({
  getOrderbookSnapshotService: () => ({
    loadSnapshot: loadSnapshotMock,
    queueSnapshot: queueSnapshotMock,
    queuePublicSnapshot: queuePublicSnapshotMock,
    deleteOrderbookState: deleteOrderbookStateMock,
    startSync: () => {},
    shutdown: async () => {},
  }),
}));

describe("MatchingEngine", () => {
  let engine: MatchingEngine;
  let prevExpirySweepMs: string | undefined;

  beforeEach(() => {
    prevExpirySweepMs = process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS;
    process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS = "0";
    redisReady = false;
    supabaseAdminMock = null;
    loadSnapshotMock.mockReset();
    queueSnapshotMock.mockReset();
    queuePublicSnapshotMock.mockReset();
    deleteOrderbookStateMock.mockReset();
    lRangeMock.mockReset();
    engine = new MatchingEngine({
      makerFeeBps: 0,
      takerFeeBps: 40,
      minOrderAmount: 1_000_000_000_000n, // 1e12
      maxOrderAmount: 1_000_000_000_000_000_000_000n, // 1e21
    });
  });

  afterEach(async () => {
    await engine.shutdown();
    if (prevExpirySweepMs === undefined) {
      delete process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS;
    } else {
      process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS = prevExpirySweepMs;
    }
  });

  describe("USDC reservation", () => {
    it("should reserve for a resting buy order and keep it", async () => {
      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "reserve_user_balance") return { data: [{ success: true }], error: null };
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });
      supabaseAdminMock = { rpc: rpcMock };

      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);
      (engine as any).checkBalanceAndRisk = vi.fn().mockResolvedValue({ valid: true });
      (engine as any).saveOrderToDb = vi.fn().mockResolvedValue(undefined);

      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "90001",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "GTC",
      };

      const result = await engine.submitOrder(order);
      expect(result.success).toBe(true);
      expect(result.remainingOrder).not.toBeNull();

      expect(rpcMock).toHaveBeenCalledWith("reserve_user_balance", {
        p_user_address: order.maker.toLowerCase(),
        p_amount: "0.5",
      });

      expect(rpcMock).not.toHaveBeenCalledWith("release_user_balance", expect.anything());
    });

    it("should reserve and then release when post-only is rejected", async () => {
      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "reserve_user_balance") return { data: [{ success: true }], error: null };
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });
      supabaseAdminMock = { rpc: rpcMock };

      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);
      (engine as any).checkBalanceAndRisk = vi.fn().mockResolvedValue({ valid: true });
      (engine as any).saveOrderToDb = vi.fn().mockResolvedValue(undefined);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);
      book.addOrder(
        createTestOrder({
          id: "ask-1",
          isBuy: false,
          price: 400000n,
          remainingAmount: 1_000_000_000_000_000_000n,
        })
      );

      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "90002",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "GTC",
        postOnly: true,
      };

      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("INVALID_POST_ONLY");

      expect(rpcMock).toHaveBeenCalledWith("reserve_user_balance", {
        p_user_address: order.maker.toLowerCase(),
        p_amount: "0.5",
      });
      expect(rpcMock).toHaveBeenCalledWith("release_user_balance", {
        p_user_address: order.maker.toLowerCase(),
        p_amount: "0.5",
      });
    });

    it("should release reservation for a filled resting buy order", async () => {
      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "reserve_user_balance") return { data: [{ success: true }], error: null };
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });
      supabaseAdminMock = { rpc: rpcMock };

      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);
      (engine as any).checkBalanceAndRisk = vi.fn().mockResolvedValue({ valid: true });
      (engine as any).updateOrderInDb = vi.fn().mockResolvedValue(undefined);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);
      book.addOrder(
        createTestOrder({
          id: "bid-1",
          maker: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          isBuy: true,
          price: 500000n,
          remainingAmount: 1_000_000_000_000_000_000n,
        })
      );

      const sellOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        outcomeIndex: 0,
        isBuy: false,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "90003",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "IOC",
      };

      const result = await engine.submitOrder(sellOrder);
      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(1);

      expect(rpcMock).not.toHaveBeenCalledWith("release_user_balance", expect.anything());

      engine.emit("settlement_event", {
        type: "fill_settled",
        fillId: result.matches[0]!.id,
        txHash: "0x1234",
        fill: {
          id: result.matches[0]!.id,
          order: {
            maker: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            outcomeIndex: 0,
            isBuy: true,
            price: 500000n,
            amount: 1_000_000_000_000_000_000n,
            salt: 1n,
            expiry: 0n,
          },
          signature: "0x",
          fillAmount: 1_000_000_000_000_000_000n,
          taker: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          matchedPrice: 500000n,
          makerFee: 0n,
          takerFee: 0n,
          timestamp: Date.now(),
        },
      });

      await new Promise((r) => setTimeout(r, 0));

      expect(rpcMock).toHaveBeenCalledWith("release_user_balance", {
        p_user_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        p_amount: "0.5",
      });
    });

    it("should release reservation when a resting order expires via sweep", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-10T00:00:00.000Z"));
      const prev = process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS;
      process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS = "0";

      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "reserve_user_balance") return { data: [{ success: true }], error: null };
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });

      const query: any = {};
      query.update = vi.fn(() => query);
      query.eq = vi.fn(() => query);

      supabaseAdminMock = { rpc: rpcMock, from: () => query };

      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);
      (engine as any).checkBalanceAndRisk = vi.fn().mockResolvedValue({ valid: true });
      (engine as any).saveOrderToDb = vi.fn().mockResolvedValue(undefined);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const order: OrderInput = {
        marketKey: "80002:expire-sweep",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "91001",
        expiry: nowSeconds + 1,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "GTD",
      };

      const placed = await engine.submitOrder(order);
      expect(placed.success).toBe(true);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getBook(order.marketKey, order.outcomeIndex)!;
      expect(book.getOrderCount()).toBe(1);

      vi.setSystemTime(new Date("2026-01-10T00:00:02.000Z"));
      await (engine as any).runExpirySweepOnce();

      expect(book.getOrderCount()).toBe(0);
      expect(rpcMock).toHaveBeenCalledWith("release_user_balance", {
        p_user_address: order.maker.toLowerCase(),
        p_amount: "0.5",
      });
      expect(query.update).toHaveBeenCalledWith({ status: "expired" });

      vi.useRealTimers();
      if (prev === undefined) {
        delete process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS;
      } else {
        process.env.RELAYER_ORDER_EXPIRY_SWEEP_MS = prev;
      }
    });

    it("should release reservation on fill_failed event", async () => {
      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });
      supabaseAdminMock = { rpc: rpcMock };

      engine.emit("settlement_event", {
        type: "fill_failed",
        fillId: "fill-1",
        error: "Max retries exceeded",
        fill: {
          id: "fill-1",
          order: {
            maker: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            outcomeIndex: 0,
            isBuy: true,
            price: 500000n,
            amount: 1_000_000_000_000_000_000n,
            salt: 1n,
            expiry: 0n,
          },
          signature: "0x",
          fillAmount: 1_000_000_000_000_000_000n,
          taker: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          matchedPrice: 500000n,
          makerFee: 0n,
          takerFee: 0n,
          timestamp: Date.now(),
        },
      });

      await new Promise((r) => setTimeout(r, 0));

      expect(rpcMock).toHaveBeenCalledWith("release_user_balance", {
        p_user_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        p_amount: "0.5",
      });
    });

    it("should release reservation and include releasedUsdcMicro on cancelOrder", async () => {
      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "reserve_user_balance") return { data: [{ success: true }], error: null };
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });

      const query: any = {};
      query.update = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.in = vi.fn(() => query);
      supabaseAdminMock = { rpc: rpcMock, from: () => query };

      const wallet = ethers.Wallet.createRandom();
      const maker = wallet.address.toLowerCase();
      const salt = "90001";
      const marketKey = "80002:cancel";
      const outcomeIndex = 0;
      const chainId = 80002;
      const verifyingContract = "0x1234567890123456789012345678901234567890";

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook(marketKey, outcomeIndex);
      book.addOrder(
        createTestOrder({
          id: `${maker}-${salt}`,
          maker,
          isBuy: true,
          price: 500000n,
          remainingAmount: 1_000_000_000_000_000_000n,
          chainId,
          verifyingContract,
          salt,
          marketKey,
          outcomeIndex,
        })
      );

      const events: any[] = [];
      engine.on("market_event", (e) => events.push(e));

      const domain = {
        name: "Foresight Market",
        version: "1",
        chainId,
        verifyingContract: verifyingContract.toLowerCase(),
      };
      const types = {
        CancelSaltRequest: [
          { name: "maker", type: "address" },
          { name: "salt", type: "uint256" },
        ],
      };
      const signature = await wallet.signTypedData(domain, types as any, {
        maker,
        salt: BigInt(salt),
      });

      const res = await engine.cancelOrder(
        marketKey,
        outcomeIndex,
        chainId,
        verifyingContract,
        maker,
        salt,
        signature
      );
      expect(res.success).toBe(true);

      expect(rpcMock).toHaveBeenCalledWith("release_user_balance", {
        p_user_address: maker.toLowerCase(),
        p_amount: "0.5",
      });

      const canceled = events.find((e) => e?.type === "order_canceled");
      expect(canceled?.releasedUsdcMicro).toBe("500000");
    });

    it("should include releasedUsdcMicro on closeMarket order_canceled events", async () => {
      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "reserve_user_balance") return { data: [{ success: true }], error: null };
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });

      const maker = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const salt = "90001";
      const marketKey = "80002:close-market";
      const outcomeIndex = 0;

      const ordersQuery: any = {};
      ordersQuery.select = vi.fn(() => ordersQuery);
      ordersQuery.eq = vi.fn(() => ordersQuery);
      ordersQuery.in = vi.fn(() => ordersQuery);
      ordersQuery.limit = vi.fn(() =>
        Promise.resolve({
          data: [
            {
              maker_address: maker,
              maker_salt: salt,
              outcome_index: outcomeIndex,
              status: "open",
              is_buy: true,
              price: "500000",
              remaining: "1000000000000000000",
            },
          ],
          error: null,
        })
      );

      const updateQuery: any = {};
      updateQuery.update = vi.fn(() => updateQuery);
      updateQuery.eq = vi.fn(() => updateQuery);
      updateQuery.in = vi.fn(() => Promise.resolve({ data: null, error: null }));

      const fromMock = vi.fn((table: string) => {
        if (table === "orders") {
          const firstCall = (fromMock as any).mock.calls.length === 1;
          return firstCall ? ordersQuery : updateQuery;
        }
        return updateQuery;
      });

      supabaseAdminMock = { rpc: rpcMock, from: fromMock };

      const events: any[] = [];
      engine.on("market_event", (e) => events.push(e));

      await engine.closeMarket(marketKey);

      expect(rpcMock).toHaveBeenCalledWith("release_user_balance", {
        p_user_address: maker,
        p_amount: "0.5",
      });

      const id = `${maker}-${salt}`;
      const canceled = events.find((e) => e?.type === "order_canceled" && e?.orderId === id);
      expect(canceled?.releasedUsdcMicro).toBe("500000");
    });
  });

  describe("Order expiry", () => {
    it("should release reservation for expired non-top resting buy order on submitOrder", async () => {
      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        if (fn === "reserve_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });
      supabaseAdminMock = { rpc: rpcMock };

      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);
      (engine as any).checkBalanceAndRisk = vi.fn().mockResolvedValue({ valid: true });
      (engine as any).saveOrderToDb = vi.fn().mockResolvedValue(undefined);
      (engine as any).updateOrderStatus = vi.fn().mockResolvedValue(undefined);

      const manager = (engine as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:1", 0);
      const expiredBid = createTestOrder({
        id: "bid-expired",
        maker: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        isBuy: true,
        price: 500000n,
        remainingAmount: 1_000_000_000_000_000_000n,
        expiry: Math.floor(Date.now() / 1000) - 10,
      });
      const goodBid = createTestOrder({
        id: "bid-good",
        maker: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        isBuy: true,
        price: 600000n,
        remainingAmount: 1_000_000_000_000_000_000n,
        expiry: 0,
      });
      book.addOrder(expiredBid);
      book.addOrder(goodBid);

      const sellOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0xcccccccccccccccccccccccccccccccccccccccc",
        outcomeIndex: 0,
        isBuy: false,
        price: 700000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "91001",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "GTC",
      };

      const result = await engine.submitOrder(sellOrder);
      expect(result.success).toBe(true);

      expect(rpcMock).toHaveBeenCalledWith("release_user_balance", {
        p_user_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        p_amount: "0.5",
      });

      expect(book.hasOrder("bid-expired")).toBe(false);
    });

    it("should release reservation and mark expired during recoverFromDb", async () => {
      const rpcMock = vi.fn().mockImplementation(async (fn: string) => {
        if (fn === "release_user_balance") return { data: [{ success: true }], error: null };
        return { data: null, error: null };
      });

      const updateCalls: any[] = [];
      const eqCalls: any[] = [];
      const ordersRows: any[] = [
        {
          maker_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          maker_salt: "1",
          chain_id: 80002,
          verifying_contract: "0x2222222222222222222222222222222222222222",
          market_key: "80002:recover",
          outcome_index: 0,
          is_buy: true,
          price: "500000",
          amount: "1000000000000000000",
          remaining: "1000000000000000000",
          expiry: new Date(Date.now() - 60_000).toISOString(),
          signature: "0x",
          status: "open",
          sequence: "1",
          created_at: new Date().toISOString(),
        },
      ];

      const fromMock = vi.fn().mockImplementation((_table: string) => {
        let mode: "select" | "update" | null = null;
        const builder: any = {
          select: vi.fn().mockImplementation(() => {
            mode = "select";
            return builder;
          }),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((...args: any[]) => {
            eqCalls.push(args);
            return builder;
          }),
          update: vi.fn().mockImplementation((payload: any) => {
            mode = "update";
            updateCalls.push(payload);
            return builder;
          }),
          then: (resolve: any, reject: any) => {
            const out =
              mode === "select"
                ? { data: ordersRows, error: null }
                : mode === "update"
                  ? { data: null, error: null }
                  : { data: null, error: null };
            return Promise.resolve(out).then(resolve, reject);
          },
        };
        return builder;
      });

      supabaseAdminMock = { rpc: rpcMock, from: fromMock };

      await engine.recoverFromDb();

      expect(rpcMock).toHaveBeenCalledWith("release_user_balance", {
        p_user_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        p_amount: "0.5",
      });
      expect(updateCalls.some((c) => c && c.status === "expired")).toBe(true);

      const snapshot = engine.getOrderBookSnapshot("80002:recover", 0, 10);
      expect(snapshot).toBeNull();
      expect(eqCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Redis snapshot warmup", () => {
    it("should warm up an empty book from Redis snapshot once", async () => {
      redisReady = true;

      const marketKey = "80002:snapshot";
      const outcomeIndex = 0;
      const bidOrder: Order = {
        id: "0x1111111111111111111111111111111111111111-1",
        marketKey,
        maker: "0x1111111111111111111111111111111111111111",
        outcomeIndex,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        remainingAmount: 1_000_000_000_000_000_000n,
        salt: "1",
        expiry: 0,
        signature: "0x",
        chainId: 80002,
        verifyingContract: "0x2222222222222222222222222222222222222222",
        sequence: 7n,
        status: "open",
        createdAt: Date.now(),
      };

      loadSnapshotMock.mockResolvedValue({
        orders: [bidOrder],
        stats: {
          marketKey,
          outcomeIndex,
          lastTradePrice: 500000n,
          volume24h: 0n,
        },
      });

      await engine.warmupOrderBook(marketKey, outcomeIndex);
      await engine.warmupOrderBook(marketKey, outcomeIndex);

      expect(loadSnapshotMock).toHaveBeenCalledTimes(1);

      const snapshot = engine.getOrderBookSnapshot(marketKey, outcomeIndex, 10);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.bids.length).toBe(1);
      expect(snapshot!.bids[0].orders.length).toBe(1);
      expect(snapshot!.bids[0].orders[0].id).toBe(bidOrder.id);
    });

    it("should queue snapshots with throttling", () => {
      redisReady = true;
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-10T00:00:00.000Z"));

      const marketKey = "80002:throttle";
      const outcomeIndex = 0;
      const book = (engine as any).bookManager.getOrCreateBook(
        marketKey,
        outcomeIndex
      ) as OrderBook;

      const order: Order = {
        id: "0x3333333333333333333333333333333333333333-1",
        marketKey,
        maker: "0x3333333333333333333333333333333333333333",
        outcomeIndex,
        isBuy: true,
        price: 600000n,
        amount: 1_000_000_000_000_000_000n,
        remainingAmount: 1_000_000_000_000_000_000n,
        salt: "1",
        expiry: 0,
        signature: "0x",
        chainId: 80002,
        verifyingContract: "0x4444444444444444444444444444444444444444",
        sequence: 1n,
        status: "open",
        createdAt: Date.now(),
      };
      book.addOrder(order);

      (engine as any).emitDepthUpdate(book);
      expect(queuePublicSnapshotMock).toHaveBeenCalledTimes(1);
      expect(queueSnapshotMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500);
      (engine as any).emitDepthUpdate(book);
      expect(queuePublicSnapshotMock).toHaveBeenCalledTimes(1);
      expect(queueSnapshotMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(600);
      (engine as any).emitDepthUpdate(book);
      expect(queuePublicSnapshotMock).toHaveBeenCalledTimes(2);
      expect(queueSnapshotMock).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("Event log recovery", () => {
    it("should replay placed and canceled events into book state", async () => {
      const prevEnabled = process.env.RELAYER_MATCHING_EVENTLOG_ENABLED;
      process.env.RELAYER_MATCHING_EVENTLOG_ENABLED = "true";
      redisReady = true;

      const marketKey = "80002:eventlog";
      const outcomeIndex = 0;
      const order: Order = {
        id: "0x1111111111111111111111111111111111111111-99",
        marketKey,
        maker: "0x1111111111111111111111111111111111111111",
        outcomeIndex,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        remainingAmount: 1_000_000_000_000_000_000n,
        salt: "99",
        expiry: 0,
        signature: "0x",
        chainId: 80002,
        verifyingContract: "0x2222222222222222222222222222222222222222",
        sequence: 3n,
        status: "open",
        createdAt: Date.now(),
      };

      const payloadPlaced = JSON.stringify({ type: "order_placed", order }, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v
      );
      const payloadCanceled = JSON.stringify({
        type: "order_canceled",
        orderId: order.id,
        marketKey,
        outcomeIndex,
      });

      const envelopePlaced = JSON.stringify({
        ts: Date.now() - 10,
        type: "order_placed",
        marketKey,
        outcomeIndex: String(outcomeIndex),
        payload: payloadPlaced,
      });
      const envelopeCanceled = JSON.stringify({
        ts: Date.now(),
        type: "order_canceled",
        marketKey,
        outcomeIndex: String(outcomeIndex),
        payload: payloadCanceled,
      });

      lRangeMock.mockResolvedValue([envelopeCanceled, envelopePlaced]);

      const result = await engine.recoverFromEventLog();
      expect(result.replayed).toBe(2);

      const snapshot = engine.getOrderBookSnapshot(marketKey, outcomeIndex, 10);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.bids.length).toBe(0);

      process.env.RELAYER_MATCHING_EVENTLOG_ENABLED = prevEnabled;
    });

    it("should restore trade-derived stats for a book", async () => {
      const prevEnabled = process.env.RELAYER_MATCHING_EVENTLOG_ENABLED;
      process.env.RELAYER_MATCHING_EVENTLOG_ENABLED = "true";
      redisReady = true;

      const marketKey = "80002:eventlog-stats";
      const outcomeIndex = 1;
      const now = Date.now();
      const trade = {
        id: "match-1",
        matchId: "match-1",
        marketKey,
        outcomeIndex,
        maker: "0x1111111111111111111111111111111111111111",
        taker: "0x2222222222222222222222222222222222222222",
        makerOrderId: "m1",
        takerOrderId: "t1",
        makerSalt: "1",
        takerSalt: "2",
        isBuyerMaker: true,
        price: 700000n,
        amount: 3_000_000_000_000_000_000n,
        makerFee: 0n,
        takerFee: 0n,
        timestamp: now - 1000,
      };

      const payloadTrade = JSON.stringify({ type: "trade", trade }, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v
      );
      const envelopeTrade = JSON.stringify({
        ts: now,
        type: "trade",
        marketKey,
        outcomeIndex: String(outcomeIndex),
        payload: payloadTrade,
      });

      lRangeMock.mockResolvedValue([envelopeTrade]);

      await engine.recoverFromEventLog();
      const stats = engine.getOrderBookStats(marketKey, outcomeIndex);
      expect(stats).not.toBeNull();
      expect(stats!.lastTradePrice).toBe(700000n);
      expect(stats!.volume24h).toBe(3_000_000_000_000_000_000n);

      process.env.RELAYER_MATCHING_EVENTLOG_ENABLED = prevEnabled;
    });
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

    it("should reject order with invalid verifying contract address", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "12345",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "invalid",
      };
      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("verifying contract");
    });

    it("should reject order with invalid salt", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "not-a-number",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };
      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid salt");
    });

    it("should reject order with invalid chainId", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "12345",
        expiry: 0,
        signature: "0x1234",
        chainId: 0,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };
      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("chainId");
    });

    it("should reject order with invalid outcomeIndex", async () => {
      const order: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: -1,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "12345",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      };
      const result = await engine.submitOrder(order);
      expect(result.success).toBe(false);
      expect(result.error).toContain("outcomeIndex");
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
        tif: "BAD" as any,
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

      const fakResult = await engine.submitOrder({ ...common, tif: "FAK" });
      expect(fakResult.success).toBe(false);
      expect(fakResult.error).toContain("Post-only");
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
        salt: "10001",
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
        salt: "10002",
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
        salt: "20001",
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

    it("should execute FAK order and not leave resting quantity", async () => {
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

      const fakOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 600000n,
        amount: 2_000_000_000_000_000_000n,
        salt: "20003",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "FAK",
      };

      const result = await engine.submitOrder(fakOrder);
      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].matchedAmount).toBe(1_000_000_000_000_000_000n);
      expect(result.remainingOrder).toBeNull();
      expect(book.getOrderCount()).toBe(0);
    });

    it("should reject GTD order without expiry", async () => {
      (engine as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engine as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const gtdOrder: OrderInput = {
        marketKey: "80002:1",
        maker: "0x1234567890123456789012345678901234567890",
        outcomeIndex: 0,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "90001",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "GTD",
      };

      const result = await engine.submitOrder(gtdOrder);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("INVALID_EXPIRY");
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
        salt: "20002",
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
        salt: "30001",
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
        salt: "30002",
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

  describe("Self trade protection", () => {
    it("should not match against own resting order when enabled", async () => {
      const engineStp = new MatchingEngine({
        makerFeeBps: 0,
        takerFeeBps: 40,
        minOrderAmount: 1_000_000_000_000n,
        maxOrderAmount: 1_000_000_000_000_000_000_000n,
        enableSelfTradeProtection: true,
      });

      (engineStp as any).verifySignature = vi.fn().mockResolvedValue(true);
      (engineStp as any).checkOrderExists = vi.fn().mockResolvedValue(false);

      const maker = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const manager = (engineStp as any).bookManager as OrderBookManager;
      const book = manager.getOrCreateBook("80002:stp", 0);
      book.addOrder(
        createTestOrder({
          id: `${maker}-1`,
          marketKey: "80002:stp",
          maker,
          outcomeIndex: 0,
          isBuy: false,
          price: 500000n,
          remainingAmount: 1_000_000_000_000_000_000n,
        })
      );

      const result = await engineStp.submitOrder({
        marketKey: "80002:stp",
        maker,
        outcomeIndex: 0,
        isBuy: true,
        price: 600000n,
        amount: 1_000_000_000_000_000_000n,
        salt: "100",
        expiry: 0,
        signature: "0x1234",
        chainId: 80002,
        verifyingContract: "0x1234567890123456789012345678901234567890",
        tif: "IOC",
      });

      expect(result.success).toBe(true);
      expect(result.matches.length).toBe(0);
      expect(book.getOrderCount()).toBe(1);

      await engineStp.shutdown();
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
        salt: "40001",
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
        salt: "40002",
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

  describe("Market close", () => {
    it("should clear in-memory books and delete snapshots", async () => {
      redisReady = true;
      deleteOrderbookStateMock.mockResolvedValue({ full: true, public: true, stats: true });

      const marketKey = "80002:close-market";
      const outcomeIndex = 0;
      const book = (engine as any).bookManager.getOrCreateBook(
        marketKey,
        outcomeIndex
      ) as OrderBook;
      const order: Order = {
        id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1",
        marketKey,
        maker: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        outcomeIndex,
        isBuy: true,
        price: 500000n,
        amount: 1_000_000_000_000_000_000n,
        remainingAmount: 1_000_000_000_000_000_000n,
        salt: "1",
        expiry: 0,
        signature: "0x",
        chainId: 80002,
        verifyingContract: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sequence: 1n,
        status: "open",
        createdAt: Date.now(),
      };
      book.addOrder(order);

      const events: any[] = [];
      engine.on("market_event", (e) => events.push(e));

      const result = await engine.closeMarket(marketKey, { reason: "deadline passed" });
      expect(result.marketKey).toBe(marketKey);
      expect(result.outcomes).toEqual([0]);
      expect(result.clearedBooks).toBe(1);
      expect(result.canceledOrders).toBe(1);

      const snapshot = engine.getOrderBookSnapshot(marketKey, outcomeIndex, 10);
      expect(snapshot).toBeNull();

      expect(deleteOrderbookStateMock).toHaveBeenCalledTimes(1);
      expect(deleteOrderbookStateMock).toHaveBeenCalledWith(marketKey, outcomeIndex);

      expect(events.some((e) => e.type === "order_canceled")).toBe(true);
      expect(events.some((e) => e.type === "depth_update")).toBe(true);
      expect(events.some((e) => e.type === "stats_update")).toBe(true);
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
