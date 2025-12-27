import { NextResponse } from "next/server";
import { addMessage, getMessagesByEvent } from "@/lib/localChatStore";
import { parseRequestBody } from "@/lib/serverUtils";
import { normalizeId } from "@/lib/ids";
import { ApiResponses } from "@/lib/apiResponse";

// GET /api/chat?eventId=1&limit=50
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = normalizeId(searchParams.get("eventId"));
  const limit = normalizeId(searchParams.get("limit")) ?? 50;
  const since = searchParams.get("since") || undefined;
  if (!eventId) {
    return ApiResponses.invalidParameters("eventId 必填");
  }
  const list = await getMessagesByEvent(eventId, limit, since);
  return NextResponse.json({ messages: list }, { status: 200 });
}

// POST /api/chat  body: { eventId, content, walletAddress }
export async function POST(req: Request) {
  try {
    const body = await parseRequestBody(req);
    const eventId = normalizeId(body?.eventId);
    const content = String(body?.content || "");
    const walletAddress = String(body?.walletAddress || "");
    if (!eventId || !content.trim()) {
      return ApiResponses.invalidParameters("eventId 与 content 必填");
    }
    const msg = await addMessage(walletAddress || "guest", eventId, content);
    return NextResponse.json({ message: "ok", data: msg }, { status: 200 });
  } catch (e: any) {
    const detail = String(e?.message || e);
    return ApiResponses.internalError("发送失败", detail);
  }
}
