import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import {
  getSessionAddress,
  isAdminAddress,
  normalizeAddress,
  parseRequestBody,
  logApiError,
} from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
function normalizeActionVerb(v: string): string {
  const s = String(v || "").trim();
  if (s === "priceReach" || s === "willHappen" || s === "willWin") return s;
  if (s === "价格达到") return "priceReach";
  if (s === "将会发生") return "willHappen";
  if (s === "将会赢得") return "willWin";
  return s;
}
function actionLabel(v: string): string {
  const normalized = normalizeActionVerb(v);
  if (normalized === "priceReach") return "价格是否会达到";
  if (normalized === "willHappen") return "是否将会发生";
  if (normalized === "willWin") return "是否将会赢得";
  if (!normalized) return "是否将会发生";
  if (normalized.includes("是否")) return normalized;
  return `是否${normalized}`;
}

export async function POST(req: NextRequest) {
  try {
    const sessAddr = await getSessionAddress(req);
    const caller = normalizeAddress(String(sessAddr || ""));
    if (!/^0x[a-f0-9]{40}$/.test(caller)) {
      return ApiResponses.unauthorized("未登录");
    }
    if (!isAdminAddress(caller)) {
      return ApiResponses.forbidden("无权限");
    }

    const ip = getIP(req);
    const rl = await checkRateLimit(ip || "unknown", RateLimits.strict, "forum_triggers_run_ip");
    if (!rl.success) return ApiResponses.rateLimit("操作过于频繁，请稍后再试");

    const body = await parseRequestBody(req as any);
    const { searchParams } = new URL(req.url);
    const eventId = normalizeId(body?.eventId ?? searchParams.get("eventId"));
    if (eventId === null || eventId <= 0) {
      return ApiResponses.invalidParameters("eventId 必填且必须为正整数");
    }
    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }
    const { data: rawThreads, error: tErr } = await client
      .from("forum_threads")
      .select("*")
      .eq("event_id", eventId);

    const threads = rawThreads as Array<{
      id: number;
      user_id: string;
      upvotes: number;
      subject_name?: string;
      title?: string;
      action_verb?: string;
      target_value?: string;
      category?: string;
      deadline?: string;
      title_preview?: string;
      criteria_preview?: string;
    }> | null;

    if (tErr) {
      logApiError("POST /api/forum/triggers/run query threads failed", tErr);
      return ApiResponses.databaseError("查询主题失败", tErr.message);
    }
    const ids = (threads || []).map((t) => t.id);
    let comments: any[] = [];
    if (ids.length > 0) {
      const { data: rows, error: cErr } = await client
        .from("forum_comments")
        .select("thread_id,user_id")
        .in("thread_id", ids);
      if (cErr) {
        logApiError("POST /api/forum/triggers/run query comments failed", cErr);
        return ApiResponses.databaseError("查询评论失败", cErr.message);
      }
      comments = rows || [];
    }
    const stat: Record<string, { comments: number; participants: Set<string> }> = {};
    threads?.forEach((t) => {
      stat[String(t.id)] = {
        comments: 0,
        participants: new Set([String(t.user_id || "")]),
      };
    });
    comments.forEach((c) => {
      const k = String(c.thread_id);
      if (!stat[k]) stat[k] = { comments: 0, participants: new Set() };
      stat[k].comments += 1;
      if (c.user_id) stat[k].participants.add(String(c.user_id));
    });
    const ranked = (threads || [])
      .map((t) => ({
        id: Number(t.id),
        score:
          Number(t.upvotes || 0) * 2 +
          (stat[String(t.id)]?.comments || 0) +
          (stat[String(t.id)]?.participants?.size || 0),
      }))
      .sort((a, b) => b.score - a.score);
    const top = ranked[0];
    if (!top) {
      return ApiResponses.notFound("暂无主题");
    }
    const { data: topRowRaw } = await client
      .from("forum_threads")
      .select("*")
      .eq("id", top.id)
      .maybeSingle();
    const topRow = topRowRaw as {
      subject_name?: string;
      title?: string;
      action_verb?: string;
      target_value?: string;
      category?: string;
      deadline?: string;
      title_preview?: string;
      criteria_preview?: string;
      user_id?: string;
      created_at?: string;
    } | null;

    const subj = String(topRow?.subject_name || topRow?.title || "")
      .trim()
      .slice(0, 120);
    const verb = String(topRow?.action_verb || "")
      .trim()
      .slice(0, 40);
    const target = String(topRow?.target_value || "")
      .trim()
      .slice(0, 120);
    const cat = String(topRow?.category || "")
      .trim()
      .slice(0, 32);
    const fallbackDeadline = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    let deadline = fallbackDeadline;
    if (topRow?.deadline) {
      const d = new Date(String(topRow.deadline));
      if (Number.isFinite(d.getTime())) deadline = d.toISOString();
    }
    const titlePreview = String(topRow?.title_preview || subj)
      .trim()
      .slice(0, 4000);
    const criteriaPreview = String(
      topRow?.criteria_preview || "以客观可验证来源为准，截止前满足条件视为达成"
    )
      .trim()
      .slice(0, 4000);
    const eventTitle = `${subj}${actionLabel(verb)}${target}`.trim().slice(0, 200);
    const seed = (eventTitle || "prediction").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const imageUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
      seed
    )}&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20`;
    const { data: predRaw, error } = await client
      .from("predictions")
      .insert({
        title: eventTitle || topRow?.title || "",
        description: titlePreview || topRow?.title || "",
        category: cat || "其他",
        deadline,
        min_stake: 0.1,
        criteria: criteriaPreview,
        image_url: imageUrl,
        reference_url: "",
        status: "active",
      } as any)
      .select()
      .maybeSingle();

    const pred = predRaw as { id: number } | null;

    if (error) {
      logApiError("POST /api/forum/triggers/run create prediction failed", error);
      return ApiResponses.databaseError("创建失败", error.message);
    }
    if (pred?.id)
      await client
        .from("forum_threads")
        .update({
          created_prediction_id: Number(pred.id),
          hot_since: new Date().toISOString(),
        } as any)
        .eq("id", top.id);
    return NextResponse.json(
      { message: "ok", prediction: pred, thread_id: top.id },
      { status: 200 }
    );
  } catch (e) {
    const error = e as Error;
    logApiError("POST /api/forum/triggers/run unhandled error", error);
    const detail = String(error?.message || error);
    return ApiResponses.internalError(
      "触发失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
