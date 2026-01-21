import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getSessionAddress, logApiError, normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";
import { checkRateLimit, RateLimits } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    if (!user_id) {
      return NextResponse.json({ stickers: [] });
    }

    const normalizedUserId = normalizeAddress(String(user_id || ""));
    if (!/^0x[a-f0-9]{40}$/.test(normalizedUserId)) {
      return NextResponse.json({ stickers: [] });
    }

    const client = supabaseAdmin;
    if (!client) return NextResponse.json({ stickers: [] });

    // Use user_emojis table
    const { data, error } = await client
      .from("user_emojis")
      .select("emoji_id")
      .eq("user_id", normalizedUserId);

    if (error) {
      logApiError("GET /api/stickers fetch failed", error);
      return NextResponse.json({ stickers: [] });
    }

    const ids = data ? data.map((r: any) => String(r.emoji_id)) : [];
    const uniqueIds = Array.from(new Set(ids));
    const stickers = uniqueIds.map((id) => ({ sticker_id: id }));

    return NextResponse.json({ stickers });
  } catch (e) {
    return NextResponse.json({ stickers: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, sticker_id } = body;

    if (!user_id || !sticker_id) {
      return ApiResponses.badRequest("Missing params");
    }

    const sessionUser = normalizeAddress(String((await getSessionAddress(req as any)) || ""));
    if (!/^0x[a-f0-9]{40}$/.test(sessionUser)) {
      return ApiResponses.unauthorized("Unauthorized");
    }

    const normalizedUserId = normalizeAddress(String(user_id || ""));
    if (!/^0x[a-f0-9]{40}$/.test(normalizedUserId)) {
      return ApiResponses.badRequest("Invalid user_id");
    }
    if (sessionUser !== normalizedUserId) {
      return ApiResponses.forbidden("Forbidden");
    }

    const client = supabaseAdmin;
    if (!client) return ApiResponses.internalError("No DB");

    const rl = await checkRateLimit(sessionUser, RateLimits.moderate, "stickers_add_user");
    if (!rl.success) return ApiResponses.rateLimit("Too many requests");

    const stickerIdRaw = String(sticker_id || "")
      .trim()
      .slice(0, 64);
    const emojiId = Number(stickerIdRaw);
    if (!Number.isFinite(emojiId) || !Number.isInteger(emojiId) || emojiId <= 0) {
      return ApiResponses.badRequest("Invalid sticker_id");
    }

    const { error } = await (client.from("user_emojis") as any).insert({
      user_id: sessionUser,
      emoji_id: emojiId,
      source: "manual_api",
    });

    if (error) {
      logApiError("POST /api/stickers insert failed", error);
      return ApiResponses.databaseError("Failed to save sticker", error.message);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    logApiError("POST /api/stickers unhandled error", e);
    return ApiResponses.internalError("Failed to save sticker", String(e));
  }
}
