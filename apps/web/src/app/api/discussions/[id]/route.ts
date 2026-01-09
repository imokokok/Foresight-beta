import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { getSessionAddress, normalizeAddress, parseRequestBody } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import { ApiResponses } from "@/lib/apiResponse";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: pid } = await context.params;
    const id = normalizeId(pid);
    if (id == null || id <= 0) return ApiResponses.badRequest("id 必填");
    const body = await parseRequestBody(req);
    const content = String(body?.content || "");
    if (!content.trim()) return ApiResponses.badRequest("content 必填");

    const sessAddr = await getSessionAddress(req);
    const viewer = normalizeAddress(String(sessAddr || ""));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized("未登录或会话失效");

    const client = supabaseAdmin || getClient();
    if (!client) return ApiResponses.internalError("Supabase 未配置");

    const { data: existing, error: existError } = await (client as any)
      .from("discussions")
      .select("id,user_id")
      .eq("id", id)
      .maybeSingle();
    if (existError) return ApiResponses.databaseError("查询失败", existError.message);
    if (!existing) return ApiResponses.notFound("未找到对象");
    if (normalizeAddress(String(existing.user_id || "")) !== viewer) {
      return ApiResponses.forbidden("无权限");
    }

    const { data, error } = await (client as any)
      .from("discussions")
      .update({ content } as never)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return ApiResponses.databaseError("更新失败", error.message);
    return NextResponse.json({ discussion: data }, { status: 200 });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "请求失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: pid } = await context.params;
    const id = normalizeId(pid);
    if (id == null || id <= 0) return ApiResponses.badRequest("id 必填");

    const sessAddr = await getSessionAddress(req);
    const viewer = normalizeAddress(String(sessAddr || ""));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized("未登录或会话失效");

    const client = supabaseAdmin || getClient();
    if (!client) return ApiResponses.internalError("Supabase 未配置");

    const { data: existing, error: existError } = await (client as any)
      .from("discussions")
      .select("id,user_id")
      .eq("id", id)
      .maybeSingle();
    if (existError) return ApiResponses.databaseError("查询失败", existError.message);
    if (!existing) return ApiResponses.notFound("未找到对象");
    if (normalizeAddress(String(existing.user_id || "")) !== viewer) {
      return ApiResponses.forbidden("无权限");
    }

    const { error } = await (client as any).from("discussions").delete().eq("id", id);
    if (error) return ApiResponses.databaseError("删除失败", error.message);
    return NextResponse.json({ message: "已删除" }, { status: 200 });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "请求失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
