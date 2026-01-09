import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getClient } from "@/lib/supabase";
import { getSessionAddress, isAdminAddress, normalizeAddress } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

type DbClient = SupabaseClient<Database>;

type EnsureAdminResult =
  | { ok: true; reason: "ok" }
  | { ok: false; reason: "unauthorized" | "forbidden" };

async function ensureAdmin(req: NextRequest, client: DbClient): Promise<EnsureAdminResult> {
  const sessAddr = await getSessionAddress(req);
  const addr = normalizeAddress(String(sessAddr || ""));
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return { ok: false, reason: "unauthorized" };
  }
  const { data: prof } = await client
    .from("user_profiles")
    .select("is_admin")
    .eq("wallet_address", addr)
    .maybeSingle<Pick<Database["public"]["Tables"]["user_profiles"]["Row"], "is_admin">>();
  const isAdmin = !!prof?.is_admin || isAdminAddress(addr);
  if (!isAdmin) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, reason: "ok" };
}

export async function GET(req: NextRequest) {
  const client = getClient() as DbClient | null;
  if (!client) {
    return ApiResponses.internalError("Supabase not configured");
  }
  const auth = await ensureAdmin(req, client);
  if (!auth.ok) {
    if (auth.reason === "unauthorized") {
      return ApiResponses.unauthorized("未登录");
    }
    return ApiResponses.forbidden("无权限");
  }
  const { data, error } = await client
    .from("user_profiles")
    .select("wallet_address,username,email,is_admin,is_reviewer,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return ApiResponses.databaseError("查询失败", error.message);
  }
  return NextResponse.json({ users: data || [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const client = getClient() as DbClient | null;
  if (!client) {
    return ApiResponses.internalError("Supabase not configured");
  }
  const auth = await ensureAdmin(req, client);
  if (!auth.ok) {
    if (auth.reason === "unauthorized") {
      return ApiResponses.unauthorized("未登录");
    }
    return ApiResponses.forbidden("无权限");
  }
  const rawBody = await req.json().catch(() => null);
  const body =
    rawBody && typeof rawBody === "object"
      ? (rawBody as { walletAddress?: unknown; isReviewer?: unknown })
      : {};
  const walletAddress = normalizeAddress(
    typeof body.walletAddress === "string" ? body.walletAddress.trim() : ""
  );
  const isReviewer = body.isReviewer === true;
  if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    return ApiResponses.badRequest("walletAddress 必填");
  }
  const { error } = await client
    .from("user_profiles")
    .update({ is_reviewer: isReviewer } as never)
    .eq("wallet_address", walletAddress);
  if (error) {
    return ApiResponses.databaseError("更新失败", error.message);
  }
  return NextResponse.json({ message: "ok" }, { status: 200 });
}
