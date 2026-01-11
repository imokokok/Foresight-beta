import { NextRequest, NextResponse } from "next/server";
import { getClient, supabaseAdmin } from "@/lib/supabase";
import {
  getSessionAddress,
  normalizeAddress,
  parseRequestBody,
  logApiError,
} from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import { ApiResponses } from "@/lib/apiResponse";
import { normalizeCategory } from "@/features/trending/trendingModel";
import { isAdminSession } from "../admin/performance/_lib/auth";

// 论坛数据可以短暂缓存
export const revalidate = 30; // 30秒缓存

function isAutoMarketEnabled(): boolean {
  const raw = process.env.FORUM_AUTO_MARKET_ENABLED;
  if (raw == null) return true;
  const s = String(raw).toLowerCase();
  if (s === "0" || s === "false" || s === "off" || s === "no") return false;
  return true;
}

async function isUnderDailyAutoMarketLimit(client: any): Promise<boolean> {
  const rawLimit = process.env.FORUM_AUTO_MARKET_DAILY_LIMIT;
  const n = rawLimit ? Number(rawLimit) : NaN;
  const limit = Number.isFinite(n) && n > 0 ? n : 3;
  if (!limit) return false;
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
  );
  const { count, error } = await client
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString());
  if (error) {
    logApiError("maybeAutoCreatePrediction count predictions failed", error);
    return false;
  }
  const used = typeof count === "number" ? count : 0;
  return used < limit;
}

function actionLabel(v: string): string {
  const normalized = normalizeActionVerb(v);
  if (normalized === "价格达到") return "价格是否会达到";
  if (normalized === "将会发生") return "是否将会发生";
  if (normalized === "将会赢得") return "是否将会赢得";
  if (!normalized) return "是否将会发生";
  if (normalized.includes("是否")) return normalized;
  return `是否${normalized}`;
}

function normalizeActionVerb(v: string): string {
  const s = String(v || "").trim();
  if (s === "priceReach") return "价格达到";
  if (s === "willHappen") return "将会发生";
  if (s === "willWin") return "将会赢得";
  return s;
}

async function maybeAutoCreatePrediction(
  client: any,
  eventId: number,
  threads: any[],
  comments: any[]
) {
  if (!isAutoMarketEnabled()) return;
  const byThread: Record<string, { comments: number; participants: Set<string> }> = {};
  threads.forEach((t) => {
    byThread[String(t.id)] = { comments: 0, participants: new Set([String(t.user_id || "")]) };
  });
  comments.forEach((c) => {
    const k = String(c.thread_id);
    if (!byThread[k]) byThread[k] = { comments: 0, participants: new Set() };
    byThread[k].comments += 1;
    if (c.user_id) byThread[k].participants.add(String(c.user_id));
  });
  const calc = (t: any) => {
    const m = byThread[String(t.id)] || { comments: 0, participants: new Set<string>() };
    const score =
      Number(t.upvotes || 0) * 2 +
      Number(t.downvotes || 0) * 0 +
      Number(m.comments || 0) +
      Number((m.participants || new Set()).size || 0);
    return { id: Number(t.id), score };
  };
  const ranked = threads.map(calc).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return;
  const now = Date.now();
  const { data: topRow } = await client
    .from("forum_threads")
    .select("*")
    .eq("id", top.id)
    .maybeSingle();
  const { data: others } = await client
    .from("forum_threads")
    .select("id")
    .eq("event_id", eventId)
    .neq("id", top.id);
  const topSince = topRow?.hot_since ? new Date(topRow.hot_since).getTime() : 0;
  if (!topSince)
    await client
      .from("forum_threads")
      .update({ hot_since: new Date().toISOString() })
      .eq("id", top.id);
  if (others && others.length)
    await client
      .from("forum_threads")
      .update({ hot_since: null })
      .in(
        "id",
        (others as any[]).map((x) => x.id)
      );
  const rawThreshold = process.env.FORUM_AUTO_MARKET_MIN_HOT_MS;
  const nThreshold = rawThreshold ? Number(rawThreshold) : NaN;
  const thresholdMs = Number.isFinite(nThreshold) && nThreshold > 0 ? nThreshold : 30 * 60 * 1000;
  const ok = topSince && now - topSince >= thresholdMs;
  if (!ok) return;
  const reviewStatus = String(topRow?.review_status || "");
  if (reviewStatus !== "approved") return;
  if (Number(topRow?.created_prediction_id || 0) > 0) return;
  const subj = String(topRow?.subject_name || "");
  const verb = String(topRow?.action_verb || "");
  const target = String(topRow?.target_value || "");
  if (!subj || !verb || !target) return;
  const cat = String(topRow?.category || "科技");
  const deadline = topRow?.deadline
    ? new Date(topRow.deadline).toISOString()
    : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const titlePreview = String(topRow?.title_preview || "");
  const criteriaPreview = String(topRow?.criteria_preview || "");
  if (!criteriaPreview) return;
  const canCreateToday = await isUnderDailyAutoMarketLimit(client);
  if (!canCreateToday) return;
  const eventTitle = `${subj}${actionLabel(verb)}${target}`;
  const seed = (eventTitle || "prediction").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const imageUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
  const { data: pred, error } = await client
    .from("predictions")
    .insert({
      title: eventTitle,
      description: titlePreview || eventTitle,
      category: cat || "其他",
      deadline,
      min_stake: 0.1,
      criteria: criteriaPreview || "以客观可验证来源为准，截止前满足条件视为达成",
      image_url: imageUrl,
      reference_url: "",
      status: "active",
    })
    .select()
    .maybeSingle();
  if (error) return;
  if (pred?.id)
    await client
      .from("forum_threads")
      .update({ created_prediction_id: Number(pred.id) })
      .eq("id", top.id);
}

