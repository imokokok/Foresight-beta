import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses, proxyJsonResponse, successResponse } from "@/lib/apiResponse";
import { getRelayerBaseUrl, logApiError, logApiEvent } from "@/lib/serverUtils";
import { getConfiguredRpcUrl } from "@/lib/runtimeConfig";
import { marketAbi } from "@/app/prediction/[id]/_lib/abis";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const limitResult = await checkRateLimit(ip, RateLimits.moderate, "report_trade_ip");
    if (!limitResult.success) {
      try {
        await logApiEvent("report_trade_rate_limited", {
          ip: ip ? String(ip).split(".").slice(0, 2).join(".") + ".*.*" : "",
        });
      } catch {}
      return ApiResponses.rateLimit("Too many report trade requests");
    }
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
      const url = new URL("/orderbook/report-trade", relayerBase);
      const relayerRes = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody || "{}",
      });
      try {
        await logApiEvent(relayerRes.ok ? "report_trade_proxy_ok" : "report_trade_proxy_fail", {
          status: relayerRes.status,
        });
      } catch {}
      return proxyJsonResponse(relayerRes, {
        successMessage: "ok",
        errorMessage: "Relayer request failed",
      });
    }

    // Serverless fallback: Update Supabase directly by parsing tx logs
    const { chainId, txHash, contract, verifyingContract } = body;

    const marketAddressRaw = String(contract || verifyingContract || "").trim();

    if (!chainId || !txHash || !marketAddressRaw) {
      return ApiResponses.invalidParameters("Missing chainId, txHash, or contract");
    }

    const chainIdNum = Number(chainId);
    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
      return ApiResponses.badRequest("Invalid chainId");
    }
    if (!ethers.isAddress(marketAddressRaw)) return ApiResponses.badRequest("Invalid contract");
    const marketAddress = marketAddressRaw.toLowerCase();

    const provider = new ethers.JsonRpcProvider(getConfiguredRpcUrl(chainIdNum));

    // Wait for receipt (it should be mined already as client sends this after wait)
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return ApiResponses.notFound("Transaction receipt not found");
    }

    const iface = new ethers.Interface(marketAbi);
    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const filledEvents = [];
    for (const log of receipt.logs) {
      try {
        if (String(log.address || "").toLowerCase() !== marketAddress) continue;
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "OrderFilledSigned") {
          // event OrderFilledSigned(address indexed maker, address indexed taker, uint256 indexed outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 fee, uint256 salt);
          const { maker, salt, amount } = parsed.args;
          filledEvents.push({
            maker: String(maker).toLowerCase(),
            salt: String(salt),
            amount: BigInt(amount),
          });
        }
      } catch {
        // ignore other events
      }
    }

    if (filledEvents.length === 0) {
      try {
        await logApiEvent("report_trade_no_events", {});
      } catch {}
      return successResponse({ updated: 0 }, "No fill events found in transaction");
    }

    let updatedCount = 0;
    for (const item of filledEvents) {
      const { maker, salt, amount } = item;

      // Fetch current order
      const { data: order, error: fetchErr } = await (client as any)
        .from("orders")
        .select("id, remaining, status")
        .eq("chain_id", chainIdNum)
        .eq("verifying_contract", marketAddress)
        .eq("maker_address", maker)
        .eq("maker_salt", salt)
        .maybeSingle();

      if (fetchErr || !order) continue;

      const currentRemaining = BigInt(String(order.remaining || "0"));
      if (currentRemaining <= 0n) continue;

      const newRemaining = currentRemaining > amount ? currentRemaining - amount : 0n;
      const newStatus = newRemaining === 0n ? "filled" : "partially_filled";

      const { error: updateErr } = await (client as any)
        .from("orders")
        .update({
          remaining: newRemaining.toString(),
          status: newStatus,
        } as never)
        .eq("id", order.id);

      if (!updateErr) updatedCount++;
    }

    return successResponse({ updated: updatedCount }, "Orders updated successfully");
  } catch (e: unknown) {
    logApiError("POST /api/orderbook/report-trade", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("Failed to report trade", message);
  }
}
