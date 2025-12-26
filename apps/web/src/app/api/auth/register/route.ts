import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

    if (!validateEmail(email) || password.length < 6) {
      return NextResponse.json({ message: "参数无效：邮箱或密码不符合要求" }, { status: 400 });
    }
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 未配置" }, { status: 500 });
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return NextResponse.json({ message: "注册失败", detail: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: "ok", data });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: "注册失败", detail }, { status: 500 });
  }
}
