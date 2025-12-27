import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApiResponses } from "@/lib/apiResponse";

export async function POST() {
  try {
    if (!supabase) {
      return ApiResponses.internalError("Supabase 未配置");
    }
    const { error } = await (supabase as any).auth.signOut();
    if (error) {
      return ApiResponses.badRequest("登出失败");
    }
    return NextResponse.json({ message: "ok" });
  } catch (e: any) {
    const detail = String(e?.message || e);
    return ApiResponses.internalError("登出失败", detail);
  }
}
