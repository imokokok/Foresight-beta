import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getSessionAddress, isAdminAddress, normalizeAddress } from "@/lib/serverUtils";

type ReviewerSessionOk = { ok: true; reason: "ok"; userId: string };
type ReviewerSessionFailReason = "no_client" | "unauthorized" | "forbidden";
type ReviewerSessionFail = { ok: false; reason: ReviewerSessionFailReason; userId: null };
export type ReviewerSession = ReviewerSessionOk | ReviewerSessionFail;

export async function getReviewerSession(req: NextRequest): Promise<ReviewerSession> {
  const client = supabaseAdmin;
  if (!client) {
    return { ok: false, reason: "no_client", userId: null };
  }

  const address = normalizeAddress(String((await getSessionAddress(req)) || ""));
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return { ok: false, reason: "unauthorized", userId: null };
  }

  const { data: profile, error } = await (client as any)
    .from("user_profiles")
    .select("is_admin,is_reviewer")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) {
    return { ok: false, reason: "no_client", userId: null };
  }

  const isAdmin = !!(profile as any)?.is_admin || isAdminAddress(address);
  const isReviewer = !!(profile as any)?.is_reviewer;

  if (!isAdmin && !isReviewer) {
    return { ok: false, reason: "forbidden", userId: null };
  }

  return { ok: true, reason: "ok", userId: address };
}
