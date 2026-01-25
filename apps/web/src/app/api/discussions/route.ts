import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import type { Database } from "@/lib/database.types";
import {
  getSessionAddress,
  logApiError,
  normalizeAddress,
  parseRequestBody,
} from "@/lib/serverUtils";
import { normalizePositiveId } from "@/lib/ids";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

function textLengthWithoutSpaces(value: string): number {
  return value.replace(/\s+/g, "").length;
}

async function isUnderDiscussionRateLimit(
  client: NonNullable<typeof supabaseAdmin>,
  walletAddress: string
): Promise<boolean> {
  const userId = walletAddress || "guest";
  const now = new Date();
  const threeSecondsAgo = new Date(now.getTime() - 3 * 1000).toISOString();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { count: count3s, error: err3s } = await client
    .from("discussions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", threeSecondsAgo);
  if (err3s) throw err3s;
  if (typeof count3s === "number" && count3s > 0) return false;

  const { count: count10m, error: err10m } = await client
    .from("discussions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", tenMinutesAgo);
  if (err10m) throw err10m;
  if (typeof count10m === "number" && count10m >= 30) return false;

  const { count: count24h, error: err24h } = await client
    .from("discussions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", dayAgo);
  if (err24h) throw err24h;
  if (typeof count24h === "number" && count24h >= 200) return false;

  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const proposalId = normalizePositiveId(searchParams.get("proposalId"));
    if (proposalId === null) {
      return ApiResponses.invalidParameters("proposalId 必填");
    }
    const client = supabaseAdmin;
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
    return successResponse({ discussions: data || [] });
  } catch (e) {
    const error = e as Error;
    logApiError("[discussions:get] unhandled error", error);
    return ApiResponses.internalError(
      "请求失败",
      process.env.NODE_ENV === "development" ? error.message : undefined
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
    const client = supabaseAdmin;
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }

    if (content && content.length > 4000) {
      return ApiResponses.invalidParameters("内容过长");
    }
    if (content && textLengthWithoutSpaces(content) > 2000) {
      return ApiResponses.invalidParameters("内容过长");
    }

    try {
      const ok = await isUnderDiscussionRateLimit(client, sessionWallet);
      if (!ok) return ApiResponses.rateLimit("发言过于频繁，请稍后再试");
    } catch (e) {
      const error = e as Error;
      logApiError("[discussions:post] rate limit check failed", error);
      return ApiResponses.internalError(
        "限流检查失败",
        process.env.NODE_ENV === "development" ? error.message : undefined
      );
    }

    interface LastDiscussionRow {
      content: string | null;
      created_at: string | null;
      proposal_id: number;
    }

    try {
      const { data: lastRow, error: lastErr } = await client
        .from("discussions")
        .select("content,created_at,proposal_id")
        .eq("proposal_id", proposalId)
        .eq("user_id", sessionWallet)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastErr) throw lastErr;
      const lastData = lastRow as LastDiscussionRow | null;
      const lastContent = String(lastData?.content || "").trim();
      const nextContent = String(content || "").trim();
      const lastCreatedAt = String(lastData?.created_at || "");
      const lastTs = lastCreatedAt ? new Date(lastCreatedAt).getTime() : 0;
      if (
        lastContent &&
        nextContent &&
        lastContent === nextContent &&
        Number.isFinite(lastTs) &&
        Date.now() - lastTs < 30 * 1000
      ) {
        return ApiResponses.rateLimit("重复内容发送过快，请稍后再试");
      }
    } catch (e) {
      const error = e as Error;
      logApiError("[discussions:post] duplicate check failed", error);
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
    return successResponse({ discussion: data });
  } catch (e) {
    const error = e as Error;
    logApiError("[discussions:post] unhandled error", error);
    return ApiResponses.internalError(
      "请求失败",
      process.env.NODE_ENV === "development" ? error.message : undefined
    );
  }
}
