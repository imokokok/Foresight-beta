import type { Order, MatchResult } from "./types.js";
import type { OrderBook } from "./orderBook.js";
import { supabaseAdmin } from "../supabase.js";
import { releaseUsdcReservation } from "./riskManagement.js";

/**
 * 保存订单到数据库
 */
export async function saveOrderToDb(order: Order): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from("orders").insert({
      id: order.id,
      chain_id: order.chainId,
      verifying_contract: order.verifyingContract,
      market_key: order.marketKey,
      outcome_index: order.outcomeIndex,
      maker_address: order.maker,
      maker_salt: String(order.salt),
      is_buy: order.isBuy,
      price: String(order.price),
      amount: String(order.amount),
      remaining: String(order.remainingAmount),
      status: order.status,
      expiry: order.expiry,
      signature: order.signature,
      created_at: new Date(order.createdAt).toISOString(),
      updated_at: new Date(order.createdAt).toISOString(),
      client_order_id: (order as any).clientOrderId || null,
      post_only: order.postOnly,
      tif: order.tif || "GTC",
    });
  } catch (error) {
    console.error("[OrderManagement] Failed to save order to DB", error);
  }
}

/**
 * 更新数据库中的订单
 */
export async function updateOrderInDb(
  order: Order,
  newStatus?: string,
  settlementStatus?: string
): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const updates: Record<string, any> = {
      remaining: String(order.remainingAmount),
      status: newStatus || order.status,
      updated_at: new Date().toISOString(),
    };
    if (settlementStatus) {
      updates.settlement_status = settlementStatus;
    }

    await supabaseAdmin.from("orders").update(updates).eq("id", order.id);
  } catch (error) {
    console.error("[OrderManagement] Failed to update order in DB", error);
  }
}

/**
 * 更新订单状态
 */
export async function updateOrderStatus(order: any, status: string): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("chain_id", order.chainId)
      .eq("verifying_contract", order.verifyingContract)
      .eq("maker_address", order.maker)
      .eq("maker_salt", String(order.salt));
  } catch (error) {
    console.error("[OrderManagement] Failed to update order status", error);
  }
}

/**
 * 添加订单到订单簿
 */
export async function addToOrderBook(
  order: Order,
  bookManager: any,
  emitEvent: (event: any) => void,
  emitDepthUpdate: (book: OrderBook) => void
): Promise<void> {
  const book = bookManager.getOrCreateBook(order.marketKey, order.outcomeIndex);
  book.addOrder(order);

  // 持久化到数据库
  await saveOrderToDb(order);

  // 广播事件
  emitEvent({ type: "order_placed", order });
  emitDepthUpdate(book);
}

/**
 * 检查订单是否过期
 */
export function isExpired(order: Order): boolean {
  if (order.expiry === 0) return false;
  return Math.floor(Date.now() / 1000) >= order.expiry;
}

/**
 * 计算订单的USDC价值
 */
export function orderNotionalUsdc(amount: bigint, price: bigint): bigint {
  if (amount <= 0n || price <= 0n) return 0n;
  return (amount * price) / 1_000_000_000_000_000_000n;
}

/**
 * 处理订单簿中的过期订单
 */
export async function expireOrdersInBook(
  marketKey: string,
  outcomeIndex: number,
  bookManager: any,
  emitDepthUpdate: (book: OrderBook) => void
): Promise<number> {
  const book = bookManager.getBook(marketKey, outcomeIndex);
  if (!book) return 0;

  const { bidOrders, askOrders } = book.getAllOrders();
  const allOrders = [...bidOrders, ...askOrders];
  if (allOrders.length === 0) return 0;

  let expiredCount = 0;
  const releaseByMaker = new Map<string, bigint>();
  const updates: Array<{
    chainId: number;
    verifyingContract: string;
    maker: string;
    salt: bigint;
    isBuy: boolean;
    remainingAmount: bigint;
    price: bigint;
  }> = [];

  for (const o of allOrders) {
    if (!isExpired(o)) continue;
    const removed = book.removeOrder(o.id);
    if (!removed) continue;
    expiredCount += 1;
    updates.push(removed);
    if (removed.isBuy) {
      const micro = orderNotionalUsdc(removed.remainingAmount, removed.price);
      if (micro > 0n) {
        const maker = removed.maker.toLowerCase();
        releaseByMaker.set(maker, (releaseByMaker.get(maker) || 0n) + micro);
      }
    }
  }

  if (expiredCount === 0) return 0;

  if (supabaseAdmin) {
    for (const o of updates) {
      await updateOrderStatus(o, "expired");
    }

    if (releaseByMaker.size > 0) {
      const releasePromises = Array.from(releaseByMaker.entries()).map(async ([maker, micro]) => {
        try {
          await releaseUsdcReservation(maker, micro);
        } catch (error) {
          console.error(
            `[OrderManagement] Failed to release USDC reservation for ${maker}:`,
            error
          );
        }
      });
      await Promise.all(releasePromises);
    }
  }

  emitDepthUpdate(book);
  return expiredCount;
}
