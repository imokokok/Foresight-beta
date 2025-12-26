import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const proposalId = normalizeId(searchParams.get("proposalId"));
    if (!proposalId) return NextResponse.json({ message: "proposalId 必填" }, { status: 400 });
    const client = getClient();
    if (!client) return NextResponse.json({ message: "Supabase 未配置" }, { status: 500 });
    const { data, error } = await client
      .from("discussions")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true });
    if (error) {
      logApiError("[discussions:get]", error);
      return NextResponse.json({ message: "查询失败", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ discussions: data || [] }, { status: 200 });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: "请求失败", detail }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req);
    const proposalId = normalizeId(body?.proposalId);
    const content = String(body?.content || "");
    const userId = String(body?.userId || "");
    if (!proposalId || !content.trim() || !userId.trim()) {
      return NextResponse.json({ message: "proposalId、content、userId 必填" }, { status: 400 });
    }
    const client = supabaseAdmin || getClient();
    if (!client) return NextResponse.json({ message: "Supabase 未配置" }, { status: 500 });
    const { data, error } = await client
      .from("discussions")
      .insert({
        proposal_id: proposalId,
        user_id: userId,
        content,
      } as Database["public"]["Tables"]["discussions"]["Insert"] as never)
      .select()
      .maybeSingle();
    if (error) {
      logApiError("[discussions:post]", error);
      return NextResponse.json({ message: "创建失败", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ discussion: data }, { status: 200 });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: "请求失败", detail }, { status: 500 });
  }
}
