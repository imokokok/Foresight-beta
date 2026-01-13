// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { webcrypto } from "crypto";
import { createMockNextRequest } from "@/test/apiTestHelpers";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

describe("POST /api/wallets/proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_PROXY_WALLET_TYPE;
    delete process.env.PROXY_WALLET_FACTORY_ADDRESS;
    delete process.env.SAFE_FACTORY_ADDRESS;
    delete process.env.SAFE_SINGLETON_ADDRESS;
    delete process.env.SAFE_FALLBACK_HANDLER_ADDRESS;
  });

  it("returns 401 when session address is missing", async () => {
    vi.doMock("@/lib/serverUtils", async () => {
      const actual = await vi.importActual<typeof import("@/lib/serverUtils")>("@/lib/serverUtils");
      return {
        ...actual,
        getSessionAddress: vi.fn().mockResolvedValue(""),
      };
    });

    const { POST } = await import("../route");

    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/wallets/proxy",
      body: {},
    });

    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("returns 500 when proxy wallet config is invalid", async () => {
    vi.doMock("@/lib/serverUtils", async () => {
      const actual = await vi.importActual<typeof import("@/lib/serverUtils")>("@/lib/serverUtils");
      return {
        ...actual,
        getSessionAddress: vi.fn().mockResolvedValue("0xabc0000000000000000000000000000000000000"),
        getProxyWalletConfig: vi.fn(() => ({
          ok: false,
          error: "Invalid config",
        })),
      };
    });

    const { POST } = await import("../route");

    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/wallets/proxy",
      body: {},
    });

    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
  });

  it("creates proxy wallet address for new profile", async () => {
    process.env.NEXT_PUBLIC_PROXY_WALLET_TYPE = "proxy";
    process.env.PROXY_WALLET_FACTORY_ADDRESS = "0x1000000000000000000000000000000000000000";

    const fromMock = vi.fn(() => ({
      select: () => ({
        eq: () =>
          ({
            maybeSingle: async () => ({ data: null, error: null }),
          }) as any,
      }),
      insert: vi.fn(async () => ({ error: null })),
      update: vi.fn(),
    }));

    vi.doMock("@/lib/serverUtils", async () => {
      const actual = await vi.importActual<typeof import("@/lib/serverUtils")>("@/lib/serverUtils");
      return {
        ...actual,
        getSessionAddress: vi.fn().mockResolvedValue("0xabc0000000000000000000000000000000000000"),
      };
    });

    vi.doMock("@/lib/supabase", () => ({
      getClient: () =>
        ({
          from: fromMock,
        }) as any,
    }));

    const { POST } = await import("../route");

    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/wallets/proxy",
      body: {},
    });

    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(typeof json.data.address).toBe("string");
    expect(json.data.address.startsWith("0x")).toBe(true);
    expect(json.data.type).toBe("proxy");
    expect(fromMock).toHaveBeenCalledWith("user_profiles");
  });
});