// GET /api/forum?eventId=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventId = normalizeId(searchParams.get("eventId"));
  if (eventId === null || eventId <= 0) {
    return ApiResponses.invalidParameters("eventId 必填且必须为正整数");
  }
  try {
    const client = getClient();
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }
    const { data: threads, error: tErr } = await client
      .from("forum_threads")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (tErr) {
      logApiError("GET /api/forum query threads failed", tErr);
      return ApiResponses.databaseError("查询主题失败", tErr.message);
    }
    const ids = (threads || []).map((t: any) => t.id);
    let commentsByThread: Record<string, any[]> = {};
    let commentsArr: any[] = [];
    if (ids.length > 0) {
      const { data: comments, error: cErr } = await client
        .from("forum_comments")
        .select("*")
        .in("thread_id", ids)
        .order("created_at", { ascending: true });
      if (cErr) {
        logApiError("GET /api/forum query comments failed", cErr);
        return ApiResponses.databaseError("查询评论失败", cErr.message);
      }
      commentsArr = comments || [];
      commentsArr.forEach((c: any) => {
        const k = String(c.thread_id);
        (commentsByThread[k] = commentsByThread[k] || []).push(c);
      });
    }
    try {
      const admin = await isAdminSession(client as any, req);
      if (admin.ok) {
        await maybeAutoCreatePrediction(client, eventId, threads || [], commentsArr);
      }
    } catch {}
    const merged = (threads || []).map((t: any) => ({
      id: Number(t.id),
      event_id: Number(t.event_id),
      title: String(t.title || ""),
      content: String(t.content || ""),
      user_id: String(t.user_id || ""),
      created_at: String(t.created_at || ""),
      upvotes: Number(t.upvotes || 0),
      downvotes: Number(t.downvotes || 0),
      category: t.category ? normalizeCategory(String(t.category)) : undefined,
      subject_name: t.subject_name == null ? null : String(t.subject_name || ""),
      action_verb: t.action_verb == null ? null : String(t.action_verb || ""),
      target_value: t.target_value == null ? null : String(t.target_value || ""),
      deadline: t.deadline == null ? null : String(t.deadline || ""),
      title_preview: t.title_preview == null ? null : String(t.title_preview || ""),
      criteria_preview: t.criteria_preview == null ? null : String(t.criteria_preview || ""),
      created_prediction_id:
        t.created_prediction_id == null ? null : Number(t.created_prediction_id),
      review_status: String(t.review_status || "pending_review"),
      review_reason: t.review_reason == null ? null : String(t.review_reason || ""),
      comments: (commentsByThread[String(t.id)] || []).map((c: any) => ({
        id: Number(c.id),
        thread_id: Number(c.thread_id),
        event_id: Number(c.event_id),
        user_id: String(c.user_id || ""),
        content: String(c.content || ""),
        created_at: String(c.created_at || ""),
        upvotes: Number(c.upvotes || 0),
        downvotes: Number(c.downvotes || 0),
        parent_id: c.parent_id == null ? null : Number(c.parent_id),
      })),
    }));
    return NextResponse.json({ threads: merged }, { status: 200 });
  } catch (e: any) {
    logApiError("GET /api/forum unhandled error", e);
    const detail = String(e?.message || e);
    return ApiResponses.internalError(
      "查询失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}

// POST /api/forum  body: { eventId, title, content, walletAddress }
function textLengthWithoutSpaces(value: string): number {
  return value.replace(/\s+/g, "").length;
}

async function isUnderThreadRateLimit(client: any, walletAddress: string): Promise<boolean> {
  const userId = walletAddress || "guest";
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count: count10m, error: err10m } = await client
    .from("forum_threads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", tenMinutesAgo);
  if (err10m) {
    logApiError("POST /api/forum rate limit 10m query failed", err10m);
    throw err10m;
  }
  if (typeof count10m === "number" && count10m > 0) {
    return false;
  }
  const { count: count24h, error: err24h } = await client
    .from("forum_threads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", dayAgo);
  if (err24h) {
    logApiError("POST /api/forum rate limit 24h query failed", err24h);
    throw err24h;
  }
  if (typeof count24h === "number" && count24h >= 3) {
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req);
    const eventId = normalizeId(body?.eventId);
    const title = String(body?.title || "");
    const rawContent = String(body?.content || "");
    const rawWalletAddress = String(body?.walletAddress || "");
    if (eventId === null || eventId <= 0) {
      return ApiResponses.invalidParameters("eventId 必填且必须为正整数");
    }
    if (!title.trim()) {
      return ApiResponses.invalidParameters("标题必填");
    }
    if (textLengthWithoutSpaces(title) < 5) {
      return ApiResponses.invalidParameters("标题过短，请补充关键信息");
    }
    const client = (supabaseAdmin || getClient()) as any;
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }

    const sessAddr = await getSessionAddress(req);
    const walletAddress = normalizeAddress(String(sessAddr || ""));
    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
      return ApiResponses.unauthorized("未登录或会话失效");
    }
    if (rawWalletAddress && normalizeAddress(rawWalletAddress) !== walletAddress) {
      return ApiResponses.forbidden("walletAddress mismatch");
    }

    let ok: boolean;
    try {
      ok = await isUnderThreadRateLimit(client, walletAddress);
    } catch (e: any) {
      logApiError("POST /api/forum rate limit check failed", e);
      return ApiResponses.internalError(
        "限流检查失败",
        process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
      );
    }
    if (!ok) return ApiResponses.rateLimit("发起提案过于频繁，请稍后再试");
    const subject_name = String(body?.subjectName ?? body?.subject_name ?? "").trim();
    const action_verb = normalizeActionVerb(String(body?.actionVerb ?? body?.action_verb ?? ""));
    const target_value = String(body?.targetValue ?? body?.target_value ?? "").trim();
    const categoryRaw = String(body?.category || "");
    const category = categoryRaw ? normalizeCategory(categoryRaw) : "";
    const deadlineRaw = body?.deadline ?? body?.deadline_at ?? body?.resolutionTime;
    const deadline = deadlineRaw ? new Date(String(deadlineRaw)).toISOString() : null;
    const title_preview = String(body?.titlePreview ?? body?.title_preview ?? "").trim();
    const criteria_preview = String(body?.criteriaPreview ?? body?.criteria_preview ?? "").trim();

    let content = rawContent;
    if (textLengthWithoutSpaces(content) < 40) {
      const hasMetadata =
        !!title_preview ||
        !!criteria_preview ||
        !!subject_name ||
        !!action_verb ||
        !!target_value ||
        !!deadline;
      if (hasMetadata) {
        const parts: string[] = [];
        parts.push(title_preview || title.trim());
        parts.push("---");
        if (subject_name) parts.push(`Subject Name: ${subject_name}`);
        if (action_verb) parts.push(`Action Verb: ${action_verb}`);
        if (target_value) parts.push(`Target Value: ${target_value}`);
        if (deadline) parts.push(`Deadline: ${deadline}`);
        if (criteria_preview) parts.push(`Criteria: ${criteria_preview}`);
        content = parts.join("\n");
      }
    }

    if (textLengthWithoutSpaces(content) < 40) {
      return ApiResponses.invalidParameters("内容信息量不足，请至少补充 40 个字符");
    }
    const { data, error } = await client
      .from("forum_threads")
      .insert({
        event_id: eventId,
        title,
        content,
        user_id: walletAddress,
        subject_name,
        action_verb,
        target_value,
        category,
        deadline,
        title_preview,
        criteria_preview,
      })
      .select()
      .maybeSingle();
    if (error) {
      logApiError("POST /api/forum insert thread failed", error);
      return ApiResponses.databaseError("创建失败", error.message);
    }
    return NextResponse.json({ message: "ok", data }, { status: 200 });
  } catch (e: any) {
    logApiError("POST /api/forum unhandled error", e);
    const detail = String(e?.message || e);
    return ApiResponses.internalError(
      "创建失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
