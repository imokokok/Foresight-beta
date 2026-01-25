import { NextResponse } from "next/server";
import { ApiResponses } from "@/lib/apiResponse";

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
      return ApiResponses.invalidParameters("参数无效：邮箱或密码不符合要求");
    }
    return NextResponse.json(
      { error: "该接口已弃用，请使用邮箱验证码或钱包登录", code: "DEPRECATED" },
      { status: 410 }
    );
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("注册失败", detail);
  }
}
