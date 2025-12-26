import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getClient } from "@/lib/supabase";
import { getSessionAddress, isAdminAddress, normalizeAddress } from "@/lib/serverUtils";

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
    return NextResponse.json({ message: "Supabase not configured" }, { status: 500 });
  }
  const auth = await ensureAdmin(req, client);
  if (!auth.ok) {
    return NextResponse.json(
      { message: auth.reason === "unauthorized" ? "未登录" : "无权限" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }
  const { data, error } = await client
    .from("user_profiles")
    .select("wallet_address,username,email,is_admin,is_reviewer,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ message: "查询失败", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ users: data || [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const client = getClient() as DbClient | null;
  if (!client) {
    return NextResponse.json({ message: "Supabase not configured" }, { status: 500 });
  }
  const auth = await ensureAdmin(req, client);
  if (!auth.ok) {
    return NextResponse.json(
      { message: auth.reason === "unauthorized" ? "未登录" : "无权限" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }
  const rawBody = await req.json().catch(() => null);
  const body =
    rawBody && typeof rawBody === "object"
      ? (rawBody as { walletAddress?: unknown; isReviewer?: unknown })
      : {};
  const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
  const isReviewer = body.isReviewer === true;
  if (!walletAddress) {
    return NextResponse.json({ message: "walletAddress 必填" }, { status: 400 });
  }
  const { error } = await client
    .from("user_profiles")
    .update({ is_reviewer: isReviewer } as never)
    .eq("wallet_address", walletAddress);
  if (error) {
    return NextResponse.json({ message: "更新失败", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ message: "ok" }, { status: 200 });
}
