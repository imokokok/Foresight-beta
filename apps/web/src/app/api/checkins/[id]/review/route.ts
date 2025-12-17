import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError } from "@/lib/serverUtils";

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const checkinId = toNum(id);
    if (!checkinId)
      return NextResponse.json({ message: "checkinId 必填" }, { status: 400 });
    const body = await parseRequestBody(req as any);
    const actionRaw = String(body?.action || "")
      .trim()
      .toLowerCase();
    const action =
      actionRaw === "approve"
        ? "approved"
        : actionRaw === "reject"
        ? "rejected"
        : null;
    const reviewer_id = String(body?.reviewer_id || "").trim();
    const reason = String(body?.reason || "").trim() || null;
    if (!action)
      return NextResponse.json(
        { message: "action 必须为 approve 或 reject" },
        { status: 400 }
      );
    if (!reviewer_id)
      return NextResponse.json(
        { message: "reviewer_id 必填" },
        { status: 400 }
      );

    const client = (supabaseAdmin || getClient()) as any;
    if (!client)
      return NextResponse.json({ message: "服务未配置" }, { status: 500 });

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
    if (!chk)
      return NextResponse.json({ message: "打卡记录不存在" }, { status: 404 });

    const { data: rawFlag, error: fErr } = await client
      .from("flags")
      .select("*")
      .eq("id", chk.flag_id)
      .maybeSingle();

    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;

    if (fErr)
      return NextResponse.json(
        { message: "查询失败", detail: fErr.message },
        { status: 500 }
      );
    if (!flag)
      return NextResponse.json({ message: "Flag 不存在" }, { status: 404 });
    if (String(flag?.verification_type || "") !== "witness")
      return NextResponse.json(
        { message: "非监督模式无需审核" },
        { status: 400 }
      );

    const allowedReviewer = String(flag?.witness_id || flag?.user_id || "");
    if (
      !allowedReviewer ||
      allowedReviewer.toLowerCase() !== reviewer_id.toLowerCase()
    )
      return NextResponse.json({ message: "仅监督人可审核" }, { status: 403 });

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
      await client
        .from("flags")
        .update({ status: "active" })
        .eq("id", chk.flag_id);
    }

    return NextResponse.json({ message: "ok", data: upd }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "审核失败", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
