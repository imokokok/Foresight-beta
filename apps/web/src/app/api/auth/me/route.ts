import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ApiResponses } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function withNoStore<T>(res: NextResponse<T>) {
  try {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
  } catch {}
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);

    if (!session) {
      return withNoStore(ApiResponses.unauthorized("Not authenticated"));
    }

    try {
      const address =
        typeof session?.address === "string" ? String(session.address).toLowerCase() : "";
      const sid = typeof (session as any)?.sid === "string" ? String((session as any).sid) : "";
      if (supabaseAdmin && address && sid) {
        await (supabaseAdmin as any)
          .from("user_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("wallet_address", address)
          .eq("session_id", sid)
          .is("revoked_at", null)
          .catch(() => {});
      }
    } catch {}

    return withNoStore(
      NextResponse.json({
        authenticated: true,
        address: session.address,
        chainId: session.chainId,
      })
    );
  } catch (error: any) {
    console.error("Auth check error:", error);
    return withNoStore(
      ApiResponses.internalError("Auth check error", error?.message || "Unknown error")
    );
  }
}
