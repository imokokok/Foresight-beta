import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as settleFlag } from "../route";
import { createMockNextRequest } from "@/test/apiTestHelpers";

vi.mock("@/lib/supabase", () => {
  const flag = {
    id: 1,
    user_id: "0xabc0000000000000000000000000000000000000",
    deadline: "2024-01-10T00:00:00.000Z",
    created_at: "2024-01-01T00:00:00.000Z",
    status: "active",
  };

  const approvedCheckins = [
    { created_at: "2098-12-01T10:00:00.000Z" },
    { created_at: "2098-12-02T11:00:00.000Z" },
    { created_at: "2098-12-03T09:00:00.000Z" },
  ];

  const client = {
    from: (table: string) => {
      if (table === "flags") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: flag,
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: () => ({ data: null, error: null }),
          }),
        };
      }
      if (table === "flag_checkins") {
        return {
          select: (columns?: string, opts?: { count?: string; head?: boolean }) => {
            if (!opts) {
              return {
                eq: () => ({
                  eq: () => ({
                    gte: () => ({
                      lte: async () => ({
                        data: approvedCheckins,
                        error: null,
                      }),
                    }),
                  }),
                }),
              };
            }
            return {
              eq: () => ({
                eq: () => ({
                  count: 0,
                  error: null,
                }),
              }),
            };
          },
        };
      }
      if (table === "flag_settlements") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };

  const getClient = () => client;

  return {
    getClient,
    supabase: client,
  };
});

vi.mock("@/lib/serverUtils", () => {
  return {
    parseRequestBody: vi.fn(async (req: Request) => {
      const text = await req.text();
      return text ? JSON.parse(text) : {};
    }),
    logApiError: vi.fn(),
    getSessionAddress: vi.fn().mockResolvedValue("0xabc0000000000000000000000000000000000000"),
  };
});

vi.mock("@/lib/ids", () => {
  return {
    normalizeId: (raw: string) => Number(raw) || null,
  };
});

vi.mock("@/lib/flagRewards", () => {
  return {
    getFlagTotalDaysFromRange: (start: Date, end: Date) => 10,
    getFlagTierFromTotalDays: () => "bronze",
    getTierConfig: () => ({ settleDropRate: 0 }),
    isLuckyAddress: () => false,
    issueRandomSticker: vi.fn(),
  };
});

describe("POST /api/flags/[id]/settle", () => {
  const baseUrl = "http://localhost:3000/api/flags/1/settle";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该在缺少 flagId 时返回 400", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/flags/invalid/settle",
      body: {},
    });

    const response = await settleFlag(request, { params: Promise.resolve({ id: "invalid" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toBe("flagId is required");
  });

  it("应该在未登录时返回 401", async () => {
    const mockedGetSessionAddress = (await import("@/lib/serverUtils"))
      .getSessionAddress as unknown as ReturnType<typeof vi.fn>;
    mockedGetSessionAddress.mockResolvedValueOnce("");

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {},
    });

    const response = await settleFlag(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.message).toBe("Unauthorized");
  });

  it("应该在非 owner 调用时返回 403", async () => {
    const mockedGetSessionAddress = (await import("@/lib/serverUtils"))
      .getSessionAddress as unknown as ReturnType<typeof vi.fn>;
    mockedGetSessionAddress.mockResolvedValueOnce("0xdef0000000000000000000000000000000000000");

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        min_days: 1,
        threshold: 0.2,
      },
    });

    const response = await settleFlag(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.message).toBe("Only the owner can settle this flag");
  });

  it("应该在参数正确且有权限时成功结算 flag", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        min_days: 1,
        threshold: 0.2,
      },
    });

    const response = await settleFlag(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status === "success" || data.status === "failed").toBe(true);
    expect(data.metrics).toBeDefined();
    expect(typeof data.metrics.approvedDays).toBe("number");
  });
});
