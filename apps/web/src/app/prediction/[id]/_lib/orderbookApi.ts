import { API_BASE } from "./constants";
import { safeJson } from "./http";

export async function fetchOrderbookDepthApi(
  contract: string,
  chainId: number,
  marketKey: string,
  outcome: number
) {
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

export async function fetchUserOpenOrdersApi(
  contract: string,
  chainId: number,
  marketKey: string,
  maker: string
) {
  const q = `contract=${contract}&chainId=${chainId}&marketKey=${encodeURIComponent(
    marketKey
  )}&maker=${maker}&status=open`;
  const res = await fetch(`${API_BASE}/orderbook/orders?${q}`);
  const json = await safeJson(res);
  if ((json as any).success && (json as any).data) {
    return (json as any).data;
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
