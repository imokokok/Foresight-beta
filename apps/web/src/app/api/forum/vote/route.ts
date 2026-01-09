import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { ApiResponses } from "@/lib/apiResponse";
import { getSessionAddress, normalizeAddress } from "@/lib/serverUtils";

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// POST /api/forum/vote  body: { type: 'thread'|'comment', id: number, dir: 'up'|'down' }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const type = body?.type === "comment" ? "comment" : "thread";
    const dir = body?.dir === "down" ? "down" : "up";
    const id = toNum(body?.id);
    if (!id) return ApiResponses.badRequest("id 必填");
    const userAddr = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(userAddr)) return ApiResponses.unauthorized("未登录或会话失效");

    // 内容存在性与事件ID解析
    let eventId: number | null = null;
    const client = getClient();
    if (type === "thread") {
      const { data: t, error } = await client
        .from("forum_threads")
        .select("event_id, upvotes, downvotes")
        .eq("id", id)
        .maybeSingle();
      if (error) return ApiResponses.databaseError("查询失败", error.message);
      if (!t) return ApiResponses.notFound("未找到对象");
      eventId = Number((t as any).event_id);
    } else {
      const { data: c, error } = await client
        .from("forum_comments")
        .select("event_id, upvotes, downvotes")
        .eq("id", id)
        .maybeSingle();
      if (error) return ApiResponses.databaseError("查询失败", error.message);
      if (!c) return ApiResponses.notFound("未找到对象");
      eventId = Number((c as any).event_id);
    }
    if (!Number.isFinite(eventId)) return ApiResponses.badRequest("事件不存在或无效");

    if (!supabaseAdmin) {
      return ApiResponses.internalError("服务端未配置 SUPABASE_SERVICE_KEY");
    }

    const admin = (supabaseAdmin || client) as any;

    // 重复投票检查
    const { data: existing, error: existErr } = await admin
      .from("forum_votes")
      .select("id")
      .eq("user_id", userAddr)
      .eq("content_type", type)
      .eq("content_id", id)
      .maybeSingle();
    if (existErr) {
      return ApiResponses.databaseError("检查投票状态失败", existErr.message);
    }
    if (existing) {
      return ApiResponses.conflict("您已经投过票了");
    }

    // 写入投票记录（唯一约束防止并发重复）
    const { error: insErr } = await admin.from("forum_votes").insert({
      user_id: userAddr,
      event_id: eventId,
      content_id: id,
      content_type: type,
      vote_type: dir,
    });
    if (insErr) {
      const msg = (insErr.message || "").toLowerCase();
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return ApiResponses.conflict("您已经投过票了");
      }
      return ApiResponses.databaseError("投票记录写入失败", insErr.message);
    }

    // 更新本地计数用于 UI
    // 更新计数（简化处理，读取后 +1 写回）
    if (type === "thread") {
      const { data: cur } = await admin
        .from("forum_threads")
        .select("upvotes, downvotes")
        .eq("id", id)
        .maybeSingle();
      const up = Number((cur as any)?.upvotes || 0) + (dir === "up" ? 1 : 0);
      const down = Number((cur as any)?.downvotes || 0) + (dir === "down" ? 1 : 0);
      const { data: updated, error: uerr } = await admin
        .from("forum_threads")
        .update({ upvotes: up, downvotes: down })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (uerr) return ApiResponses.databaseError("更新失败", uerr.message);
      return NextResponse.json({ message: "ok", data: updated, voted: { type, id, dir } });
    } else {
      const { data: cur } = await admin
        .from("forum_comments")
        .select("upvotes, downvotes")
        .eq("id", id)
        .maybeSingle();
      const up = Number((cur as any)?.upvotes || 0) + (dir === "up" ? 1 : 0);
      const down = Number((cur as any)?.downvotes || 0) + (dir === "down" ? 1 : 0);
      const { data: updated, error: uerr } = await admin
        .from("forum_comments")
        .update({ upvotes: up, downvotes: down })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (uerr) return ApiResponses.databaseError("更新失败", uerr.message);
      return NextResponse.json({ message: "ok", data: updated, voted: { type, id, dir } });
    }
  } catch (e: any) {
    return ApiResponses.internalError("投票失败", String(e?.message || e));
  }
}
