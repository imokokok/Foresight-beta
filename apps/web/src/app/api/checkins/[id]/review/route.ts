import { NextRequest, NextResponse } from "next/server";
import { supabase, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import {
  parseRequestBody,
  logApiError,
  getSessionAddress,
  normalizeAddress,
} from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const checkinId = normalizeId(id);
    if (!checkinId) {
      return NextResponse.json({ message: "checkinId is required" }, { status: 400 });
    }
    const body = await parseRequestBody(req as any);
    const rawAction =
      typeof (body as any)?.action === "string" ? (body as any).action.trim().toLowerCase() : "";
    const action =
      rawAction === "approve" ? "approved" : rawAction === "reject" ? "rejected" : null;
    const rawReason = (body as any)?.reason;
    const reason =
      typeof rawReason === "string" && rawReason.trim().length > 0 ? rawReason.trim() : null;
    if (!action) {
      return NextResponse.json(
        { message: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    const reviewer_id = await getSessionAddress(req);
    if (!reviewer_id)
      return NextResponse.json(
        { message: "Unauthorized", detail: "Missing session address" },
        { status: 401 }
      );

    const client = (supabase || getClient()) as any;
    if (!client) return NextResponse.json({ message: "Service not configured" }, { status: 500 });

    const { data: rawChk, error: chkErr } = await client
      .from("flag_checkins")
      .select("id,flag_id,review_status")
      .eq("id", checkinId)
      .maybeSingle();

    const chk = rawChk as Pick<
      Database["public"]["Tables"]["flag_checkins"]["Row"],
      "id" | "flag_id" | "review_status"
    > | null;

    if (chkErr) {
      const payload: Database["public"]["Tables"]["discussions"]["Insert"] = {
        user_id: reviewer_id,
        proposal_id: checkinId,
        content: JSON.stringify({
          type: "checkin_review",
          checkin_id: checkinId,
          action,
          reason,
          ts: new Date().toISOString(),
        }),
      };
      await client.from("discussions").insert(payload);
      return NextResponse.json({ message: "ok" }, { status: 200 });
    }
    if (!chk) return NextResponse.json({ message: "Check-in record not found" }, { status: 404 });

    const { data: rawFlag, error: fErr } = await client
      .from("flags")
      .select("*")
      .eq("id", chk.flag_id)
      .maybeSingle();

    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;

    if (fErr)
      return NextResponse.json(
        { message: "Failed to query flag", detail: fErr.message },
        { status: 500 }
      );
    if (!flag) return NextResponse.json({ message: "Flag not found" }, { status: 404 });
    if (String(flag?.verification_type || "") !== "witness")
      return NextResponse.json(
        { message: "Flag is not in witness mode, review not required" },
        { status: 400 }
      );

    const allowedReviewer = String(flag?.witness_id || flag?.user_id || "");
    if (!allowedReviewer || allowedReviewer.toLowerCase() !== reviewer_id.toLowerCase())
      return NextResponse.json(
        { message: "Only the witness can review this check-in" },
        { status: 403 }
      );

    const { data: upd, error: uErr } = await client
      .from("flag_checkins")
      .update({
        review_status: action,
        reviewer_id,
        review_reason: reason,
        reviewed_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["flag_checkins"]["Update"])
      .eq("id", checkinId)
      .select("*")
      .maybeSingle();
    if (uErr) {
      const payload: Database["public"]["Tables"]["discussions"]["Insert"] = {
        user_id: reviewer_id,
        proposal_id: checkinId,
        content: JSON.stringify({
          type: "checkin_review",
          checkin_id: checkinId,
          action,
          reason,
          ts: new Date().toISOString(),
        }),
      };
      try {
        await client.from("discussions").insert(payload);
      } catch (e) {
        logApiError("POST /api/checkins/[id]/review fallback log insert failed", e);
      }
      return NextResponse.json({ message: "ok" }, { status: 200 });
    }

    // 若 flags 当前为 pending_review，审核后回到 active
    if (String(flag?.status || "") === "pending_review") {
      const pending = await client
        .from("flag_checkins")
        .select("id", { count: "exact", head: true })
        .eq("flag_id", chk.flag_id)
        .eq("review_status", "pending");

      if (!pending.error && Number(pending.count || 0) === 0) {
        await client.from("flags").update({ status: "active" }).eq("id", chk.flag_id);
      }
    }

    try {
      const recipient = normalizeAddress(String(flag.user_id || ""));
      if (recipient) {
        await (client as any).from("notifications").insert({
          recipient_id: recipient,
          type: "checkin_review",
          title: "",
          message: "",
          url: "/flags",
          dedupe_key: `checkin_review:${checkinId}:${action}`,
          actor_id: reviewer_id,
          payload: {
            flag_id: chk.flag_id,
            checkin_id: checkinId,
            action,
            reason,
            ts: new Date().toISOString(),
          },
        });
      }
    } catch (e) {
      logApiError("POST /api/checkins/[id]/review notification insert failed", e);
    }

    return NextResponse.json({ message: "ok", data: upd }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "Failed to review check-in", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
