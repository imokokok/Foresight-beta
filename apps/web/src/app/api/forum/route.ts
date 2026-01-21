import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import {
  getSessionAddress,
  normalizeAddress,
  parseRequestBody,
  logApiError,
} from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import { ApiResponses } from "@/lib/apiResponse";
import { normalizeCategory } from "@/lib/categories";

// 论坛数据可以短暂缓存
export const revalidate = 30; // 30秒缓存

function normalizeActionVerb(v: string): string {
  const s = String(v || "").trim();
  if (s === "priceReach" || s === "willHappen" || s === "willWin") return s;
  if (s === "价格达到") return "priceReach";
  if (s === "将会发生") return "willHappen";
  if (s === "将会赢得") return "willWin";
  return s;
}

function actionVerbLabel(v: string): string {
  const s = normalizeActionVerb(v);
  if (s === "priceReach") return "价格达到";
  if (s === "willHappen") return "将会发生";
  if (s === "willWin") return "将会赢得";
  return s;
}

// GET /api/forum?eventId=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventIdRaw = searchParams.get("eventId");
  // Allow 0 for proposals
  const eventId = eventIdRaw === "0" ? 0 : normalizeId(eventIdRaw);

  if (eventId === null || eventId < 0) {
    return ApiResponses.invalidParameters("eventId 必填且必须为非负整数");
  }
  try {
    const client = supabaseAdmin;
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
      const commentsArr = comments || [];
      commentsArr.forEach((c: any) => {
        const k = String(c.thread_id);
        (commentsByThread[k] = commentsByThread[k] || []).push(c);
      });
    }

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
      primary_source_url: t.primary_source_url == null ? null : String(t.primary_source_url || ""),
      outcomes: Array.isArray(t.outcomes) ? t.outcomes : null,
      extra_links: Array.isArray(t.extra_links) ? t.extra_links : null,
      image_urls: Array.isArray(t.image_urls) ? t.image_urls : null,
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
    // Allow 0 for proposals
    const eventIdRaw = body?.eventId;
    const eventId = eventIdRaw === 0 || eventIdRaw === "0" ? 0 : normalizeId(eventIdRaw);

    const title = String(body?.title || "")
      .trim()
      .slice(0, 200);
    const rawContent = String(body?.content || "").slice(0, 8000);
    const rawWalletAddress = String(body?.walletAddress || "");
    if (eventId === null || eventId < 0) {
      return ApiResponses.invalidParameters("eventId 必填且必须为非负整数");
    }
    if (!title) {
      return ApiResponses.invalidParameters("标题必填");
    }
    if (textLengthWithoutSpaces(title) < 5) {
      return ApiResponses.invalidParameters("标题过短，请补充关键信息");
    }
    const client = supabaseAdmin as any;
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
    const subject_name = String(body?.subjectName ?? body?.subject_name ?? "")
      .trim()
      .slice(0, 120);
    const action_verb = normalizeActionVerb(String(body?.actionVerb ?? body?.action_verb ?? ""))
      .trim()
      .slice(0, 40);
    const target_value = String(body?.targetValue ?? body?.target_value ?? "")
      .trim()
      .slice(0, 120);
    const categoryRaw = String(body?.category || "");
    const category = categoryRaw ? normalizeCategory(categoryRaw) : "";
    const deadlineRaw = body?.deadline ?? body?.deadline_at ?? body?.resolutionTime;
    let deadline: string | null = null;
    if (deadlineRaw) {
      const d = new Date(String(deadlineRaw));
      if (!Number.isFinite(d.getTime())) {
        return ApiResponses.invalidParameters("Invalid deadline format");
      }
      deadline = d.toISOString();
    }
    const title_preview = String(body?.titlePreview ?? body?.title_preview ?? "")
      .trim()
      .slice(0, 4000);
    const criteria_preview = String(body?.criteriaPreview ?? body?.criteria_preview ?? "")
      .trim()
      .slice(0, 4000);
    const primarySourceUrl = String(
      body?.primarySourceUrl ?? body?.primary_source_url ?? ""
    ).trim();
    const outcomesRaw = body?.outcomes;
    const extraLinksRaw = body?.extraLinks ?? body?.extra_links;
    const imageUrlsRaw = body?.imageUrls ?? body?.image_urls;
    const outcomes =
      Array.isArray(outcomesRaw) && outcomesRaw.length > 0
        ? outcomesRaw
            .map((x: unknown) => String(x || "").trim())
            .filter(Boolean)
            .slice(0, 16)
        : [];
    const extraLinks =
      Array.isArray(extraLinksRaw) && extraLinksRaw.length > 0
        ? extraLinksRaw
            .map((x: unknown) => String(x || "").trim())
            .filter(Boolean)
            .slice(0, 16)
        : [];
    const imageUrls =
      Array.isArray(imageUrlsRaw) && imageUrlsRaw.length > 0
        ? imageUrlsRaw
            .map((x: unknown) => String(x || "").trim())
            .filter(Boolean)
            .slice(0, 16)
        : [];

    let content = rawContent;
    const details: string[] = [];
    if (subject_name) details.push(`Subject Name: ${subject_name}`);
    if (action_verb) details.push(`Action Verb: ${actionVerbLabel(action_verb)}`);
    if (target_value) details.push(`Target Value: ${target_value}`);
    if (deadline) details.push(`Deadline: ${deadline}`);
    if (criteria_preview) details.push(`Criteria: ${criteria_preview}`);
    const extraParts: string[] = [];
    if (primarySourceUrl) extraParts.push(`Primary Source: ${primarySourceUrl}`);
    if (outcomes.length > 0) {
      extraParts.push(`Outcomes: ${outcomes.join(", ")}`);
    }
    if (extraLinks.length > 0) {
      extraParts.push(`Extra Links: ${extraLinks.join(", ")}`);
    }
    if (imageUrls.length > 0) {
      extraParts.push(`Images: ${imageUrls.join(", ")}`);
    }
    if (textLengthWithoutSpaces(content) < 40) {
      if (title_preview || details.length > 0 || extraParts.length > 0) {
        const parts: string[] = [];
        if (title_preview || title) parts.push(title_preview || title);
        if (details.length > 0 || extraParts.length > 0) {
          parts.push("---");
          parts.push(...details, ...extraParts);
        }
        content = parts.join("\n").slice(0, 8000);
      }
    } else if (extraParts.length > 0) {
      const appended = ["", "---", ...extraParts].join("\n");
      content = `${content}${appended}`.slice(0, 8000);
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
        primary_source_url: primarySourceUrl || null,
        outcomes,
        extra_links: extraLinks,
        image_urls: imageUrls,
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
