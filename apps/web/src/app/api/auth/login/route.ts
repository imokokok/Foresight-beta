import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null);

    let email = "";
    let password = "";

    if (rawBody && typeof rawBody === "object") {
      const body = rawBody as { email?: unknown; password?: unknown };
      email = typeof body.email === "string" ? body.email.trim() : "";
      password = typeof body.password === "string" ? body.password : "";
    }

    if (!email || !password) {
      return NextResponse.json({ message: "参数无效：缺少邮箱或密码" }, { status: 400 });
    }
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 未配置" }, { status: 500 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ message: "登录失败", detail: error.message }, { status: 401 });
    }
    return NextResponse.json({
      message: "ok",
      data: { session: { expires_at: data.session?.expires_at, user: data.session?.user } },
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: "登录失败", detail }, { status: 500 });
  }
}
