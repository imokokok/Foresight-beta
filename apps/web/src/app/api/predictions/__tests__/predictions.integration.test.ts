import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as createPrediction } from "../route";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { ApiErrorCode } from "@/types/api";

vi.mock("@/lib/supabase", () => {
  const client = {
    from: (table: string) => {
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { is_admin: true },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "predictions") {
        return {
          select: () => ({
            eq: () => ({
              data: [],
              error: null,
            }),
            order: () => ({
              limit: () => ({
                data: [],
                error: null,
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: 1,
                  title: "Test prediction",
                  description: "desc",
                  category: "general",
                  deadline: "2099-01-01T00:00:00.000Z",
                  min_stake: 1,
                  criteria: "criteria",
                  reference_url: "",
                  image_url: "https://example.com/image.png",
                  status: "active",
                  type: "binary",
                  outcome_count: 2,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "prediction_outcomes") {
        return {
          insert: async () => ({ error: null }),
        };
      }
      return {
        select: () => ({ data: [], error: null }),
      };
    },
  };

  const getClient = () => client;
  const supabase = client;
  return {
    getClient,
    supabase,
  };
});

vi.mock("@/lib/serverUtils", () => {
  return {
    getSessionAddress: vi.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
    normalizeAddress: (addr: string) => addr.toLowerCase(),
    logApiError: vi.fn(),
  };
});

vi.mock("./_lib/getPredictionsList", () => {
  return {
    getPredictionsList: vi.fn(),
  };
});

describe("POST /api/predictions", () => {
  const baseUrl = "http://localhost:3000/api/predictions";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该在缺少必填字段时返回 400", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        title: "",
        description: "desc",
        category: "general",
        deadline: "2099-01-01T00:00:00.000Z",
        minStake: 1,
        criteria: "criteria",
      },
    });

    const response = await createPrediction(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.INVALID_PARAMETERS);
  });

  it("应该在 minStake 非正数时返回 400", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        title: "t",
        description: "desc",
        category: "general",
        deadline: "2099-01-01T00:00:00.000Z",
        minStake: 0,
        criteria: "criteria",
      },
    });

    const response = await createPrediction(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.INVALID_PARAMETERS);
  });

  it("应该在多选 outcome 不合法时返回 400", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        title: "t",
        description: "desc",
        category: "general",
        deadline: "2099-01-01T00:00:00.000Z",
        minStake: 1,
        criteria: "criteria",
        type: "multi",
        outcomes: [{ label: "A" }, { label: "B" }],
      },
    });

    const response = await createPrediction(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.INVALID_PARAMETERS);
  });

  it("应该在参数正确且有管理员权限时成功创建预测", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        title: "Test prediction",
        description: "desc",
        category: "general",
        deadline: "2099-01-01T00:00:00.000Z",
        minStake: 1,
        criteria: "criteria",
      },
    });

    const response = await createPrediction(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.title).toBe("Test prediction");
  });
});
