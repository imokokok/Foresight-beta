// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash, webcrypto } from "crypto";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { createToken } from "@/lib/jwt";

const ADDRESS = "0x1234567890123456789012345678901234567890";
const OTHER_ADDRESS = "0xabc0000000000000000000000000000000000000";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

describe("POST /api/email-otp/verify", () => {
  const otpStore = new Map<
    string,
    {
      wallet_address: string;
      email: string;
      code_hash: string;
      expires_at: string;
      fail_count: number;
      lock_until: string | null;
    }
  >();

  const makeKey = (address: string, email: string) => `${address}:${email}`;

  const makeSupabaseMock = () => {
    const upsertProfileMock = vi.fn(async () => ({ error: null }));
    const fromMock = vi.fn((table: string) => {
      if (table === "user_profiles") {
        return {
          upsert: upsertProfileMock,
        };
      }
      if (table === "email_otps") {
        const ctx: { wallet_address?: string; email?: string } = {};
        const selectBuilder: any = {
          eq: (col: string, val: string) => {
            (ctx as any)[col] = val;
            return selectBuilder;
          },
          maybeSingle: async () => {
            const key = makeKey(String(ctx.wallet_address || ""), String(ctx.email || ""));
            return { data: otpStore.get(key) || null, error: null };
          },
        };
        const update = (patch: any) => {
          const builder: any = {
            eq: (col: string, val: string) => {
              (ctx as any)[col] = val;
              return builder;
            },
            then: (resolve: any) => {
              const key = makeKey(String(ctx.wallet_address || ""), String(ctx.email || ""));
              const existing = otpStore.get(key);
              if (existing) {
                otpStore.set(key, { ...existing, ...patch });
              }
              resolve({ data: null, error: null });
            },
          };
          return builder;
        };
        const del = () => {
          const builder: any = {
            eq: (col: string, val: string) => {
              (ctx as any)[col] = val;
              return builder;
            },
            then: (resolve: any) => {
              const key = makeKey(String(ctx.wallet_address || ""), String(ctx.email || ""));
              otpStore.delete(key);
              resolve({ data: null, error: null });
            },
          };
          return builder;
        };
        return {
          select: () => selectBuilder,
          update,
          delete: del,
        };
      }
      return {};
    });
    return { fromMock, upsertProfileMock };
  };

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    otpStore.clear();
    vi.clearAllMocks();
  });

  it("returns 401 when session address mismatch", async () => {
    vi.doMock("@/lib/supabase", () => ({
      supabaseAdmin: {},
    }));
    const { POST } = await import("../route");

    const sessionToken = await createToken(ADDRESS);
    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/email-otp/verify",
      body: {
        walletAddress: OTHER_ADDRESS,
        email: "test@example.com",
        code: "123456",
      },
      cookies: {
        fs_session: sessionToken,
      },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);

    vi.resetModules();
  });

  it("locks after three wrong attempts", async () => {
    const secret = "test-secret";
    const codeHash = createHash("sha256").update(`123456:${secret}`, "utf8").digest("hex");
    otpStore.set(makeKey(ADDRESS, "test@example.com"), {
      wallet_address: ADDRESS,
      email: "test@example.com",
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      fail_count: 0,
      lock_until: null,
    });

    const { fromMock } = makeSupabaseMock();
    vi.doMock("@/lib/supabase", () => ({
      supabaseAdmin: {
        from: fromMock,
      },
    }));
    const { POST } = await import("../route");

    const email = "test@example.com";
    const sessionToken = await createToken(ADDRESS);
    const makeReq = () =>
      createMockNextRequest({
        method: "POST",
        url: "http://localhost:3000/api/email-otp/verify",
        body: {
          walletAddress: ADDRESS,
          email,
          code: "000000",
        },
        cookies: {
          fs_session: sessionToken,
        },
      });

    const r1 = await POST(makeReq());
    const r2 = await POST(makeReq());
    const r3 = await POST(makeReq());

    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r3.status).toBe(429);

    const rec = otpStore.get(makeKey(ADDRESS, email));
    expect(rec?.fail_count).toBe(3);
    expect(typeof rec?.lock_until).toBe("string");
    expect(new Date(String(rec?.lock_until || "")).getTime() > Date.now()).toBe(true);

    vi.resetModules();
  });

  it("binds email and clears otp record on success", async () => {
    const secret = "test-secret";
    const codeHash = createHash("sha256").update(`123456:${secret}`, "utf8").digest("hex");
    const email = "test@example.com";
    otpStore.set(makeKey(ADDRESS, email), {
      wallet_address: ADDRESS,
      email,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      fail_count: 0,
      lock_until: null,
    });

    const { fromMock, upsertProfileMock } = makeSupabaseMock();
    vi.doMock("@/lib/supabase", () => ({
      supabaseAdmin: {
        from: fromMock,
      },
    }));
    const { POST } = await import("../route");

    const sessionToken = await createToken(ADDRESS);
    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/email-otp/verify",
      body: {
        walletAddress: ADDRESS,
        email,
        code: "123456",
      },
      cookies: {
        fs_session: sessionToken,
      },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("user_profiles");
    expect(upsertProfileMock).toHaveBeenCalledTimes(1);
    expect(otpStore.has(makeKey(ADDRESS, email))).toBe(false);

    vi.resetModules();
  });
});
