import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError } from "@/lib/serverUtils";

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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch flags";
    return NextResponse.json({ flags: [], message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req);
    const client = supabaseAdmin || getClient();
    if (!client) return NextResponse.json({ message: "Service not configured" }, { status: 500 });

    const title = String(body?.title || "");
    const description = String(body?.description || "");
    const deadlineRaw = String(body?.deadline || "");
    const verification_type =
      String(body?.verification_type || "self") === "witness" ? "witness" : "self";
    const witness_id = String(body?.witness_id || "").trim();
    const user_id = String(body?.user_id || "").trim() || "anonymous";
    if (!title || !deadlineRaw)
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 });
    const deadline = new Date(deadlineRaw);
    if (Number.isNaN(deadline.getTime()))
      return NextResponse.json({ message: "Invalid deadline format" }, { status: 400 });

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
        .insert({ ...payload, witness_id } as never)
        .select("*")
        .maybeSingle();
      data = res.data as Database["public"]["Tables"]["flags"]["Row"] | null;
      error = res.error;
      // 若列不存在导致失败，回退不带 witness_id 插入
      if (error) {
        const res2 = await client
          .from("flags")
          .insert(payload as never)
          .select("*")
          .maybeSingle();
        data = res2.data as Database["public"]["Tables"]["flags"]["Row"] | null;
        error = res2.error;
      }
    } else {
      const res = await client
        .from("flags")
        .insert(payload as never)
        .select("*")
        .maybeSingle();
      data = res.data as Database["public"]["Tables"]["flags"]["Row"] | null;
      error = res.error;
    }
    if (error)
      return NextResponse.json(
        { message: "Failed to create flag", detail: error.message },
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
            deadline: String(data.deadline || ""),
            ts: new Date().toISOString(),
          }),
        };
        await client.from("discussions").insert(payload as never);
      }
    } catch (e) {
      logApiError("POST /api/flags witness invite insert failed", e);
    }
    return NextResponse.json({ message: "ok", data }, { status: 200 });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: "Failed to create flag", detail }, { status: 500 });
  }
}
