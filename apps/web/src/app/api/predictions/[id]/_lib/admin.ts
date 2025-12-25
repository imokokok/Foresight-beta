import { NextResponse, type NextRequest } from "next/server";
import { getSessionAddress, normalizeAddress, isAdminAddress } from "@/lib/serverUtils";

export async function requireAdmin(args: {
  request: NextRequest;
  client: any;
  allowWalletFromBody?: string;
}) {
  const { request, client, allowWalletFromBody } = args;
  const sessAddr = await getSessionAddress(request);
  const addr = normalizeAddress(String(sessAddr || allowWalletFromBody || ""));
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Unauthorized or invalid wallet address" },
        { status: 401 }
      ),
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
      response: NextResponse.json(
        { success: false, message: "Admin permission is required" },
        { status: 403 }
      ),
    };
  }
  return { ok: true as const, addr };
}
