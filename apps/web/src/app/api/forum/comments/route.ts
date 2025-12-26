import { NextResponse } from "next/server";
import { getClient, supabaseAdmin } from "@/lib/supabase";

function toNum(v: unknown): number | null {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const txt = await req.text();
      try {
        return JSON.parse(txt);
      } catch {
        return {};
      }
    }
    if (ct.includes("application/x-www-form-urlencoded")) {
      const txt = await req.text();
      const params = new URLSearchParams(txt);
      return Object.fromEntries(params.entries());
    }
    if (ct.includes("multipart/form-data")) {
      const form = await (req as any).formData?.();
      if (form && typeof form.entries === "function") {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of form.entries()) obj[k] = v;
        return obj;
      }
      return {};
    }
    const txt = await req.text();
    if (txt) {
      try {
        return JSON.parse(txt);
      } catch {
        return {};
      }
    }
    return {};
  } catch {
    return {};
  }
}

// POST /api/forum/comments  body: { eventId, threadId, content, walletAddress, parentId? }
export async function POST(req: Request) {
  try {
    const body = await parseBody(req);
    const eventId = toNum((body as { eventId?: unknown }).eventId);
    const threadId = toNum((body as { threadId?: unknown }).threadId);
    const parentIdRaw = (body as { parentId?: unknown }).parentId;
    const parentId = parentIdRaw == null ? null : toNum(parentIdRaw);
    const content = String((body as { content?: unknown }).content || "");
    const walletAddress = String((body as { walletAddress?: unknown }).walletAddress || "");
    if (!eventId || !threadId || !content.trim()) {
      return NextResponse.json({ message: "eventId、threadId、content 必填" }, { status: 400 });
    }
    const client = supabaseAdmin || getClient();
    const { data, error } = await (client as any)
      .from("forum_comments")
      .insert({
        event_id: eventId,
        thread_id: threadId,
        content,
        user_id: walletAddress || "guest",
        parent_id: parentId,
      })
      .select()
      .maybeSingle();
    if (error)
      return NextResponse.json({ message: "创建失败", detail: error.message }, { status: 500 });
    return NextResponse.json({ message: "ok", data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "创建失败", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
