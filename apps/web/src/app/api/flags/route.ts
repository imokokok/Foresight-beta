import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError } from "@/lib/serverUtils";

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) return NextResponse.json({ flags: [] }, { status: 200 });
    const url = new URL(req.url);
    const viewer = String(url.searchParams.get("viewer_id") || "").trim();
    if (!viewer) return NextResponse.json({ flags: [] }, { status: 200 });
    const { data, error } = await client
      .from("flags")
      .select("*")
      .or(`user_id.eq.${viewer},witness_id.eq.${viewer}`)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ flags: [] }, { status: 200 });
    return NextResponse.json({ flags: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { flags: [], message: "查询失败" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req as any);
    const client = (supabaseAdmin || getClient()) as any;
    if (!client)
      return NextResponse.json({ message: "服务未配置" }, { status: 500 });

    const title = String(body?.title || "");
    const description = String(body?.description || "");
    const deadlineRaw = String(body?.deadline || "");
    const verification_type =
      String(body?.verification_type || "self") === "witness"
        ? "witness"
        : "self";
    const witness_id = String(body?.witness_id || "").trim();
    const user_id = String(body?.user_id || "").trim() || "anonymous";
    if (!title || !deadlineRaw)
      return NextResponse.json({ message: "参数缺失" }, { status: 400 });
    const deadline = new Date(deadlineRaw);
    if (Number.isNaN(deadline.getTime()))
      return NextResponse.json(
        { message: "截止时间格式错误" },
        { status: 400 }
      );

    const payload: Database["public"]["Tables"]["flags"]["Insert"] = {
      user_id,
      title,
      description,
      deadline: deadline.toISOString(),
      verification_type,
      status: "active",
    };
    let data: Database["public"]["Tables"]["flags"]["Row"] | null = null;
    let error: { message?: string } | null = null;
    if (witness_id) {
      const res = await client
        .from("flags")
        .insert({ ...payload, witness_id })
        .select("*")
        .maybeSingle();
      data = res.data;
      error = res.error;
      // 若列不存在导致失败，回退不带 witness_id 插入
      if (error) {
        const res2 = await client
          .from("flags")
          .insert(payload)
          .select("*")
          .maybeSingle();
        data = res2.data;
        error = res2.error;
      }
    } else {
      const res = await client
        .from("flags")
        .insert(payload)
        .select("*")
        .maybeSingle();
      data = res.data;
      error = res.error;
    }
    if (error)
      return NextResponse.json(
        { message: "创建失败", detail: error.message },
        { status: 500 }
      );
    try {
      if (witness_id && data && data.id) {
        const flagIdNum = data.id;
        const payload: Database["public"]["Tables"]["discussions"]["Insert"] = {
          proposal_id: flagIdNum,
          user_id: witness_id,
          content: JSON.stringify({
            type: "witness_invite",
            flag_id: flagIdNum,
            owner_id: user_id,
            title,
            description,
            deadline: String((data as any)?.deadline || ""),
            ts: new Date().toISOString(),
          }),
        };
        await client.from("discussions").insert(payload);
      }
    } catch (e) {
      logApiError("POST /api/flags witness invite insert failed", e);
    }
    return NextResponse.json({ message: "ok", data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "创建失败", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
