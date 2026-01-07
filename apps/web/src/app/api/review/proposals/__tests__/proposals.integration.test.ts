import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as listProposals } from "../route";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { ApiErrorCode } from "@/types/api";
import { getReviewerSession } from "@/lib/reviewAuth";

vi.mock("@/lib/supabase", () => {
  const items = [
    { id: 1, review_status: "pending_review", event_id: 0 },
    { id: 2, review_status: "pending_review", event_id: 0 },
  ];

  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                data: items,
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  };

  const getClient = () => client;

  return {
    getClient,
    supabaseAdmin: client,
  };
});

vi.mock("@/lib/reviewAuth", () => {
  return {
    getReviewerSession: vi.fn(),
  };
});

vi.mock("@/lib/serverUtils", () => {
  return {
    logApiError: vi.fn(),
  };
});

describe("GET /api/review/proposals", () => {
  const baseUrl = "http://localhost:3000/api/review/proposals";
  const mockedGetReviewerSession = getReviewerSession as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该在未登录时返回 401", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: false,
      reason: "unauthorized",
      userId: null,
    });

    const request = createMockNextRequest({
      method: "GET",
      url: baseUrl,
    });

    const response = await listProposals(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
  });

  it("应该在没有权限时返回 403", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: false,
      reason: "forbidden",
      userId: null,
    });

    const request = createMockNextRequest({
      method: "GET",
      url: baseUrl,
    });

    const response = await listProposals(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.FORBIDDEN);
  });

  it("应该在参数正确且有权限时返回提案列表", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: true,
      reason: "ok",
      userId: "reviewer-1",
    });

    const request = createMockNextRequest({
      method: "GET",
      url: `${baseUrl}?status=pending_review&limit=10`,
    });

    const response = await listProposals(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBe(2);
  });
});
