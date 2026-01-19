import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
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
  // 清除会话与 nonce Cookie
  const res = withNoStore(NextResponse.json({ success: true }));
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
  res.cookies.set("siwe_nonce", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: NextRequest) {
  return GET(req);
}
