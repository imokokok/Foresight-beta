import { NextRequest, NextResponse } from "next/server";
import { supabase, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError, getSessionAddress } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const checkinId = normalizeId(id);
    if (!checkinId) return NextResponse.json({ message: "checkinId is required" }, { status: 400 });
    const body = await parseRequestBody(req as any);
    const actionRaw = String(body?.action || "")
      .trim()
      .toLowerCase();
    const action =
      actionRaw === "approve" ? "approved" : actionRaw === "reject" ? "rejected" : null;
    const reason = String(body?.reason || "").trim() || null;
    if (!action)
      return NextResponse.json(
        { message: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );

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
      await client.from("flags").update({ status: "active" }).eq("id", chk.flag_id);
    }

    return NextResponse.json({ message: "ok", data: upd }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "Failed to review check-in", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
