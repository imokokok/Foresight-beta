import { NextRequest, NextResponse } from "next/server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase.server";

export async function POST(req: NextRequest) {
  try {
    const res = NextResponse.json({ message: "ok" });
    const { clearSession } = await import("@/lib/session");
    try {
      const session = await getSession(req);
      const address =
        typeof session?.address === "string" ? String(session.address).toLowerCase() : "";
      const sid = typeof (session as any)?.sid === "string" ? String((session as any).sid) : "";
      if (supabaseAdmin && address && sid) {
        await (supabaseAdmin as any)
          .from("user_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("wallet_address", address)
          .eq("session_id", sid)
          .is("revoked_at", null)
          .catch(() => {});
      }
    } catch {}
    clearSession(res, req);
    return res;
  } catch (e) {
    const error = e as Error;
    const detail = String(error?.message || error);
    return ApiResponses.internalError("登出失败", detail);
  }
}
