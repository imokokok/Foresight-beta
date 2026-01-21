import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getSessionAddress, normalizeAddress, logApiError } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

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

function textLengthWithoutSpaces(value: string): number {
  return value.replace(/\s+/g, "").length;
}

async function isUnderCommentRateLimit(client: any, walletAddress: string): Promise<boolean> {
  const userId = walletAddress || "guest";
  const now = new Date();
  const fifteenSecondsAgo = new Date(now.getTime() - 15 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count: count15s, error: err15s } = await client
    .from("forum_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", fifteenSecondsAgo);
  if (err15s) {
    logApiError("POST /api/forum/comments rate limit 15s query failed", err15s);
    throw err15s;
  }
  if (typeof count15s === "number" && count15s > 0) {
    return false;
  }
  const { count: count24h, error: err24h } = await client
    .from("forum_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", dayAgo);
  if (err24h) {
    logApiError("POST /api/forum/comments rate limit 24h query failed", err24h);
    throw err24h;
  }
  if (typeof count24h === "number" && count24h >= 30) {
    return false;
  }
  return true;
}

// POST /api/forum/comments  body: { eventId, threadId, content, walletAddress, parentId? }
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req);
    const eventId = toNum((body as { eventId?: unknown }).eventId);
    const threadId = toNum((body as { threadId?: unknown }).threadId);
    const parentIdRaw = (body as { parentId?: unknown }).parentId;
    const parentId = parentIdRaw == null ? null : toNum(parentIdRaw);
    const content = String((body as { content?: unknown }).content || "").slice(0, 4000);
    const rawWalletAddress = String((body as { walletAddress?: unknown }).walletAddress || "");
    if (parentIdRaw != null && parentId == null) {
      return ApiResponses.invalidParameters("parentId is invalid");
    }
    if (eventId == null || eventId < 0 || threadId == null || threadId <= 0) {
      return ApiResponses.invalidParameters(
        "eventId and threadId are required and must be valid integers"
      );
    }
    if (!content.trim()) {
      return ApiResponses.invalidParameters("content is required");
    }
    if (textLengthWithoutSpaces(content) < 2) {
      return ApiResponses.invalidParameters("Comment is too short");
    }
    if (textLengthWithoutSpaces(content) > 2000) {
      return ApiResponses.invalidParameters("Comment is too long");
    }
    const client = supabaseAdmin;
    if (!client) {
      return ApiResponses.internalError("Supabase is not configured");
    }

    const sessAddr = await getSessionAddress(req);
    const walletAddress = normalizeAddress(String(sessAddr || ""));
    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
      return ApiResponses.unauthorized("Unauthorized or session expired");
    }
    if (rawWalletAddress && normalizeAddress(rawWalletAddress) !== walletAddress) {
      return ApiResponses.forbidden("walletAddress mismatch");
    }

    let ok: boolean;
    try {
      ok = await isUnderCommentRateLimit(client, walletAddress);
    } catch (e: any) {
      logApiError("POST /api/forum/comments rate limit check failed", e);
      return ApiResponses.internalError(
        "Failed to check rate limit",
        process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
      );
    }
    if (!ok) return ApiResponses.rateLimit("Too many comments, please try again later");
    const { data, error } = await (client as any)
      .from("forum_comments")
      .insert({
        event_id: eventId,
        thread_id: threadId,
        content,
        user_id: walletAddress,
        parent_id: parentId,
      })
      .select()
      .maybeSingle();
    if (error) {
      logApiError("POST /api/forum/comments insert failed", error);
      return ApiResponses.databaseError("Failed to create comment", error.message);
    }
    return NextResponse.json({ message: "ok", data }, { status: 200 });
  } catch (e: any) {
    logApiError("POST /api/forum/comments unhandled error", e);
    const detail = String(e?.message || e);
    return ApiResponses.internalError(
      "Failed to create comment",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
