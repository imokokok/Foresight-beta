import { randomUUID } from "crypto";
import type { Order, Match, MatchResult, Trade } from "./types.js";
import type { OrderBook } from "./orderBook.js";
import type { BatchSettler } from "../settlement/index.js";
import type { SettlementFill } from "../settlement/index.js";
import { updateOrderInDb, updateOrderStatus, orderNotionalUsdc } from "./orderManagement.js";
import { releaseUsdcReservation } from "./riskManagement.js";

/**
 * 生成匹配ID
 */
export function generateMatchId(): string {
  return `match-${randomUUID()}`;
}

/**
 * 检查价格是否匹配
 */
export function pricesMatch(takerOrder: Order, makerOrder: Order): boolean {
  if (takerOrder.isBuy) {
    // Taker 买入: Taker价格 >= Maker价格 (愿意付更高价)
    return takerOrder.price >= makerOrder.price;
  } else {
    // Taker 卖出: Taker价格 <= Maker价格 (愿意接受更低价)
    return takerOrder.price <= makerOrder.price;
  }
}

/**
 * 计算手续费 (四舍五入)
 */
export function calculateFees(
  amount: bigint,
  price: bigint,
  makerFeeBps: number,
  takerFeeBps: number
): { makerFee: bigint; takerFee: bigint } {
  const cost = (amount * price) / 1_000_000_000_000_000_000n;

  const makerFee = (cost * BigInt(makerFeeBps) + 5000n) / 10000n;
  const takerFee = (cost * BigInt(takerFeeBps) + 5000n) / 10000n;

  return { makerFee, takerFee };
}

/**
 * 将匹配结果转换为交易对象
 */
export function matchToTrade(match: Match): Trade {
  return {
    id: match.id,
    matchId: match.id,
    marketKey: match.makerOrder.marketKey,
    outcomeIndex: match.makerOrder.outcomeIndex,
    maker: match.makerOrder.maker,
    taker: match.takerOrder.maker,
    amount: match.matchedAmount,
    price: match.matchedPrice,
    makerFee: match.makerFee,
    takerFee: match.takerFee,
    timestamp: match.timestamp,
    makerOrderId: match.makerOrder.id,
    takerOrderId: match.takerOrder.id,
    makerSalt: match.makerOrder.salt,
    takerSalt: match.takerOrder.salt,
    isBuyerMaker: match.makerOrder.isBuy,
  };
}

/**
 * 核心撮合逻辑 - 价格时间优先
 */
