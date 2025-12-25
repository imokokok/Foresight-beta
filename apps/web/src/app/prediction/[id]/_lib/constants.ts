export const API_BASE = "/api";
export const RELAYER_BASE = process.env.NEXT_PUBLIC_RELAYER_URL || "";

export function buildMarketKey(chainId: number, eventId: string | number) {
  return `${chainId}:${eventId}`;
}
