import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin || getClient();
    if (!client) return NextResponse.json({ data: [] });

    const { data, error } = await client
      .from("emojis")
      .select("*")
      .order('id');

    if (error) {
      console.error("Fetch emojis error:", error);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ data: [] });
  }
}
