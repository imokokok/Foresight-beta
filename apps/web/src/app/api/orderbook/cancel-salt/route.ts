import { NextRequest } from "next/server";
import { getClient, supabaseAdmin } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { ApiResponses, successResponse, proxyJsonResponse } from "@/lib/apiResponse";
import { getRelayerBaseUrl, logApiError } from "@/lib/serverUtils";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const relayerBase = getRelayerBaseUrl();
    if (relayerBase) {
      const url = new URL("/orderbook/cancel-salt", relayerBase);
      const relayerRes = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody || "{}",
      });
      return proxyJsonResponse(relayerRes, {
        successMessage: "ok",
        errorMessage: "Relayer request failed",
      });
    }

    const client = supabaseAdmin || getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const body = (() => {
      try {
        return rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return {};
      }
    })();
    const { chainId, verifyingContract, contract, marketKey, market_key, salt, maker, signature } =
      body;

    const vcRaw = (verifyingContract || contract || "").toString();
    const vc = vcRaw.trim();
    const chainIdNum = Number(chainId);
    const mk = (marketKey || market_key || "").toString().trim() || undefined;

    if (!chainId || !vc || !salt || !maker || !signature) {
      return ApiResponses.invalidParameters("Missing required fields");
    }

    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
      return ApiResponses.badRequest("Invalid chainId");
    }

    if (!ethers.isAddress(vc)) {
      return ApiResponses.badRequest("Invalid verifyingContract");
    }
    if (!ethers.isAddress(String(maker))) {
      return ApiResponses.badRequest("Invalid maker");
    }

    const domain = {
      name: "Foresight Market",
      version: "1",
      chainId: chainIdNum,
      verifyingContract: vc,
    };
    const types = {
      CancelSaltRequest: [
        { name: "maker", type: "address" },
        { name: "salt", type: "uint256" },
      ],
    };
    try {
      const recoveredAddress = ethers.verifyTypedData(domain, types, { maker, salt }, signature);
      if (recoveredAddress.toLowerCase() !== String(maker).toLowerCase()) {
        return ApiResponses.invalidSignature("Invalid signature");
      }
    } catch {
      return ApiResponses.invalidSignature("Invalid signature");
    }

    // 2. Cancel Order in DB
    const runUpdate = async (useMk: boolean) => {
      let q = client
        .from("orders")
        .update({ status: "canceled", remaining: "0" } as never)
        .eq("chain_id", chainIdNum)
        .eq("verifying_contract", vc.toLowerCase())
        .eq("maker_address", maker.toLowerCase())
        .eq("maker_salt", String(salt))
        .select();
      if (useMk && mk) q = q.eq("market_key", mk);
      return await q;
    };

    let { error } = await runUpdate(true);
    if (error) {
      const pgError = error as PostgrestError;
      const msg = String(pgError.message || "");
      if (mk && /market_key/i.test(msg)) {
        ({ error } = await runUpdate(false));
      }
    }

    if (error) {
      logApiError("POST /api/orderbook/cancel-salt update failed", error);
      const message = error.message || "Failed to cancel order";
      return ApiResponses.databaseError("Failed to cancel order", message);
    }

    return successResponse({ success: true }, "Order cancelled");
  } catch (e: unknown) {
    logApiError("POST /api/orderbook/cancel-salt unhandled error", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "Failed to cancel order",
      process.env.NODE_ENV === "development" ? message : undefined
    );
  }
}
