import { NextRequest, NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { getClient, supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { ethers } from "ethers";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { logApiError } from "@/lib/serverUtils";

type OrdersRow = Pick<Database["public"]["Tables"]["orders"]["Row"], "id" | "remaining" | "status">;

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin || getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase not configured");
    }

    const bodyRaw = await req.json().catch(() => null);
    if (!bodyRaw || typeof bodyRaw !== "object") {
      return ApiResponses.badRequest("Invalid JSON body");
    }

    const { chainId, verifyingContract, contract, marketKey, market_key, maker, salt, fillAmount } =
      bodyRaw as {
        chainId?: unknown;
        verifyingContract?: unknown;
        contract?: unknown;
        marketKey?: unknown;
        market_key?: unknown;
        maker?: unknown;
        salt?: unknown;
        fillAmount?: unknown;
      };

    const vcRaw = (verifyingContract || contract || "").toString();
    const vc = vcRaw.trim();
    const chainIdNum = Number(chainId);
    const mk = (marketKey || market_key || "").toString().trim() || undefined;

    if (!chainId || !vc || !maker || salt === undefined || fillAmount === undefined) {
      return ApiResponses.invalidParameters("Missing required fields");
    }

    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
      return ApiResponses.badRequest("Invalid chainId");
    }

    if (!ethers.isAddress(vc) || !ethers.isAddress(maker)) {
      return ApiResponses.badRequest("Invalid verifyingContract or maker");
    }

    let fillBN: bigint;
    try {
      fillBN = BigInt(String(fillAmount));
      if (fillBN <= 0n) {
        return ApiResponses.badRequest("fillAmount must be positive");
      }
    } catch {
      return ApiResponses.badRequest("Invalid fillAmount");
    }

    const runSelect = async (useMk: boolean) => {
      let q = client
        .from("orders")
        .select("id, remaining, status")
        .eq("chain_id", chainIdNum)
        .eq("verifying_contract", vc.toLowerCase())
        .eq("maker_address", maker.toLowerCase())
        .eq("maker_salt", String(salt))
        .in("status", ["open", "filled_partial"]);
      if (useMk && mk) {
        q = q.eq("market_key", mk);
      }
      return q.maybeSingle();
    };

    let { data, error } = await runSelect(true);
    if (error && mk) {
      const pgError = error as PostgrestError;
      const msg = String(pgError.message || "");
      const code = pgError.code ? String(pgError.code) : "";
      if (code === "42703" || /market_key/i.test(msg)) {
        ({ data, error } = await runSelect(false));
      }
    }

    if (error) {
      return ApiResponses.databaseError("Order query failed", error.message);
    }

    if (!data) {
      return ApiResponses.notFound("Order not found or already closed");
    }

    const orderRow = data as OrdersRow;
    const remainingStr = String(orderRow.remaining ?? "0");
    let remainingBN: bigint;
    try {
      remainingBN = BigInt(remainingStr);
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid remaining amount on order" },
        { status: 500 }
      );
    }

    if (remainingBN <= 0n) {
      return successResponse({
        id: orderRow.id,
        remaining: "0",
        status: orderRow.status || "filled",
      });
    }

    const newRemaining = remainingBN > fillBN ? remainingBN - fillBN : 0n;
    const newStatus = newRemaining === 0n ? "filled" : "filled_partial";

    const runUpdate = async (useMk: boolean) => {
      let q = client
        .from("orders")
        .update({
          remaining: newRemaining.toString(),
          status: newStatus,
        } as never)
        .eq("id", orderRow.id)
        .select("id, remaining, status");
      if (useMk && mk) {
        q = q.eq("market_key", mk);
      }
      return q.maybeSingle();
    };

    let { data: updated, error: updateError } = await runUpdate(true);
    if (updateError && mk) {
      const pgError = updateError as PostgrestError;
      const msg = String(pgError.message || "");
      const code = pgError.code ? String(pgError.code) : "";
      if (code === "42703" || /market_key/i.test(msg)) {
        ({ data: updated, error: updateError } = await runUpdate(false));
      }
    }

    if (updateError) {
      const message = updateError.message || "Order update failed";
      return ApiResponses.databaseError("Order update failed", message);
    }

    return successResponse(updated);
  } catch (e: unknown) {
    logApiError("POST /api/orderbook/orders/fill", e);
    const message = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "Failed to fill order",
      process.env.NODE_ENV === "development" ? message : undefined
    );
  }
}
