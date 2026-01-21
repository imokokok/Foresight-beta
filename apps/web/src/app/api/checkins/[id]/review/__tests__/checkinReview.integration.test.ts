import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as reviewCheckin } from "../route";
import { createMockNextRequest } from "@/test/apiTestHelpers";

vi.mock("@/lib/supabase.server", () => {
  const checkin = {
    id: 1,
    flag_id: 10,
    review_status: "pending",
  };

  const flag = {
    id: 10,
    user_id: "0xabc0000000000000000000000000000000000000",
    witness_id: "0xabc0000000000000000000000000000000000000",
    verification_type: "witness",
    status: "pending_review",
  };

  const client = {
    from: (table: string) => {
      if (table === "flag_checkins") {
        return {
          select: (columns?: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head && opts.count === "exact") {
              return {
                eq: () => ({
                  eq: () => ({
                    // count pending = 0
                    count: 0,
                    error: null,
                  }),
                }),
              };
            }
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: checkin,
                  error: null,
                }),
              }),
            };
          },
          update: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  select: () => ({
                    maybeSingle: async () => ({
                      data: { ...checkin, review_status: "approved" },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
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
      if (table === "notifications") {
        return {
          insert: async () => ({ error: null }),
        };
      }
      if (table === "discussions") {
        return {
          insert: async () => ({ error: null }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };
    },
  };

  return {
    supabaseAdmin: client,
  };
});

vi.mock("@/lib/serverUtils", () => {
  return {
    parseRequestBody: vi.fn(async (req: Request) => {
      const text = await req.text();
      return text ? JSON.parse(text) : {};
    }),
    logApiError: vi.fn(),
    logApiEvent: vi.fn(),
    getSessionAddress: vi.fn().mockResolvedValue("0xabc0000000000000000000000000000000000000"),
    normalizeAddress: (addr: string) => addr.toLowerCase(),
  };
});

vi.mock("@/lib/ids", () => {
  return {
    normalizeId: (raw: string) => Number(raw) || null,
  };
});

describe("POST /api/checkins/[id]/review", () => {
  const baseUrl = "http://localhost:3000/api/checkins/1/review";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该在缺少 action 时返回 400", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {},
    });

    const response = await reviewCheckin(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("action");
  });

  it("应该在未登录时返回 401", async () => {
    const mockedGetSessionAddress = (await import("@/lib/serverUtils"))
      .getSessionAddress as unknown as ReturnType<typeof vi.fn>;
    mockedGetSessionAddress.mockResolvedValueOnce("");

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "approve",
      },
    });

    const response = await reviewCheckin(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Unauthorized");
  });

  it("应该在参数正确且有权限时成功审核 checkin", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "approve",
        reason: "looks good",
      },
    });

    const response = await reviewCheckin(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("ok");
    expect(data.data).toBeDefined();
    expect(data.data.review_status).toBe("approved");
  });
});
