import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as deleteAccount } from "../route";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { ApiErrorCode } from "@/types/api";

let sessionAddressValue = "0x1234567890abcdef1234567890abcdef12345678";
let isAdminValue = false;
const calls: Array<{ table: string; action: string }> = [];

vi.mock("@/lib/serverUtils", () => {
  return {
    getSessionAddress: vi.fn(async () => sessionAddressValue),
    normalizeAddress: (addr: string) => String(addr || "").toLowerCase(),
    parseRequestBody: async (req: Request) => {
      const text = await req.text();
      try {
        return JSON.parse(text || "{}");
      } catch {
        return {};
      }
    },
    isAdminAddress: vi.fn(() => isAdminValue),
  };
});

vi.mock("@/lib/supabase.server", () => {
  const makeResult = (error: any = null, data: any = null) => ({ error, data });

  const client = {
    from: (table: string) => {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              calls.push({ table, action: "select" });
              if (table === "user_profiles") return makeResult(null, { email: "test@example.com" });
              return makeResult(null, null);
            },
          }),
        }),
        update: (_payload: any) => ({
          eq: () => {
            calls.push({ table, action: "update" });
            const base = makeResult(null, null);
            return {
              is: async () => {
                calls.push({ table, action: "update_is" });
                return makeResult(null, null);
              },
              then: (onFulfilled: any, onRejected: any) =>
                Promise.resolve(base).then(onFulfilled, onRejected),
            };
          },
        }),
        delete: () => ({
          eq: async () => {
            calls.push({ table, action: "delete" });
            return makeResult(null, null);
          },
          or: async () => {
            calls.push({ table, action: "delete_or" });
            return makeResult(null, null);
          },
        }),
      };
    },
  };

  return { supabaseAdmin: client };
});

describe("POST /api/auth/delete-account", () => {
  const url = "http://localhost:3000/api/auth/delete-account";

  beforeEach(() => {
    vi.clearAllMocks();
    sessionAddressValue = "0x1234567890abcdef1234567890abcdef12345678";
    isAdminValue = false;
    calls.length = 0;
  });

  it("应该拒绝缺少同源 Origin 的请求", async () => {
    const req = createMockNextRequest({
      method: "POST",
      url,
      headers: { "content-type": "application/json" },
      body: { confirm: "DELETE" },
    });
    const res = await deleteAccount(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json?.error?.code).toBe(ApiErrorCode.FORBIDDEN);
  });

  it("应该拒绝未登录的请求", async () => {
    sessionAddressValue = "";
    const req = createMockNextRequest({
      method: "POST",
      url,
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: { confirm: "DELETE" },
    });
    const res = await deleteAccount(req);
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json?.error?.code).toBe(ApiErrorCode.UNAUTHORIZED);
  });

  it("应该要求输入 DELETE 作为确认", async () => {
    const req = createMockNextRequest({
      method: "POST",
      url,
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: { confirm: "nope" },
    });
    const res = await deleteAccount(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json?.error?.code).toBe(ApiErrorCode.VALIDATION_ERROR);
  });

  it("应该执行删除流程并清理 Cookie", async () => {
    const req = createMockNextRequest({
      method: "POST",
      url,
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: { confirm: "DELETE" },
    });
    const res = await deleteAccount(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json?.success).toBe(true);
    expect(json?.data?.ok).toBe(true);
    expect(Array.isArray(json?.data?.operations)).toBe(true);

    expect(res.cookies.get("fs_session")?.value).toBe("");
    expect(res.cookies.get("fs_refresh")?.value).toBe("");
    expect(res.cookies.get("fs_stepup")?.value).toBe("");
    expect(res.cookies.get("siwe_nonce")?.value).toBe("");

    const tablesTouched = new Set(calls.map((c) => c.table));
    expect(tablesTouched.has("user_profiles")).toBe(true);
    expect(tablesTouched.has("user_sessions")).toBe(true);
  });
});
