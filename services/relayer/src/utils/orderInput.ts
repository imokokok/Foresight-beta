import { OrderInputSchema } from "../validation.js";
import type { OrderInput } from "../matching/index.js";

function pickString(...candidates: any[]): string {
  for (const c of candidates) {
    if (typeof c === "string") {
      const v = c.trim();
      if (v) return v;
      continue;
    }
    if (typeof c === "number") {
      if (Number.isFinite(c)) return String(c);
      continue;
    }
    if (typeof c === "bigint") return c.toString();
  }
  return "";
}

function toBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "y";
  }
  return false;
}

export function parseV2OrderInput(body: any): OrderInput {
  const root = body && typeof body === "object" ? body : {};
  const orderBody =
    (root.order || root.order_data) && typeof (root.order || root.order_data) === "object"
      ? root.order || root.order_data
      : {};

  const chainIdRaw = pickString(
    root.chainId,
    root.chain_id,
    orderBody.chainId,
    orderBody.chain_id,
    0
  );
  const chainId = Number(chainIdRaw);
  const marketKey = pickString(
    root.marketKey,
    root.market_key,
    `${pickString(
      root.chainId,
      root.chain_id,
      orderBody.chainId,
      orderBody.chain_id,
      0
    )}:${pickString(root.eventId, root.event_id, "unknown")}`
  );

  const verifyingContract = pickString(
    root.verifyingContract,
    orderBody.verifyingContract,
    root.verifying_contract,
    orderBody.verifying_contract,
    root.verifying_contract_address,
    orderBody.verifying_contract_address,
    root.contract,
    orderBody.contract,
    root.contractAddress,
    orderBody.contractAddress,
    root.marketAddress,
    orderBody.marketAddress
  );

  const tifRaw = pickString(orderBody.tif, root.tif);
  const tif = tifRaw ? (tifRaw.trim().toUpperCase() as any) : undefined;

  const normalized = {
    marketKey,
    maker: pickString(orderBody.maker, root.maker),
    outcomeIndex: Number(
      pickString(
        orderBody.outcomeIndex,
        orderBody.outcome_index,
        root.outcomeIndex,
        root.outcome_index,
        0
      )
    ),
    isBuy: toBool(orderBody.isBuy ?? orderBody.is_buy ?? root.isBuy ?? root.is_buy),
    price: pickString(orderBody.price, root.price),
    amount: pickString(orderBody.amount, root.amount),
    salt: pickString(orderBody.salt, root.salt),
    expiry: Number(pickString(orderBody.expiry, orderBody.expiresAt, root.expiry, 0)),
    signature: pickString(root.signature, orderBody.signature),
    chainId,
    verifyingContract,
    tif,
    postOnly:
      typeof (orderBody.postOnly ?? orderBody.post_only) !== "undefined"
        ? toBool(orderBody.postOnly ?? orderBody.post_only)
        : undefined,
    clientOrderId:
      typeof (orderBody.clientOrderId ?? orderBody.client_order_id ?? root.clientOrderId) ===
      "string"
        ? String(orderBody.clientOrderId ?? orderBody.client_order_id ?? root.clientOrderId)
        : undefined,
  };

  return OrderInputSchema.parse(normalized) as OrderInput;
}
