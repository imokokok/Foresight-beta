import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { ApiResponses } from "@/lib/apiResponse";
import { getSessionAddress, normalizeAddress } from "@/lib/serverUtils";
import { getPendingReviewCountForWitness, getTodayPendingCheckins } from "@/lib/flagRewards";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  url: string | null;
  created_at: string;
  read_at: string | null;
  payload?: unknown;
};

function parseCursor(raw: string | null) {
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  if (!/^[0-9A-Za-z:\-+.TZ]+:[0-9]+$/.test(decoded)) return null;
  const idx = decoded.lastIndexOf(":");
  if (idx <= 0) return null;
  const createdAt = decoded.slice(0, idx);
  const idStr = decoded.slice(idx + 1);
  const id = Number(idStr);
  if (!createdAt || !Number.isFinite(id)) return null;
  return { createdAt, id };
}

function buildCursor(createdAt: string, id: number) {
  return encodeURIComponent(`${createdAt}:${id}`);
}

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized();

    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit") || 20);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 20));
    const unreadOnly = String(searchParams.get("unread") || "") === "1";
    const cursor = parseCursor(searchParams.get("cursor"));

    let q = client
      .from("notifications")
      .select("id,type,title,message,url,created_at,read_at")
      .eq("recipient_id", viewer)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (unreadOnly) q = q.is("read_at", null);

    if (cursor) {
      q = q.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }

    const { data, error } = await q;
    if (error) return ApiResponses.databaseError("Query failed", error.message);

    const rows = (Array.isArray(data) ? data : []) as any[];
    const items: NotificationItem[] = rows.map((r) => ({
      id: String(r?.id ?? ""),
      type: String(r?.type || ""),
      title: String(r?.title || ""),
      message: String(r?.message || ""),
      url: r?.url ? String(r.url) : null,
      created_at: String(r?.created_at || ""),
      read_at: r?.read_at ? String(r.read_at) : null,
    }));

    let pendingReviewCount = 0;
    let todayPendingCheckins = 0;
    let sampleTitles: string[] = [];
    const syntheticItems: NotificationItem[] = [];

    if (!cursor) {
      pendingReviewCount = await getPendingReviewCountForWitness({
        client,
        witnessId: viewer,
      });

      const today = await getTodayPendingCheckins({
        client,
        userId: viewer,
      });
      todayPendingCheckins = today.count;
      sampleTitles = today.sampleTitles;

      if (pendingReviewCount > 0) {
        syntheticItems.push({
          id: `pending_review:${viewer}`,
          type: "pending_review",
          title: "",
          message: String(pendingReviewCount),
          url: "/flags",
          created_at: new Date().toISOString(),
          read_at: null,
        });
      }

      if (todayPendingCheckins > 0) {
        syntheticItems.push({
          id: `flag_checkin_reminder:${viewer}`,
          type: "flag_checkin_reminder",
          title: "",
          message: String(todayPendingCheckins),
          url: "/flags",
          created_at: new Date().toISOString(),
          read_at: null,
          payload: {
            sampleTitles,
          },
        } as any);
      }
    }

    const combined = [...syntheticItems, ...items];
    const last = items[items.length - 1];
    const nextCursor = last ? buildCursor(last.created_at, Number(last.id)) : null;

    return NextResponse.json({
      notifications: combined,
      nextCursor,
      pendingReviewCount,
    });
  } catch (error: any) {
    return ApiResponses.internalError(error?.message || "Request failed");
  }
}
