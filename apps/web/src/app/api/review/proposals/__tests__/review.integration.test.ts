import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as reviewProposal } from "../[id]/route";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { ApiErrorCode } from "@/types/api";
import { getReviewerSession } from "@/lib/reviewAuth";

vi.mock("../../../predictions/_lib/createPrediction", () => {
  return {
    createPrediction: vi.fn().mockResolvedValue({ newPrediction: { id: 123 } }),
  };
});

let existingThread = {
  id: 1,
  review_status: "pending_review",
  review_reason: null,
  reviewed_by: null,
  reviewed_at: null,
};

vi.mock("@/lib/supabase.server", () => {
  const makeSelectQuery = () => ({
    eq: () => ({
      maybeSingle: async () => ({ data: existingThread, error: null }),
    }),
  });

  const makeUpdateQuery = (payload: any) => {
    Object.assign(existingThread, payload);
    const chain = () => ({
      eq: () => chain(),
      is: () => chain(),
      select: () => ({
        maybeSingle: async () => ({ data: { ...existingThread, ...payload }, error: null }),
      }),
    });
    return chain();
  };

  const client = {
    from: () => ({
      select: () => makeSelectQuery(),
      update: (payload: any) => makeUpdateQuery(payload),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  };

  return {
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
    getSessionAddress: vi.fn(),
    normalizeAddress: (addr: string) => addr.toLowerCase(),
    logApiError: vi.fn(),
    logApiEvent: vi.fn(),
  };
});

describe("POST /api/review/proposals/[id] - 审核员操作", () => {
  const baseUrl = "http://localhost:3000/api/review/proposals/1";
  const mockedGetReviewerSession = getReviewerSession as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    existingThread = {
      id: 1,
      review_status: "pending_review",
      review_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    };
  });

  it("应该拒绝缺少 action 的请求", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {},
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.INVALID_PARAMETERS);
    expect(data.error.message).toBe("action_required");
  });

  it("应该拒绝无效的 action", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "unknown_action",
      },
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.INVALID_PARAMETERS);
    expect(data.error.message).toBe("invalid_action");
  });

  it("应该拒绝缺少 reason 的 reject 操作", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "reject",
        reason: "",
      },
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.INVALID_PARAMETERS);
    expect(data.error.message).toBe("reason_required");
  });

  it("应该在未登录时拒绝审核请求", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: false,
      reason: "unauthorized",
      userId: null,
    });

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "approve",
      },
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
  });

  it("应该在没有权限时拒绝审核请求", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: false,
      reason: "forbidden",
      userId: null,
    });

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "approve",
      },
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.FORBIDDEN);
  });

  it("应该允许审核员 approve 提案", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: true,
      reason: "ok",
      userId: "reviewer-1",
    });

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "approve",
        reason: "looks good",
      },
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item).toBeDefined();
    expect(data.item.review_status).toBe("approved");
    expect(data.item.reviewed_by).toBe("reviewer-1");
    expect(data.item.review_reason).toBe("looks good");
  });

  it("应该允许审核员 reject 提案", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: true,
      reason: "ok",
      userId: "reviewer-2",
    });

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "reject",
        reason: "not acceptable",
      },
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item).toBeDefined();
    expect(data.item.review_status).toBe("rejected");
    expect(data.item.reviewed_by).toBe("reviewer-2");
    expect(data.item.review_reason).toBe("not acceptable");
  });

  it("应该允许审核员标记提案为需要修改", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: true,
      reason: "ok",
      userId: "reviewer-3",
    });

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "needs_changes",
        reason: "please update details",
      },
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item).toBeDefined();
    expect(data.item.review_status).toBe("needs_changes");
    expect(data.item.reviewed_by).toBe("reviewer-3");
    expect(data.item.review_reason).toBe("please update details");
  });

  it("应该拒绝无效的 id", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/review/proposals/not-a-number",
      body: {
        action: "approve",
        reason: "ok",
      },
    });

    const response = await reviewProposal(request, {
      params: Promise.resolve({ id: "not-a-number" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.INVALID_PARAMETERS);
    expect(data.error.message).toBe("invalid_id");
  });

  it("应该允许编辑元数据而不改变审核状态", async () => {
    (mockedGetReviewerSession as any).mockResolvedValue({
      ok: true,
      reason: "ok",
      userId: "reviewer-4",
    });

    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        action: "edit_metadata",
        patch: {
          title_preview: "new title",
          criteria_preview: "new criteria",
        },
      },
    });

    const response = await reviewProposal(request, { params: Promise.resolve({ id: "1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item).toBeDefined();
    expect(data.item.review_status).toBe("pending_review");
    expect(data.item.title_preview).toBe("new title");
    expect(data.item.criteria_preview).toBe("new criteria");
  });
});
