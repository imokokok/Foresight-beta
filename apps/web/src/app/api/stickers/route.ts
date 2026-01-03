import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { getSessionAddress } from "@/lib/serverUtils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    if (!user_id) {
      return NextResponse.json({ stickers: [] });
    }

    const client = supabaseAdmin || getClient();
    if (!client) return NextResponse.json({ stickers: [] });

    // Use user_emojis table
    const { data, error } = await client
      .from("user_emojis")
      .select("emoji_id")
      .eq("user_id", user_id);

    if (error) {
      console.error("Fetch stickers error:", error);
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
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const sessionUser = await getSessionAddress(req as any);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.toLowerCase() !== String(user_id).toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = supabaseAdmin || getClient();
    if (!client) return NextResponse.json({ error: "No DB" }, { status: 500 });

    const { error } = await (client.from("user_emojis") as any).insert({
      user_id,
      emoji_id: sticker_id,
      source: "manual_api",
    });

    if (error) {
      console.error("Save sticker error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
