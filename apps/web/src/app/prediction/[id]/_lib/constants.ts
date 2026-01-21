export const API_BASE = "/api";

/**
 * Relayer HTTP API 地址
 * 用于订单提交、深度查询等 HTTP 请求
 *
 * 环境变量: NEXT_PUBLIC_RELAYER_URL
 * 示例: http://localhost:3005
 */
export const RELAYER_BASE = process.env.NEXT_PUBLIC_RELAYER_URL || "";

/**
 * Relayer WebSocket 地址
 * 用于实时订阅深度、成交等数据
 *
 * 环境变量: NEXT_PUBLIC_WS_URL
 * 示例: ws://localhost:3006
 */
export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "";

export function buildMarketKey(chainId: number, eventId: string | number) {
  return `${chainId}:${eventId}`;
}
