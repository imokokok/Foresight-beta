import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    if (!user_id) {
      return NextResponse.json({ data: [] });
    }

    const client = supabaseAdmin || getClient();
    if (!client) return NextResponse.json({ data: [] });

    // Assuming we have a table `user_stickers` with columns: id, user_id, sticker_id, created_at
    // Since we cannot run SQL migration directly, we assume this table exists or we gracefully handle error.
    // If table doesn't exist, this will error out, but for now we implement the logic.
    
    const { data, error } = await client
      .from("user_stickers")
      .select("sticker_id")
      .eq("user_id", user_id);

    if (error) {
      console.error("Fetch stickers error:", error);
      return NextResponse.json({ data: [] });
    }

    const ids = data ? data.map((r: any) => r.sticker_id) : [];
    // Deduplicate
    return NextResponse.json({ data: Array.from(new Set(ids)) });
  } catch (e) {
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, sticker_id } = body;
    
    if (!user_id || !sticker_id) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const client = supabaseAdmin || getClient();
    if (!client) return NextResponse.json({ error: "No DB" }, { status: 500 });

    const { error } = await client.from("user_stickers").insert({
      user_id,
      sticker_id,
      created_at: new Date().toISOString(),
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
