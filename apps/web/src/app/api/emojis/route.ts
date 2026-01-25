import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { logApiError } from "@/lib/serverUtils";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

interface EmojiRow {
  id: number;
  name: string | null;
  image_url: string | null;
  url: string | null;
  rarity: string | null;
  description: string | null;
}

interface FormattedEmoji {
  id: string;
  emoji: string;
  name: string | null;
  rarity: string;
  desc: string;
  color: string;
  image_url: string | null;
}

function getRarityClass(r: string): string {
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
}

export async function GET(_req: NextRequest) {
  try {
    const client = supabaseAdmin;
    if (!client) return successResponse({ data: [] });

    const { data, error } = await client.from("emojis").select("*").order("id");

    if (error) {
      logApiError("GET /api/emojis fetch failed", error);
      return successResponse({ data: [] });
    }

    const emojiList = (data || []) as EmojiRow[];
    const formatted: FormattedEmoji[] = emojiList.map((e) => ({
      id: String(e.id),
      emoji: e.image_url || e.url || "❓",
      name: e.name,
      rarity: e.rarity || "common",
      desc: e.description || "",
      color: getRarityClass(e.rarity || ""),
      image_url: e.image_url || e.url,
    }));

    return successResponse({ data: formatted });
  } catch (e) {
    const error = e as Error;
    logApiError("GET /api/emojis unhandled error", error);
    return successResponse({ data: [] });
  }
}
