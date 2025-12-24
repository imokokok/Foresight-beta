import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getClient, supabaseAdmin } from "@/lib/supabase";
import { successResponse, ApiResponses } from "@/lib/apiResponse";
import { validateOrderParams, verifyOrderSignature, isOrderExpired } from "@/lib/orderVerification";
import type { EIP712Order } from "@/types/market";

function getRelayerBaseUrl(): string | undefined {
  const raw = (process.env.RELAYER_URL || process.env.NEXT_PUBLIC_RELAYER_URL || "").trim();
  if (!raw) return undefined;
  if (!/^https?:\/\//i.test(raw)) return undefined;
  return raw;
}

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId");
    const contract = searchParams.get("contract");
    const marketKey = searchParams.get("marketKey") || searchParams.get("market_key");
    const maker = searchParams.get("maker");
    const status = searchParams.get("status") || "open";

    let base = client.from("orders").select("*");

    if (chainId) base = base.eq("chain_id", chainId);
    if (contract) base = base.eq("verifying_contract", contract.toLowerCase());
    if (maker) base = base.eq("maker_address", maker.toLowerCase());
    if (status && status !== "all") base = base.eq("status", status);

    const run = async (useMarketKey: boolean) => {
      let q = base;
      if (useMarketKey && marketKey) q = q.eq("market_key", marketKey);
      return q.order("created_at", { ascending: false });
    };

    let { data, error } = await run(true);

    if (error && marketKey) {
      const code = (error as any).code;
      const msg = String((error as any).message || "");
      if (code === "42703" || /market_key/i.test(msg)) {
        ({ data, error } = await run(false));
      }
    }

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const body = (() => {
      try {
        return rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return {};
      }
    })();

    const relayerBase = getRelayerBaseUrl();
    if (relayerBase) {
      const url = new URL("/orderbook/orders", relayerBase);
      const relayerRes = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody || "{}",
      });
      const relayerJson = await relayerRes.json().catch(() => null);
      return NextResponse.json(relayerJson ?? { message: "invalid relayer response" }, {
        status: relayerRes.status,
      });
    }

    const client = supabaseAdmin || getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const {
      chainId,
      verifyingContract,
      contract,
      order,
      signature,
      marketKey,
      market_key,
      eventId,
      event_id,
    } = body;

    const vcRaw = (verifyingContract || contract || "").toString();
    const vc = vcRaw.trim();

    if (!chainId || !vc || !order || !signature) {
      return ApiResponses.invalidParameters("Missing required fields");
    }

    const chainIdNum = Number(chainId);
    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
      return ApiResponses.badRequest("Invalid chainId");
    }

    if (!ethers.isAddress(vc)) {
      return ApiResponses.badRequest("Invalid contract address");
    }

    const orderData: EIP712Order = {
      maker: order.maker,
      outcomeIndex: Number(order.outcomeIndex),
      isBuy: Boolean(order.isBuy),
      price: String(order.price),
      amount: String(order.amount),
      salt: String(order.salt),
      expiry: Number(order.expiry || 0),
    };

    const mkRaw = (marketKey || market_key || "").toString().trim();
    const eid = Number(eventId ?? event_id);
    const derivedMk = Number.isFinite(eid) && eid > 0 ? `${chainIdNum}:${eid}` : "";
    const mk = (mkRaw || derivedMk).trim() || undefined;

    const paramsValidation = validateOrderParams(orderData);
    if (!paramsValidation.valid) {
      if (isOrderExpired(orderData.expiry)) {
        console.warn("Order validation failed: expired", paramsValidation.error);
        return ApiResponses.orderExpired(paramsValidation.error || "Order expired");
      }
      console.warn("Order validation failed: params", paramsValidation.error);
      return ApiResponses.badRequest(paramsValidation.error || "Invalid order parameters");
    }

    const signatureValidation = await verifyOrderSignature(orderData, signature, chainIdNum, vc);
    if (!signatureValidation.valid) {
      console.warn("Order validation failed: signature", signatureValidation.error);
      return ApiResponses.invalidSignature(signatureValidation.error || "Invalid order signature");
    }

    // 检查订单是否已存在（防止重复提交）
    const { data: existingOrder } = await client
      .from("orders")
      // @ts-ignore
      .select("id, market_key")
      .eq("chain_id", chainIdNum)
      .eq("verifying_contract", vc.toLowerCase())
      .eq("maker_address", orderData.maker.toLowerCase())
      .eq("maker_salt", orderData.salt)
      .maybeSingle();

    if (existingOrder) {
      // @ts-ignore
      const existingMk = (existingOrder as any).market_key
        ? String((existingOrder as any).market_key)
        : "";
      if (mk && existingMk && existingMk !== mk) {
        return ApiResponses.conflict(
          "Salt conflict: existing order uses same salt with different marketKey"
        );
      }
      return ApiResponses.conflict("Order already exists with the same salt");
    }

    // 转换过期时间
    const expiryTs = orderData.expiry > 0 ? new Date(orderData.expiry * 1000) : null;

    // 插入订单
    const insertRow: Record<string, any> = {
      chain_id: chainIdNum,
      verifying_contract: vc.toLowerCase(),
      maker_address: orderData.maker.toLowerCase(),
      outcome_index: orderData.outcomeIndex,
      is_buy: orderData.isBuy,
      price: orderData.price,
      amount: orderData.amount,
      remaining: orderData.amount,
      expiry: expiryTs,
      maker_salt: orderData.salt,
      signature: signature,
      status: "open",
    };
    if (mk) insertRow.market_key = mk;

    const tryInsert = async (row: Record<string, any>) =>
      (client.from("orders") as any).insert(row);
    let { error: insertError } = await tryInsert(insertRow);
    if (insertError) {
      const msg = String((insertError as any).message || "");
      const code = String((insertError as any).code || "");
      const isDup = code === "23505" || /duplicate key/i.test(msg);
      if (isDup) return ApiResponses.conflict("Order already exists with the same salt");
      if (mk && /market_key/i.test(msg)) {
        delete insertRow.market_key;
        ({ error: insertError } = await tryInsert(insertRow));
      }
    }

    if (insertError) {
      console.error("Error creating order:", insertError);
      return ApiResponses.databaseError("Failed to create order", insertError.message);
    }

    return successResponse({ orderId: orderData.salt }, "Order created successfully");
  } catch (e: any) {
    console.error("Create Order API error:", e);
    return ApiResponses.internalError(
      "Failed to create order",
      process.env.NODE_ENV === "development" ? e.message : undefined
    );
  }
}
