import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as createPrediction } from "../route";
import { handleGetPredictionDetail, handlePatchPrediction } from "../[id]/_lib/handlers";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { ApiErrorCode } from "@/types/api";
import { resetRateLimitStore } from "@/lib/rateLimit";

let predictionOutcomesInsertError: unknown = null;
let sessionAddressValue: string = "0x1234567890abcdef1234567890abcdef12345678";
let lastPredictionInsertPayload: any = null;
let predictionRecord: any = null;

vi.mock("@/lib/supabase.server", () => {
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
            eq: (col: string, value: any) => ({
              data: [],
              error: null,
              single: async () => {
                if (col === "id" && predictionRecord && Number(value) === predictionRecord.id) {
                  return { data: predictionRecord, error: null };
                }
                return { data: null, error: { code: "PGRST116", message: "Not found" } };
              },
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
            const normalized = Array.isArray(payload) ? payload[0] : payload;
            const nowIso = new Date().toISOString();
            predictionRecord = {
              id: 1,
              title: normalized?.title ?? "Test prediction",
              description: normalized?.description ?? "desc",
              category: normalized?.category ?? "general",
              deadline: normalized?.deadline ?? "2099-01-01T00:00:00.000Z",
              min_stake: normalized?.min_stake ?? 1,
              criteria: normalized?.criteria ?? "criteria",
              reference_url: normalized?.reference_url ?? "",
              image_url: normalized?.image_url ?? "https://example.com/image.png",
              status: normalized?.status ?? "active",
              type: normalized?.type ?? "binary",
              outcome_count: normalized?.outcome_count ?? 2,
              created_at: predictionRecord?.created_at ?? nowIso,
              updated_at: nowIso,
            };
            return {
              select: () => ({
                single: async () => ({
                  data: predictionRecord,
                  error: null,
                }),
              }),
            };
          },
          update: (upd: any) => ({
            eq: (col: string, value: any) => ({
              select: () => ({
                maybeSingle: async () => {
                  if (col === "id" && predictionRecord && Number(value) === predictionRecord.id) {
                    predictionRecord = {
                      ...predictionRecord,
                      ...upd,
                      updated_at: new Date().toISOString(),
                    };
                    return { data: predictionRecord, error: null };
                  }
                  return { data: null, error: { code: "PGRST116", message: "Not found" } };
                },
              }),
            }),
          }),
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
      if (table === "prediction_stats") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "bets") {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
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

  return {
    supabaseAdmin: client,
    supabaseAnon: client,
  };
});

vi.mock("@/lib/serverUtils", () => {
  return {
    getSessionAddress: vi.fn().mockImplementation(async () => sessionAddressValue),
    normalizeAddress: (addr: string) => addr.toLowerCase(),
    logApiError: vi.fn(),
    isAdminAddress: () => false,
    getErrorMessage: (error: unknown) => {
      if (error && typeof error === "object" && "message" in error) {
        return String((error as { message?: unknown }).message || "");
      }
      return String(error || "");
    },
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
    resetRateLimitStore();
    predictionOutcomesInsertError = null;
    sessionAddressValue = "0x1234567890abcdef1234567890abcdef12345678";
    lastPredictionInsertPayload = null;
    predictionRecord = null;
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

describe("预测生命周期流程", () => {
  const baseUrl = "http://localhost:3000/api/predictions";

  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    predictionOutcomesInsertError = null;
    sessionAddressValue = "0x1234567890abcdef1234567890abcdef12345678";
    lastPredictionInsertPayload = null;
    predictionRecord = null;
    process.env.MOCK_ONCHAIN_MARKET_ADDRESS = "0x1111111111111111111111111111111111111111";
    process.env.NEXT_PUBLIC_CHAIN_ID = "80002";
  });

  it("应该覆盖创建到下线的完整流程", async () => {
    const createRequest = createMockNextRequest({
      method: "POST",
      url: baseUrl,
      body: {
        title: "E2E Test Prediction",
        description: "Test market lifecycle",
        category: "general",
        deadline: new Date(Date.now() + 3600000).toISOString(),
        minStake: 1,
        criteria: "Test criteria",
      },
    });

    const createResponse = await createPrediction(createRequest);
    const createData = await createResponse.json();
    expect(createResponse.status).toBe(201);
    expect(createData.success).toBe(true);
    expect(createData.data.id).toBeDefined();

    const predictionId = String(createData.data.id);

    const getRequest = createMockNextRequest({
      method: "GET",
      url: `${baseUrl}/${predictionId}`,
    });
    const getResponse = await handleGetPredictionDetail(getRequest, predictionId);
    const getDetailData = await getResponse.json();
    expect(getResponse.status).toBe(200);
    expect(getDetailData.success).toBe(true);
    expect(getDetailData.data.status).toBe("active");

    const patchRequest = createMockNextRequest({
      method: "PATCH",
      url: `${baseUrl}/${predictionId}`,
      body: {
        status: "completed",
      },
    });
    const patchResponse = await handlePatchPrediction(patchRequest, predictionId);
    const patchData = await patchResponse.json();
    expect(patchResponse.status).toBe(200);
    expect(patchData.success).toBe(true);
    expect(patchData.data.status).toBe("completed");

    const verifyResponse = await handleGetPredictionDetail(getRequest, predictionId);
    const verifyData = await verifyResponse.json();
    expect(verifyResponse.status).toBe(200);
    expect(verifyData.data.status).toBe("completed");
  });
});
