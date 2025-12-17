import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { logApiError } from "@/lib/serverUtils";

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const flagId = toNum(id);
    if (!flagId)
      return NextResponse.json({ message: "flagId 必填" }, { status: 400 });
    const { searchParams } = new URL(req.url);
    const viewer = String(searchParams.get("viewer_id") || "").trim();
    if (!viewer)
      return NextResponse.json({ message: "viewer_id 必填" }, { status: 400 });
    const limit = Math.max(
      1,
      Math.min(200, Number(searchParams.get("limit") || 50))
    );
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));
    const client = supabaseAdmin || getClient();
    if (!client)
      return NextResponse.json({ message: "Supabase 未配置" }, { status: 500 });

    const f = await client
      .from("flags")
      .select("id,user_id,witness_id")
      .eq("id", flagId)
      .maybeSingle();
    if (f.error)
      return NextResponse.json(
        { message: "查询失败", detail: f.error.message },
        { status: 500 }
      );
    if (!f.data)
      return NextResponse.json({ message: "Flag 不存在" }, { status: 404 });
    const owner = String((f.data as Database["public"]["Tables"]["flags"]["Row"]).user_id || "");
    const wit = String((f.data as Database["public"]["Tables"]["flags"]["Row"]).witness_id || "");
    const allowed =
      viewer.toLowerCase() === owner.toLowerCase() ||
      (!!wit && viewer.toLowerCase() === wit.toLowerCase());
    if (!allowed)
      return NextResponse.json({ message: "无权限查看" }, { status: 403 });

    // 首选专用历史表
    const res = await client
      .from("flag_checkins")
      .select(
        "id,note,image_url,created_at,review_status,reviewer_id,review_reason,reviewed_at"
      )
      .eq("flag_id", flagId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!res.error) {
      const items = (res.data || []).map(
        (r: Database["public"]["Tables"]["flag_checkins"]["Row"]) => ({
          id: String(r.id),
          note: String(r.note || ""),
          image_url: String(r.image_url || ""),
          created_at: String(r.created_at || ""),
          review_status: String(r.review_status || "pending"),
          reviewer_id: String(r.reviewer_id || ""),
          review_reason: String(r.review_reason || ""),
          reviewed_at: String(r.reviewed_at || ""),
        })
      );
      return NextResponse.json({ items, total: items.length }, { status: 200 });
    }

    // 回退：使用 discussions 中 type=checkin 的记录
    const d = await client
      .from("discussions")
      .select("id,content,created_at")
      .eq("proposal_id", flagId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (d.error)
      return NextResponse.json(
        { message: "查询失败", detail: d.error.message },
        { status: 500 }
      );
    const items = (d.data || [])
      .map((r: Database["public"]["Tables"]["discussions"]["Row"]) => {
        try {
          const obj = JSON.parse(String(r.content || "{}"));
          if (obj && obj.type === "checkin") {
            return {
              id: String(r.id),
              note: String(obj.note || ""),
              image_url: String(obj.image_url || ""),
              created_at: String(r.created_at || ""),
            };
          }
        } catch (e) {
          logApiError("GET /api/flags/[id]/checkins parse fallback item failed", e);
        }
        return null;
      })
      .filter(Boolean) as {
        id: string;
        note: string;
        image_url: string;
        created_at: string;
      }[];
    return NextResponse.json({ items, total: items.length }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "请求失败", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
