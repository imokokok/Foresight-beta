import { ApiResponses } from "@/lib/apiResponse";
import { NextResponse } from "next/server";

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
    return NextResponse.json(
      { error: "该接口已弃用，请使用邮箱验证码或钱包登录", code: "DEPRECATED" },
      { status: 410 }
    );
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("登录失败", detail);
  }
}
