import { NextRequest, NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { getClient, supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { ethers } from "ethers";

type OrdersRow = Pick<Database["public"]["Tables"]["orders"]["Row"], "id" | "remaining" | "status">;

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin || getClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase not configured" },
        { status: 500 }
      );
    }

    const bodyRaw = await req.json().catch(() => null);
    if (!bodyRaw || typeof bodyRaw !== "object") {
      return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
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
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(chainIdNum) || chainIdNum <= 0) {
      return NextResponse.json({ success: false, message: "Invalid chainId" }, { status: 400 });
    }

    if (!ethers.isAddress(vc) || !ethers.isAddress(maker)) {
      return NextResponse.json(
        { success: false, message: "Invalid verifyingContract or maker" },
        { status: 400 }
      );
    }

    let fillBN: bigint;
    try {
      fillBN = BigInt(String(fillAmount));
      if (fillBN <= 0n) {
        return NextResponse.json(
          { success: false, message: "fillAmount must be positive" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ success: false, message: "Invalid fillAmount" }, { status: 400 });
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
      return NextResponse.json(
        { success: false, message: error.message || "Order query failed" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Order not found or already closed" },
        { status: 404 }
      );
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
      return NextResponse.json({
        success: true,
        data: {
          id: orderRow.id,
          remaining: "0",
          status: orderRow.status || "filled",
        },
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
      return NextResponse.json({ success: false, message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
