import { NextRequest } from "next/server";
import { ApiResponses } from "@/lib/apiResponse";

export async function POST(_req: NextRequest) {
  return ApiResponses.badRequest("该接口已弃用，请使用邮箱验证码登录");
}
