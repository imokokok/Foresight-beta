import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import {
  getSessionAddress,
  logApiError,
  normalizeAddress,
  parseRequestBody,
} from "@/lib/serverUtils";
import { normalizePositiveId } from "@/lib/ids";
import { ApiResponses } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const proposalId = normalizePositiveId(searchParams.get("proposalId"));
    if (proposalId === null) {
      return ApiResponses.invalidParameters("proposalId 必填");
    }
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }
    const { data, error } = await client
      .from("discussions")
      .select("*")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true });
    if (error) {
      logApiError("[discussions:get]", error);
      return ApiResponses.databaseError("查询失败", error.message);
    }
    return NextResponse.json({ discussions: data || [] }, { status: 200 });
  } catch (e: unknown) {
    logApiError("[discussions:get] unhandled error", e);
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "请求失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req);
    const proposalId = normalizePositiveId(body?.proposalId);
    const content = String(body?.content || "");
    const image_url = body?.image_url ? String(body?.image_url) : null;
    const replyToId = body?.replyToId ? String(body?.replyToId) : null;
    const replyToUser = body?.replyToUser ? String(body?.replyToUser) : null;
    const replyToContent = body?.replyToContent ? String(body?.replyToContent) : null;
    const topic = body?.topic ? String(body?.topic) : null;

    if (proposalId === null || (!content.trim() && !image_url)) {
      return ApiResponses.invalidParameters("proposalId、(content 或 image_url) 必填");
    }
    const sessAddr = await getSessionAddress(req);
    const sessionWallet = normalizeAddress(String(sessAddr || ""));
    if (!/^0x[a-f0-9]{40}$/.test(sessionWallet)) {
      return ApiResponses.unauthorized("未登录或会话失效");
    }
    const rawUserId = String(body?.userId || "");
    if (rawUserId && normalizeAddress(rawUserId) !== sessionWallet) {
      return ApiResponses.forbidden("userId mismatch");
    }
    const client = supabaseAdmin || getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }
    const { data, error } = await client
      .from("discussions")
      .insert({
        proposal_id: proposalId,
        user_id: sessionWallet,
        content,
        image_url,
        reply_to_id: replyToId,
        reply_to_user: replyToUser,
        reply_to_content: replyToContent,
        topic,
      } as any)
      .select()
      .maybeSingle();
    if (error) {
      logApiError("[discussions:post]", error);
      return ApiResponses.databaseError("创建失败", error.message);
    }
    return NextResponse.json({ discussion: data }, { status: 200 });
  } catch (e: unknown) {
    logApiError("[discussions:post] unhandled error", e);
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError(
      "请求失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
