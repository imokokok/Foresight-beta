// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { webcrypto } from "crypto";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { createToken } from "@/lib/jwt";

const ADDRESS = "0x1234567890123456789012345678901234567890";
const OTHER_ADDRESS = "0xabc0000000000000000000000000000000000000";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

describe("POST /api/email-otp/request", () => {
  type OtpRow = {
    wallet_address: string;
    email: string;
    code_hash: string;
    expires_at: string;
    last_sent_at: string;
    sent_window_start_at: string;
    sent_in_window: number;
    fail_count: number;
    lock_until: string | null;
    created_ip: string | null;
  };

  const otpStore = new Map<string, OtpRow>();

  const makeKey = (address: string, email: string) => `${address}:${email}`;

  const makeSupabaseMock = () => {
    const fromMock = vi.fn((table: string) => {
      if (table !== "email_otps") {
        return {};
      }
      const ctx: { wallet_address?: string; email?: string } = {};
      const select = (cols: string) => {
        const columns = cols.split(",").map((c) => c.trim());
        const builder: any = {
          eq: (col: string, val: string) => {
            (ctx as any)[col] = val;
            return builder;
          },
          then: (resolve: any) => {
            const rows: any[] = [];
            if (ctx.wallet_address) {
              for (const value of otpStore.values()) {
                if (value.wallet_address === ctx.wallet_address) {
                  const row: any = {};
                  for (const c of columns) {
                    if (c in value) {
                      (row as any)[c] = (value as any)[c];
                    }
                  }
                  rows.push(row);
                }
              }
            }
            resolve({ data: rows, error: null });
          },
          maybeSingle: async () => {
            let found: any = null;
            for (const value of otpStore.values()) {
              if (
                (!ctx.wallet_address || value.wallet_address === ctx.wallet_address) &&
                (!ctx.email || value.email === ctx.email)
              ) {
                const row: any = {};
                for (const c of columns) {
                  if (c in value) {
                    (row as any)[c] = (value as any)[c];
                  }
                }
                found = row;
                break;
              }
            }
            return { data: found, error: null };
          },
        };
        return builder;
      };
      const upsert = (row: OtpRow) => {
        const builder: any = {
          then: (resolve: any) => {
            const key = makeKey(row.wallet_address, row.email);
            otpStore.set(key, row);
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
            const address = String(ctx.wallet_address || "");
            const email = String(ctx.email || "");
            if (address && email) {
              otpStore.delete(makeKey(address, email));
            }
            resolve({ data: null, error: null });
          },
        };
        return builder;
      };
      return {
        select,
        upsert,
        delete: del,
      };
    });
    return { fromMock };
  };

  beforeEach(() => {
    otpStore.clear();
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("JWT_SECRET", "test-secret");
  });

  it("returns 401 when session address mismatch", async () => {
    vi.doMock("@/lib/supabase", () => ({
      supabaseAdmin: {},
    }));
    const { POST } = await import("../route");

    const sessionToken = await createToken(ADDRESS);
    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/email-otp/request",
      body: {
        walletAddress: OTHER_ADDRESS,
        email: "test@example.com",
      },
      cookies: {
        fs_session: sessionToken,
      },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("returns codePreview and keeps otp row in development when SMTP fails", async () => {
    const { fromMock } = makeSupabaseMock();
    vi.doMock("@/lib/supabase", () => ({
      supabaseAdmin: {
        from: fromMock,
      },
    }));
    const sendMailMock = vi.fn(async () => {
      throw new Error("SMTP failure");
    });
    vi.doMock("@/lib/emailService", () => ({
      sendMailSMTP: sendMailMock,
    }));
    vi.stubEnv("NODE_ENV", "development");

    const { POST } = await import("../route");

    const email = "test@example.com";
    const sessionToken = await createToken(ADDRESS);
    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/email-otp/request",
      body: {
        walletAddress: ADDRESS,
        email,
      },
      cookies: {
        fs_session: sessionToken,
      },
      headers: {
        "x-real-ip": "127.0.0.1",
      },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(typeof json.data.codePreview).toBe("string");
    const key = makeKey(ADDRESS.toLowerCase(), email.toLowerCase());
    expect(otpStore.has(key)).toBe(true);
  });

  it("deletes otp row and returns error in production when SMTP fails", async () => {
    const { fromMock } = makeSupabaseMock();
    vi.doMock("@/lib/supabase", () => ({
      supabaseAdmin: {
        from: fromMock,
      },
    }));
    const sendMailMock = vi.fn(async () => {
      throw new Error("SMTP failure");
    });
    vi.doMock("@/lib/emailService", () => ({
      sendMailSMTP: sendMailMock,
    }));
    vi.stubEnv("NODE_ENV", "production");

    const { POST } = await import("../route");

    const email = "test@example.com";
    const sessionToken = await createToken(ADDRESS);
    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/email-otp/request",
      body: {
        walletAddress: ADDRESS,
        email,
      },
      cookies: {
        fs_session: sessionToken,
      },
      headers: {
        "x-real-ip": "127.0.0.1",
      },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    const key = makeKey(ADDRESS.toLowerCase(), email.toLowerCase());
    expect(otpStore.has(key)).toBe(false);
  });
});
