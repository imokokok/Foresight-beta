import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { logApiError } from "@/lib/serverUtils";

export async function GET(_req: NextRequest) {
  try {
    const client = supabaseAdmin as any;
    if (!client) return NextResponse.json({ data: [] });

    const { data, error } = await client.from("emojis").select("*").order("id");

    if (error) {
      logApiError("GET /api/emojis fetch failed", error);
      return NextResponse.json({ data: [] });
    }

    const getRarityClass = (r: string) => {
      switch (r) {
        case "common":
          return "bg-green-100";
        case "rare":
          return "bg-blue-100";
        case "epic":
          return "bg-purple-100";
        case "legendary":
          return "bg-fuchsia-100";
        default:
          return "bg-gray-100";
      }
    };

    const formatted = (data as any[]).map((e: any) => ({
      id: String(e.id),
      emoji: e.image_url || e.url || "❓",
      name: e.name,
      rarity: e.rarity || "common",
      desc: e.description || "",
      color: getRarityClass(e.rarity),
      image_url: e.image_url || e.url,
    }));

    return NextResponse.json({ data: formatted });
  } catch (e) {
    logApiError("GET /api/emojis unhandled error", e);
    return NextResponse.json({ data: [] });
  }
}
