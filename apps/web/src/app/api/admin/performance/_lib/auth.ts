import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdminSession(client: SupabaseClient) {
  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session || !session.user) return { ok: false as const, reason: "unauthorized" as const };

  let isAdmin = false;

  if (session.user.email) {
    const { data: profile } = await (client as any)
      .from("user_profiles")
      .select("is_admin")
      .eq("email", session.user.email)
      .maybeSingle();
    if ((profile as any)?.is_admin) isAdmin = true;
  }

  if (!isAdmin && (session.user as any).user_metadata?.wallet_address) {
    const { data: profile } = await (client as any)
      .from("user_profiles")
      .select("is_admin")
      .eq("wallet_address", (session.user as any).user_metadata.wallet_address)
      .maybeSingle();
    if ((profile as any)?.is_admin) isAdmin = true;
  }

  if (!isAdmin) return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const, session };
}