export async function matchOrder(
  incomingOrder: Order,
  book: OrderBook,
  batchSettlers: Map<string, BatchSettler>,
  config: any,
  emitEvent: (event: any) => void,
  emitDepthUpdate: (book: OrderBook) => void
): Promise<MatchResult> {
  const matches: Match[] = [];

  let order = { ...incomingOrder };

  // 检查FOK订单
  if (order.tif === "FOK") {
    const depth = book.getDepthSnapshot(1000);
    let required = order.amount;
    if (order.isBuy) {
      for (const level of depth.asks) {
        if (order.price < level.price) break;
        let available = level.totalQuantity;
        if (config.enableSelfTradeProtection) {
          const excluded = order.maker;
          available = 0n;
          for (const o of level.orders) {
            if (o.remainingAmount <= 0n) continue;
            if (o.maker === excluded) continue;
            available += o.remainingAmount;
          }
        }
        required -= available;
        if (required <= 0n) break;
      }
    } else {
      for (const level of depth.bids) {
        if (order.price > level.price) break;
        let available = level.totalQuantity;
        if (config.enableSelfTradeProtection) {
          const excluded = order.maker;
          available = 0n;
          for (const o of level.orders) {
            if (o.remainingAmount <= 0n) continue;
            if (o.maker === excluded) continue;
            available += o.remainingAmount;
          }
        }
        required -= available;
        if (required <= 0n) break;
      }
    }
    if (required > 0n) {
      order.status = "canceled";
      return {
        success: true,
        matches,
        remainingOrder: null,
      };
    }
  }

  // 开始撮合循环
  while (order.remainingAmount > 0n) {
    // 获取对手盘最优订单
    const counterOrder = config.enableSelfTradeProtection
      ? book.getBestCounterOrder(order.isBuy, order.maker)
      : book.getBestCounterOrder(order.isBuy);

    if (!counterOrder) {
      // 没有对手盘,停止撮合
      break;
    }

    // 检查价格是否匹配
    if (!pricesMatch(order, counterOrder)) {
      break;
    }

    // 检查订单是否过期
    if (isExpired(counterOrder)) {
      if (counterOrder.isBuy) {
        await releaseUsdcReservation(
          counterOrder.maker,
          orderNotionalUsdc(counterOrder.remainingAmount, counterOrder.price)
        );
      }
      book.removeOrder(counterOrder.id);
      await updateOrderStatus(counterOrder, "expired");
      emitDepthUpdate(book);
      continue;
    }

    // 计算成交量 (取两者剩余量的较小值)
    const matchAmount =
      order.remainingAmount < counterOrder.remainingAmount
        ? order.remainingAmount
        : counterOrder.remainingAmount;

    // 成交价格使用 Maker 价格 (挂单方价格)
    const matchPrice = counterOrder.price;

    // 计算手续费
    const { makerFee, takerFee } = calculateFees(
      matchAmount,
      matchPrice,
      config.makerFeeBps,
      config.takerFeeBps
    );

    // 创建撮合记录
    const match: Match = {
      id: generateMatchId(),
      makerOrder: counterOrder,
      takerOrder: order,
      matchedAmount: matchAmount,
      matchedPrice: matchPrice,
      makerFee,
      takerFee,
      timestamp: Date.now(),
    };

    matches.push(match);

    // 🚀 发送到批量结算器
    const settler = batchSettlers.get(order.marketKey);
    if (settler) {
      const settlementFill: SettlementFill = {
        id: match.id,
        order: {
          maker: counterOrder.maker,
          outcomeIndex: counterOrder.outcomeIndex,
          isBuy: counterOrder.isBuy,
          price: counterOrder.price,
          amount: counterOrder.amount,
          salt: BigInt(counterOrder.salt),
          expiry: BigInt(counterOrder.expiry),
        },
        signature: counterOrder.signature,
        fillAmount: matchAmount,
        taker: order.maker, // Taker 是 incoming order 的 maker
        matchedPrice: matchPrice,
        makerFee,
        takerFee,
        timestamp: Date.now(),
      };
      settler.addFill(settlementFill);
    }

    // 更新订单剩余量
    order.remainingAmount -= matchAmount;
    counterOrder.remainingAmount -= matchAmount;

    // 更新订单簿中的对手订单
    if (counterOrder.remainingAmount === 0n) {
      book.removeOrder(counterOrder.id);
      counterOrder.status = "filled";
    } else {
      book.updateOrder(counterOrder);
      counterOrder.status = "partially_filled";
    }

    // 记录成交
    book.recordTrade(matchPrice, matchAmount);

    // 持久化订单状态
    await updateOrderInDb(counterOrder, counterOrder.status, "pending");

    emitEvent({ type: "order_updated", order: counterOrder });

    // 广播订单簿更新
    emitDepthUpdate(book);
  }

  // 处理不同的订单类型
  if (order.tif === "IOC" || order.tif === "FOK" || order.tif === "FAK") {
    if (order.remainingAmount === 0n) {
      order.status = "filled";
    } else if (matches.length === 0) {
      order.status = "canceled";
    } else {
      order.status = "partially_filled";
    }
    if (order.status === "partially_filled" || order.status === "filled") {
      await updateOrderInDb(order, order.status, "pending");
    }
    return {
      success: true,
      matches,
      remainingOrder: null,
    };
  } else {
    if (order.remainingAmount === 0n) {
      order.status = "filled";
    } else if (order.remainingAmount < incomingOrder.amount) {
      order.status = "partially_filled";
    } else {
      order.status = "open";
    }
    if (order.remainingAmount > 0n) {
      await updateOrderInDb(order, order.status, "pending");
    }
    return {
      success: true,
      matches,
      remainingOrder: order.remainingAmount > 0n ? order : null,
    };
  }
}

/**
 * 检查订单是否过期
 */
function isExpired(order: Order): boolean {
  if (order.expiry === 0) return false;
  return Math.floor(Date.now() / 1000) >= order.expiry;
}
