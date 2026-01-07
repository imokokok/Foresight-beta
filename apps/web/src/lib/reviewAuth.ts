import { NextRequest } from "next/server";
import { getClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import {
  getSessionAddress,
  isAdminAddress,
  logApiError,
  normalizeAddress,
} from "@/lib/serverUtils";

type ReviewerSessionOk = { ok: true; reason: "ok"; userId: string };
type ReviewerSessionFailReason = "no_client" | "unauthorized" | "forbidden";
type ReviewerSessionFail = { ok: false; reason: ReviewerSessionFailReason; userId: null };
export type ReviewerSession = ReviewerSessionOk | ReviewerSessionFail;

export async function getReviewerSession(req: NextRequest): Promise<ReviewerSession> {
  const client = getClient();
  if (!client) {
    return { ok: false, reason: "no_client", userId: null };
  }

  try {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session && session.user) {
      const userWithMetadata = session.user as typeof session.user & {
        user_metadata?: { wallet_address?: string | null };
      };
      const email = session.user.email || "";
      const walletFromMeta = userWithMetadata.user_metadata?.wallet_address || "";

      let isAdmin = false;
      let isReviewer = false;

      if (email) {
        const { data: profileByEmail } = await client
          .from("user_profiles")
          .select("is_admin,is_reviewer")
          .eq("email", email)
          .maybeSingle<
            Pick<Database["public"]["Tables"]["user_profiles"]["Row"], "is_admin" | "is_reviewer">
          >();
        if (profileByEmail) {
          isAdmin = !!profileByEmail.is_admin;
          isReviewer = !!profileByEmail.is_reviewer;
        }
      }

      const walletAddress = normalizeAddress(String(walletFromMeta || ""));

      if (!isAdmin && !isReviewer && walletAddress) {
        const { data: profileByWallet } = await client
          .from("user_profiles")
          .select("is_admin,is_reviewer")
          .eq("wallet_address", walletAddress)
          .maybeSingle<
            Pick<Database["public"]["Tables"]["user_profiles"]["Row"], "is_admin" | "is_reviewer">
          >();
        if (profileByWallet) {
          isAdmin = !!profileByWallet.is_admin;
          isReviewer = !!profileByWallet.is_reviewer;
        }
      }

      if (!isAdmin && walletAddress && isAdminAddress(walletAddress)) {
        isAdmin = true;
      }

      if (isAdmin || isReviewer) {
        return { ok: true, reason: "ok", userId: session.user.id };
      }

      return { ok: false, reason: "forbidden", userId: null };
    }
  } catch (e) {
    logApiError("getReviewerSession supabase_path_error", e);
  }

  const address = normalizeAddress(String((await getSessionAddress(req)) || ""));
  if (!address) {
    return { ok: false, reason: "unauthorized", userId: null };
  }

  const { data: profile } = await client
    .from("user_profiles")
    .select("is_admin,is_reviewer")
    .eq("wallet_address", address)
    .maybeSingle<
      Pick<Database["public"]["Tables"]["user_profiles"]["Row"], "is_admin" | "is_reviewer">
    >();

  const isAdmin = !!profile?.is_admin || isAdminAddress(address);
  const isReviewer = !!profile?.is_reviewer;

  if (!isAdmin && !isReviewer) {
    return { ok: false, reason: "forbidden", userId: null };
  }

  return { ok: true, reason: "ok", userId: address };
}
