import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiResponses } from "@/lib/apiResponse";

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
      return ApiResponses.invalidParameters("参数无效：缺少邮箱或密码");
    }
    if (!supabase) {
      return ApiResponses.internalError("Supabase 未配置");
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return ApiResponses.unauthorized("登录失败");
    }
    return NextResponse.json({
      message: "ok",
      data: { session: { expires_at: data.session?.expires_at, user: data.session?.user } },
    });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("登录失败", detail);
  }
}
