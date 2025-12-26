import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";

function getRelayerBaseUrl(): string | undefined {
  const raw = (process.env.RELAYER_URL || process.env.NEXT_PUBLIC_RELAYER_URL || "").trim();
  if (!raw) return undefined;
  if (!/^https?:\/\//i.test(raw)) return undefined;
  return raw;
}

function isMissingMarketKeyColumn(
  error: { code?: string; message?: string | null } | null
): boolean {
  if (!error) return false;
  const code = String(error.code || "").toUpperCase();
  if (code === "42703") return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("market_key");
}

function normalizeDepthSideForRelayer(side: string | null): "buy" | "sell" {
  const raw = (side || "").toLowerCase().trim();
  if (raw === "true" || raw === "buy") return "buy";
  if (raw === "false" || raw === "sell") return "sell";
  return "buy";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const contract = url.searchParams.get("contract");
    const chainId = url.searchParams.get("chainId");
    const outcome = url.searchParams.get("outcome");
    const side = url.searchParams.get("side"); // 'true' for buy, 'false' for sell
    const marketKey = url.searchParams.get("marketKey") || url.searchParams.get("market_key");
    const levels = Number(url.searchParams.get("levels") || 10);

    if (!contract || !chainId || outcome === null || side === null) {
      return NextResponse.json({ success: false, message: "Missing parameters" }, { status: 400 });
    }

    const relayerBase = getRelayerBaseUrl();
    if (relayerBase) {
      try {
        const relayerUrl = new URL("/orderbook/depth", relayerBase);
        relayerUrl.searchParams.set("contract", contract);
        relayerUrl.searchParams.set("chainId", chainId);
        relayerUrl.searchParams.set("outcome", outcome);
        relayerUrl.searchParams.set("side", normalizeDepthSideForRelayer(side));
        relayerUrl.searchParams.set("levels", String(levels));
        if (marketKey) relayerUrl.searchParams.set("marketKey", marketKey);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const relayerRes = await fetch(relayerUrl.toString(), {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const relayerJson = await relayerRes.json().catch(() => null);

        return NextResponse.json(
          relayerJson ?? { success: false, message: "invalid relayer response" },
          {
            status: relayerRes.status,
          }
        );
      } catch {}
    }

    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase not configured" },
        { status: 500 }
      );
    }

    const isBuy = side === "true";

    let query = client
      .from("orders")
      .select("price, remaining")
      .eq("verifying_contract", contract.toLowerCase())
      .eq("chain_id", Number(chainId))
      .eq("outcome_index", Number(outcome))
      .eq("is_buy", isBuy)
      .in("status", ["open", "filled_partial"]);

    if (marketKey) {
      query = query.eq("market_key", marketKey);
    }

    const initial = await query.order("price", { ascending: !isBuy });
    let orders = (initial.data ?? []) as Array<{ price: string; remaining: string }>;
    let error = initial.error;

    if (isMissingMarketKeyColumn(error) && marketKey) {
      const fallbackQuery = client
        .from("orders")
        .select("price, remaining")
        .eq("verifying_contract", contract.toLowerCase())
        .eq("chain_id", Number(chainId))
        .eq("outcome_index", Number(outcome))
        .eq("is_buy", isBuy)
        .in("status", ["open", "filled_partial"]);

      const fallback = await fallbackQuery.order("price", {
        ascending: !isBuy,
      });
      orders = (fallback.data ?? []) as Array<{ price: string; remaining: string }>;
      error = fallback.error;
    }

    if (error) {
      console.error("Error fetching depth:", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    if (!orders.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Aggregate orders by price
    const depthMap = new Map<string, bigint>();

    for (const order of orders) {
      const priceStr = String(order.price);
      const currentQty = depthMap.get(priceStr) || BigInt(0);
      depthMap.set(priceStr, currentQty + BigInt(order.remaining));
    }

    // Convert to array and sort again (just to be safe)
    const depthArray = Array.from(depthMap.entries()).map(([price, qty]) => ({
      price,
      qty: qty.toString(),
    }));

    // Sort again because Map iteration order is insertion order (usually correct if query was sorted, but let's ensure)
    depthArray.sort((a, b) => {
      const priceA = BigInt(a.price);
      const priceB = BigInt(b.price);
      if (isBuy) {
        return priceA > priceB ? -1 : priceA < priceB ? 1 : 0;
      } else {
        return priceA < priceB ? -1 : priceA > priceB ? 1 : 0;
      }
    });

    return NextResponse.json({
      success: true,
      data: depthArray.slice(0, levels),
    });
  } catch (e: unknown) {
    console.error("Depth API error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
