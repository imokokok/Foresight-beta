import { API_BASE, RELAYER_BASE } from "./constants";
import { safeJson } from "./http";

/**
 * 🚀 v2 API - 从 Relayer 内存订单簿获取深度 (更快)
 */
async function fetchDepthV2(marketKey: string, outcome: number) {
  if (!RELAYER_BASE) return null;

  try {
    const url = `${RELAYER_BASE}/v2/depth?marketKey=${encodeURIComponent(marketKey)}&outcome=${outcome}&levels=20`;
    const res = await fetch(url, {
      next: { revalidate: 1 },
      signal: AbortSignal.timeout(3000),
    });
    const json = await safeJson(res);

    if ((json as any).success && (json as any).data) {
      return {
        bids: (json as any).data.bids || [],
        asks: (json as any).data.asks || [],
      };
    }
  } catch (e) {
    console.warn("[orderbookApi] v2 depth failed, falling back to v1:", e);
  }
  return null;
}

/**
 * v1 API - 传统方式获取深度
 */
async function fetchDepthV1(contract: string, chainId: number, marketKey: string, outcome: number) {
  const qBuy = `contract=${contract}&chainId=${chainId}&marketKey=${encodeURIComponent(
    marketKey
  )}&outcome=${outcome}&side=true&levels=10`;
  const qSell = `contract=${contract}&chainId=${chainId}&marketKey=${encodeURIComponent(
    marketKey
  )}&outcome=${outcome}&side=false&levels=10`;

  const [r1, r2] = await Promise.all([
    fetch(`${API_BASE}/orderbook/depth?${qBuy}`),
    fetch(`${API_BASE}/orderbook/depth?${qSell}`),
  ]);
  const [j1, j2] = await Promise.all([safeJson(r1), safeJson(r2)]);

  return {
    buys: (j1 as any).data || [],
    sells: (j2 as any).data || [],
  };
}

/**
 * 获取订单簿深度 - 优先使用 v2 API，失败时 fallback 到 v1
 */
export async function fetchOrderbookDepthApi(
  contract: string,
  chainId: number,
  marketKey: string,
  outcome: number
) {
  // 尝试 v2 API (更快)
  const v2Result = await fetchDepthV2(marketKey, outcome);
  if (v2Result) {
    return {
      buys: v2Result.bids,
      sells: v2Result.asks,
    };
  }

  // Fallback 到 v1 API
  return fetchDepthV1(contract, chainId, marketKey, outcome);
}

export async function fetchUserOpenOrdersApi(
  contract: string,
  chainId: number,
  marketKey: string,
  maker: string
) {
  const q = `contract=${contract}&chainId=${chainId}&marketKey=${encodeURIComponent(
    marketKey
  )}&maker=${maker}&status=all`;
  const res = await fetch(`${API_BASE}/orderbook/orders?${q}`);
  const json = await safeJson(res);
  if ((json as any).success && (json as any).data) {
    const rows = (json as any).data as any[];
    return rows.filter(
      (row) =>
        row &&
        (row.status === "open" ||
          row.status === "filled_partial" ||
          row.status === "partially_filled")
    );
  }
  return [];
}

export async function fetchTradesApi(contract: string, chainId: number) {
  const q = `contract=${contract}&chainId=${chainId}&limit=50`;
  const res = await fetch(`${API_BASE}/orderbook/trades?${q}`);
  const json = await safeJson(res);
  if ((json as any).success && (json as any).data) {
    return (json as any).data;
  }
  return [];
}

// ============ v2 API (直连 Relayer，更快) ============

export interface OrderSubmitInput {
  marketKey: string;
  outcomeIndex: number;
  isBuy: boolean;
  price: string;
  amount: string;
  maker: string;
  signature: string;
  salt: string;
  expiry: number;
}

/**
 * 🚀 v2 订单提交 - 直接提交到 Relayer 撮合引擎
 * 优点：
 * - 更快的响应速度（跳过 Next.js API 层）
 * - 立即进入撮合流程
 * - 返回匹配结果
 */
export async function submitOrderV2(order: OrderSubmitInput): Promise<{
  success: boolean;
  orderId?: string;
  matched?: boolean;
  matchedAmount?: string;
  error?: string;
}> {
  if (!RELAYER_BASE) {
    return { success: false, error: "Relayer not configured" };
  }

  try {
    const res = await fetch(`${RELAYER_BASE}/v2/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(5000),
    });

    const json = await safeJson(res);

    if ((json as any).success) {
      return {
        success: true,
        orderId: (json as any).data?.orderId,
        matched: (json as any).data?.matched,
        matchedAmount: (json as any).data?.matchedAmount,
      };
    }

    return {
      success: false,
      error: (json as any).message || "Order submission failed",
    };
  } catch (e: any) {
    console.error("[orderbookApi] v2 order submit failed:", e);
    return {
      success: false,
      error: e.message || "Network error",
    };
  }
}

/**
 * 🚀 v2 市场统计 - 获取最佳买卖价、成交量等
 */
export async function fetchMarketStatsV2(
  marketKey: string,
  outcomeIndex: number
): Promise<{
  bestBid: string | null;
  bestAsk: string | null;
  spread: string | null;
  bidDepth: string;
  askDepth: string;
  lastTradePrice: string | null;
  volume24h: string;
} | null> {
  if (!RELAYER_BASE) return null;

  try {
    const url = `${RELAYER_BASE}/v2/stats?marketKey=${encodeURIComponent(marketKey)}&outcomeIndex=${outcomeIndex}`;
    const res = await fetch(url, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(3000),
    });
    const json = await safeJson(res);

    if ((json as any).success && (json as any).data) {
      return (json as any).data;
    }
  } catch (e) {
    console.warn("[orderbookApi] v2 stats failed:", e);
  }
  return null;
}

/**
 * 获取 WebSocket 连接信息
 */
export async function getWsInfo(): Promise<{
  wsPort: number;
  connections: number;
  subscriptions: number;
  channels: string[];
} | null> {
  if (!RELAYER_BASE) return null;

  try {
    const res = await fetch(`${RELAYER_BASE}/v2/ws-info`);
    const json = await safeJson(res);

    if ((json as any).success && (json as any).data) {
      return (json as any).data;
    }
  } catch (e) {
    console.warn("[orderbookApi] Failed to get WS info:", e);
  }
  return null;
}
