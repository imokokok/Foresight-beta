import { NextRequest, NextResponse } from "next/server";
import { ApiResponses } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase.server";
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
    if (checkinId == null || checkinId <= 0) {
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

    const reviewer_id = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(reviewer_id))
      return NextResponse.json(
        { message: "Unauthorized", detail: "Missing session address" },
        { status: 401 }
      );

    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Service not configured");

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
      logApiError("POST /api/checkins/[id]/review checkin_query_failed", chkErr);
      return ApiResponses.databaseError("Failed to query check-in", chkErr.message);
    }
    if (!chk) return ApiResponses.notFound("Check-in record not found");

    const { data: rawFlag, error: fErr } = await client
      .from("flags")
      .select("*")
      .eq("id", chk.flag_id)
      .maybeSingle();

    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;

    if (fErr) return ApiResponses.databaseError("Failed to query flag", fErr.message);
    if (!flag) return ApiResponses.notFound("Flag not found");
    if (String(flag?.verification_type || "") !== "witness")
      return ApiResponses.badRequest("Flag is not in witness mode, review not required");

    const allowedReviewer = String(flag?.witness_id || flag?.user_id || "");
    if (!allowedReviewer || allowedReviewer.toLowerCase() !== reviewer_id.toLowerCase())
      return ApiResponses.forbidden("Only the witness can review this check-in");

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
      logApiError("POST /api/checkins/[id]/review update_failed", uErr);
      return ApiResponses.databaseError("Failed to update check-in review", uErr.message);
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
    return ApiResponses.internalError(
      "Failed to review check-in",
      process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
    );
  }
}
