import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { parseRequestBody } from "@/lib/serverUtils";

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pid } = await context.params;
    const id = toNum(pid);
    if (!id) return NextResponse.json({ message: "id 必填" }, { status: 400 });
    const body = await parseRequestBody(req);
    const content = String(body?.content || "");
    if (!content.trim())
      return NextResponse.json({ message: "content 必填" }, { status: 400 });
    const client = (supabaseAdmin || getClient()) as any;
    const { data, error } = await client
      .from("discussions")
      .update({ content })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error)
      return NextResponse.json(
        { message: "更新失败", detail: error.message },
        { status: 500 }
      );
    return NextResponse.json({ discussion: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "请求失败", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pid } = await context.params;
    const id = toNum(pid);
    if (!id) return NextResponse.json({ message: "id 必填" }, { status: 400 });
    const client = (supabaseAdmin || getClient()) as any;
    const { error } = await client.from("discussions").delete().eq("id", id);
    if (error)
      return NextResponse.json(
        { message: "删除失败", detail: error.message },
        { status: 500 }
      );
    return NextResponse.json({ message: "已删除" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "请求失败", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
