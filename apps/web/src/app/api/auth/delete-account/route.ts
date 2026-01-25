import { NextRequest } from "next/server";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase.server";
import {
  getSessionAddress,
  isAdminAddress,
  normalizeAddress,
  parseRequestBody,
} from "@/lib/serverUtils";

function isSameOrigin(req: NextRequest) {
  try {
    const origin = req.headers.get("origin") || "";
    if (!origin) return false;
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function isMissingRelation(err: unknown) {
  const msg = String((err as any)?.message || "").toLowerCase();
  return msg.includes("relation") && msg.includes("does not exist");
}

function isMissingColumn(err: unknown) {
  const msg = String((err as any)?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

type OpResult = {
  op: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

async function safeOp(op: string, fn: () => Promise<unknown>): Promise<OpResult> {
  try {
    await fn();
    return { op, ok: true };
  } catch (e) {
    const error = e as Error;
    if (isMissingRelation(error) || isMissingColumn(error)) {
      return { op, ok: true, skipped: true };
    }
    return { op, ok: false, error: String(error?.message || error) };
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return ApiResponses.forbidden("Invalid origin");

    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Supabase not configured");

    const viewer = normalizeAddress(await getSessionAddress(req));
    if (!/^0x[a-f0-9]{40}$/.test(viewer)) return ApiResponses.unauthorized("未登录或会话失效");
    if (isAdminAddress(viewer)) return ApiResponses.forbidden("管理员账号不可自助注销");

    const body = await parseRequestBody(req);
    const confirm = String(body?.confirm || "").trim();
    if (confirm !== "DELETE") return ApiResponses.badRequest("请在确认框输入 DELETE");

    const nowIso = new Date().toISOString();
    const ops: OpResult[] = [];

    let currentEmail = "";
    try {
      const { data, error } = await client
        .from("user_profiles")
        .select("email")
        .eq("wallet_address", viewer)
        .maybeSingle();
      if (!error && data && typeof data.email === "string") {
        currentEmail = String(data.email || "")
          .trim()
          .toLowerCase();
      }
    } catch {}

    ops.push(
      await safeOp("user_profiles.anonymize", async () => {
        const { error } = await client
          .from("user_profiles")
          .update({
            username: "",
            email: "",
            is_admin: false,
            is_reviewer: false,
            proxy_wallet_address: null,
            proxy_wallet_type: null,
            embedded_wallet_provider: null,
            embedded_wallet_address: null,
          })
          .eq("wallet_address", viewer);
        if (error) throw error;
      })
    );

    ops.push(
      await safeOp("email_otps.delete", async () => {
        const { error } = await client.from("email_otps").delete().eq("wallet_address", viewer);
        if (error) throw error;
      })
    );

    if (currentEmail) {
      ops.push(
        await safeOp("email_login_tokens.delete", async () => {
          const { error } = await client
            .from("email_login_tokens")
            .delete()
            .eq("email", currentEmail);
          if (error) throw error;
        })
      );
    }

    ops.push(
      await safeOp("user_sessions.revoke_all", async () => {
        const { error } = await client
          .from("user_sessions")
          .update({ revoked_at: nowIso })
          .eq("wallet_address", viewer)
          .is("revoked_at", null);
        if (error) throw error;
      })
    );

    ops.push(
      await safeOp("user_devices.delete", async () => {
        const { error } = await client.from("user_devices").delete().eq("wallet_address", viewer);
        if (error) throw error;
      })
    );

    ops.push(
      await safeOp("login_audit_events.delete", async () => {
        const { error } = await client
          .from("login_audit_events")
          .delete()
          .eq("wallet_address", viewer);
        if (error) throw error;
      })
    );

    ops.push(
      await safeOp("notifications.delete", async () => {
        const { error } = await client.from("notifications").delete().eq("recipient_id", viewer);
        if (error) throw error;
      })
    );

    ops.push(
      await safeOp("user_follows.delete", async () => {
        const { error } = await client
          .from("user_follows")
          .delete()
          .or(`follower_address.eq.${viewer},following_address.eq.${viewer}`);
        if (error) throw error;
      })
    );

    ops.push(
      await safeOp("event_follows.delete", async () => {
        const { error } = await client.from("event_follows").delete().eq("user_id", viewer);
        if (error) throw error;
      })
    );

    ops.push(
      await safeOp("event_views.delete", async () => {
        const { error } = await client.from("event_views").delete().eq("user_id", viewer);
        if (error) throw error;
      })
    );

    ops.push(
      await safeOp("user_emojis.delete", async () => {
        const { error } = await client.from("user_emojis").delete().eq("user_id", viewer);
        if (error) throw error;
      })
    );

    const res = successResponse(
      { ok: true, address: viewer, operations: ops },
      "Account data deleted"
    );
    const { clearSession } = await import("@/lib/session");
    clearSession(res);
    res.cookies.set("siwe_nonce", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set("auth_challenge_nonce", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    res.cookies.set("fs_remember", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (e) {
    const error = e as Error;
    return ApiResponses.internalError("Failed to delete account", error.message);
  }
}
