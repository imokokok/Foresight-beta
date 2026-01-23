import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase.server";
import type { Database } from "@/lib/database.types";
import { successResponse, ApiResponses, proxyJsonResponse } from "@/lib/apiResponse";
import { validateOrderParams, verifyOrderSignature, isOrderExpired } from "@/lib/orderVerification";
import type { EIP712Order } from "@/types/market";
import { getRelayerBaseUrl, getSessionAddress, logApiError, logApiEvent } from "@/lib/serverUtils";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { getConfiguredRpcUrl } from "@/lib/runtimeConfig";

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type DbClient = SupabaseClient<Database>;

export async function GET(req: NextRequest) {
  try {
    const client: DbClient | null = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId");
    const contract = searchParams.get("contract");
    const marketKey = searchParams.get("marketKey") || searchParams.get("market_key");
    const maker = searchParams.get("maker");
    const status = searchParams.get("status") || "open";

    let base = client.from("orders").select("*");

    if (chainId) {
      const chainIdNum = Number(chainId);
      if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
        return ApiResponses.badRequest("Invalid chainId");
      }
      base = base.eq("chain_id", chainIdNum);
    }
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
      const pgError = error as PostgrestError;
      const code = pgError.code;
      const msg = String(pgError.message || "");
      if (code === "42703" || /market_key/i.test(msg)) {
        ({ data, error } = await run(false));
      }
    }

    if (error) {
      return ApiResponses.databaseError("Failed to fetch orders", error.message);
    }

    return successResponse(data);
  } catch (e: unknown) {
    logApiError("GET /api/orderbook/orders", e);
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "Failed to fetch orders",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limit
    const ip = getIP(req);
    const limitResult = await checkRateLimit(ip, RateLimits.relaxed, "create_order_ip");
    if (!limitResult.success) {
      try {
        await logApiEvent("order_create_rate_limited", {
          ip: ip ? String(ip).split(".").slice(0, 2).join(".") + ".*.*" : "",
        });
      } catch {}
      return ApiResponses.rateLimit("Too many requests from this IP");
    }

    const ownerEoa = await getSessionAddress(req);

    const rawBody = await req.text();
    const body = (() => {
      try {
        return rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return {};
      }
    })();
    if (ownerEoa && !body?.owner_eoa && !body?.ownerEoa) {
      (body as any).owner_eoa = ownerEoa;
    }

    const relayerBase = getRelayerBaseUrl();
    if (relayerBase) {
      const url = new URL("/orderbook/orders", relayerBase);
      const relayerRes = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      try {
        await logApiEvent(relayerRes.ok ? "order_create_proxy_ok" : "order_create_proxy_fail", {
          status: relayerRes.status,
        });
      } catch {}
      return proxyJsonResponse(relayerRes, {
        successMessage: "ok",
        errorMessage: "Relayer request failed",
      });
    }

    const client: DbClient | null = supabaseAdmin as any;
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
      try {
        await logApiEvent("order_create_invalid_params", { hasChainId: !!chainId, hasVc: !!vc });
      } catch {}
      return ApiResponses.invalidParameters("Missing required fields");
    }

    const chainIdNum = Number(chainId);
    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
      try {
        await logApiEvent("order_create_invalid_chain", { chainId });
      } catch {}
      return ApiResponses.badRequest("Invalid chainId");
    }

    if (!ethers.isAddress(vc)) {
      try {
        await logApiEvent("order_create_invalid_contract", { contract: vc });
      } catch {}
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

    const marketKeyRaw = String(mk || "").trim();
    const [mkChain, mkEvent] = marketKeyRaw.split(":");
    const mkEventId = Number(mkEvent);
    const mkChainId = Number(mkChain);
    let marketStatus: string | null = null;
    let marketResolutionTime: string | null = null;
    let marketStatusError: string | null = null;

    if (Number.isFinite(mkEventId) && Number.isFinite(mkChainId)) {
      const { data, error } = await (client as any)
        .from("markets_map")
        .select("status,resolution_time")
        .eq("event_id", mkEventId)
        .eq("chain_id", mkChainId)
        .limit(1)
        .maybeSingle();
      if (error) marketStatusError = error.message;
      if (data?.status != null) marketStatus = String(data.status);
      if (data?.resolution_time != null) marketResolutionTime = String(data.resolution_time);
    } else {
      const { data, error } = await (client as any)
        .from("markets_map")
        .select("status,resolution_time")
        .eq("market", vc.toLowerCase())
        .eq("chain_id", chainIdNum)
        .limit(1)
        .maybeSingle();
      if (error) marketStatusError = error.message;
      if (data?.status != null) marketStatus = String(data.status);
      if (data?.resolution_time != null) marketResolutionTime = String(data.resolution_time);
    }

    if (marketStatusError) {
      return ApiResponses.databaseError("Failed to fetch market status", marketStatusError);
    }

    if (marketStatus && marketStatus.toLowerCase() !== "open") {
      return ApiResponses.marketClosed("Market closed");
    }

    if (marketResolutionTime) {
      const resolutionAt = new Date(marketResolutionTime).getTime();
      if (Number.isFinite(resolutionAt) && resolutionAt > 0 && resolutionAt <= Date.now()) {
        return ApiResponses.marketClosed("Market closed");
      }
    }

    const paramsValidation = validateOrderParams(orderData);
    if (!paramsValidation.valid) {
      if (isOrderExpired(orderData.expiry)) {
        console.warn("Order validation failed: expired", paramsValidation.error);
        try {
          await logApiEvent("order_create_expired", { maker: orderData.maker.slice(0, 8) });
        } catch {}
        return ApiResponses.orderExpired(paramsValidation.error || "Order expired");
      }
      console.warn("Order validation failed: params", paramsValidation.error);
      try {
        await logApiEvent("order_create_invalid", { reason: paramsValidation.error || "" });
      } catch {}
      return ApiResponses.badRequest(paramsValidation.error || "Invalid order parameters");
    }

    const provider = new ethers.JsonRpcProvider(getConfiguredRpcUrl(chainIdNum));
    // Do not pass ownerEoa to enforce EIP-1271 check if maker is a contract (Proxy Wallet)
    // If maker is EOA, recovered address must match maker.
    // If maker is Proxy, recovered address (Owner) will mismatch, triggering EIP-1271 check on Proxy.
    const signatureValidation = await verifyOrderSignature(orderData, signature, chainIdNum, vc, {
      provider,
    });
    if (!signatureValidation.valid) {
      console.warn("Order validation failed: signature", signatureValidation.error);
      try {
        await logApiEvent("order_create_invalid_signature", {
          reason: signatureValidation.error || "",
        });
      } catch {}
      return ApiResponses.invalidSignature(signatureValidation.error || "Invalid order signature");
    }

    const existingRes = await client
      .from("orders")
      .select("id, market_key")
      .eq("chain_id", chainIdNum)
      .eq("verifying_contract", vc.toLowerCase())
      .eq("maker_address", orderData.maker.toLowerCase())
      .eq("maker_salt", orderData.salt)
      .maybeSingle();

    const existingOrder =
      (existingRes.data as { id?: number; market_key?: unknown } | null) ?? null;

    if (existingOrder) {
      const existingMk = existingOrder.market_key ? String(existingOrder.market_key) : "";
      if (mk && existingMk && existingMk !== mk) {
        return ApiResponses.conflict(
          "Salt conflict: existing order uses same salt with different marketKey"
        );
      }
      return ApiResponses.conflict("Order already exists with the same salt");
    }

    const expiryIso = orderData.expiry > 0 ? new Date(orderData.expiry * 1000).toISOString() : null;

    const insertRow: OrderInsert = {
      chain_id: chainIdNum,
      verifying_contract: vc.toLowerCase(),
      maker_address: orderData.maker.toLowerCase(),
      outcome_index: orderData.outcomeIndex,
      is_buy: orderData.isBuy,
      price: orderData.price,
      amount: orderData.amount,
      remaining: orderData.amount,
      expiry: expiryIso,
      maker_salt: orderData.salt,
      signature: signature,
      status: "open",
    };
    if (mk) insertRow.market_key = mk;

    const tryInsert = async (row: OrderInsert) => client.from("orders").insert(row as never);
    let { error: insertError } = await tryInsert(insertRow);
    if (insertError) {
      const pgError = insertError as PostgrestError;
      const msg = String(pgError.message || "");
      const code = String(pgError.code || "");
      const isDup = code === "23505" || /duplicate key/i.test(msg);
      if (isDup) return ApiResponses.conflict("Order already exists with the same salt");
      if (mk && /market_key/i.test(msg)) {
        const fallbackRow: OrderInsert = { ...insertRow, market_key: undefined };
        ({ error: insertError } = await tryInsert(fallbackRow));
      }
    }

    if (insertError) {
      console.error("Error creating order:", insertError);
      try {
        await logApiEvent("order_create_db_error", { code: (insertError as any)?.code || "" });
      } catch {}
      return ApiResponses.databaseError("Failed to create order", insertError.message);
    }

    try {
      await logApiEvent("order_create_success", {
        chainId: chainIdNum,
        contract: vc.slice(0, 10),
        maker: orderData.maker.slice(0, 8),
        outcomeIndex: orderData.outcomeIndex,
        isBuy: orderData.isBuy,
        hasMarketKey: !!mk,
      });
    } catch {}
    return successResponse({ orderId: orderData.salt }, "Order created successfully");
  } catch (e: unknown) {
    logApiError("POST /api/orderbook/orders", e);
    const detail = e instanceof Error ? e.message : undefined;
    return ApiResponses.internalError(
      "Failed to create order",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
