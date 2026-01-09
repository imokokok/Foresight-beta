import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress, normalizeAddress, isAdminAddress } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

export async function requireAdmin(args: { request: NextRequest; client: any }) {
  const { request, client } = args;
  const sessAddr = await getSessionAddress(request);
  const addr = normalizeAddress(String(sessAddr || ""));
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return {
      ok: false as const,
      response: ApiResponses.unauthorized("Unauthorized or invalid wallet address"),
    };
  }
  const { data: prof } = await (client as any)
    .from("user_profiles")
    .select("is_admin")
    .eq("wallet_address", addr)
    .maybeSingle();
  const isAdmin = !!prof?.is_admin || isAdminAddress(addr);
  if (!isAdmin) {
    return {
      ok: false as const,
      response: ApiResponses.forbidden("Admin permission is required"),
    };
  }
  return { ok: true as const, addr };
}
