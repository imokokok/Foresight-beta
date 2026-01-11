import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as createPrediction } from "../route";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { ApiErrorCode } from "@/types/api";

let predictionOutcomesInsertError: unknown = null;
let sessionAddressValue: string = "0x1234567890abcdef1234567890abcdef12345678";
let lastPredictionInsertPayload: any = null;

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
          insert: (payload: any) => {
            lastPredictionInsertPayload = payload;
            return {
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
            };
          },
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "prediction_outcomes") {
        return {
          insert: async () => ({ error: predictionOutcomesInsertError }),
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "markets_map") {
        return {
          upsert: async () => ({ error: null }),
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
    getSessionAddress: vi.fn().mockImplementation(async () => sessionAddressValue),
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
    predictionOutcomesInsertError = null;
    sessionAddressValue = "0x1234567890abcdef1234567890abcdef12345678";
    lastPredictionInsertPayload = null;
    process.env.MOCK_ONCHAIN_MARKET_ADDRESS = "0x1111111111111111111111111111111111111111";
    process.env.NEXT_PUBLIC_CHAIN_ID = "80002";
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

  it("应该规范化 title 与 category 并用于写入", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        title: "   Test prediction   ",
        description: "desc",
        category: "tech",
        deadline: "2099-01-01T00:00:00.000Z",
        minStake: "1",
        criteria: "criteria",
      },
    });

    const response = await createPrediction(request);
    expect(response.status).toBe(201);
    expect(lastPredictionInsertPayload).toBeTruthy();
    expect(lastPredictionInsertPayload.title).toBe("Test prediction");
    expect(lastPredictionInsertPayload.category).toBe("科技");
    expect(lastPredictionInsertPayload.min_stake).toBe(1);
  });

  it("应该在 outcomes 写入失败时返回 500", async () => {
    predictionOutcomesInsertError = new Error("insert failed");
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

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.INTERNAL_ERROR);
  });

  it("应该在缺少 session 时返回 401", async () => {
    sessionAddressValue = "";
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
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      },
    });

    const response = await createPrediction(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
  });
});
