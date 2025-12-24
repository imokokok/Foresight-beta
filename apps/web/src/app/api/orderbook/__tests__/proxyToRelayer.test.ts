import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST as postOrders } from "@/app/api/orderbook/orders/route";
import { POST as postCancelSalt } from "@/app/api/orderbook/cancel-salt/route";
import { ApiErrorCode } from "@/types/api";

function makePostRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function snapshotEnv() {
  const snap = new Map<string, string | undefined>();
  for (const key of Object.keys(process.env)) snap.set(key, process.env[key]);
  return snap;
}

function restoreEnv(snap: Map<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (!snap.has(key)) delete process.env[key];
  }
  for (const [key, val] of snap.entries()) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
}

describe("orderbook api relayer proxy", () => {
  let envSnap: Map<string, string | undefined>;
  let fetchOriginal: typeof fetch | undefined;

  beforeEach(() => {
    envSnap = snapshotEnv();
    fetchOriginal = globalThis.fetch;
  });

  afterEach(() => {
    restoreEnv(envSnap);
    vi.restoreAllMocks();
    if (fetchOriginal) globalThis.fetch = fetchOriginal;
    else delete (globalThis as any).fetch;
  });

  it("forwards POST /orderbook/orders to relayer", async () => {
    process.env.RELAYER_URL = "https://relayer.example";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ message: "ok", data: { forwarded: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const res = await postOrders(
      makePostRequest("http://localhost/api/orderbook/orders", { hello: "world" }) as any
    );
    const json = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://relayer.example/orderbook/orders");
    expect(json.message).toBe("ok");
  });

  it("forwards POST /orderbook/cancel-salt to relayer", async () => {
    process.env.RELAYER_URL = "https://relayer.example";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ message: "ok", data: { forwarded: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const res = await postCancelSalt(
      makePostRequest("http://localhost/api/orderbook/cancel-salt", { hello: "world" }) as any
    );
    const json = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://relayer.example/orderbook/cancel-salt"
    );
    expect(json.message).toBe("ok");
  });

  it("returns internal error if supabase is not configured and relayer is absent", async () => {
    delete process.env.RELAYER_URL;
    delete process.env.NEXT_PUBLIC_RELAYER_URL;

    const res = await postOrders(
      makePostRequest("http://localhost/api/orderbook/orders", {}) as any
    );
    const json = await res.json();

    expect(json.success).toBe(false);
    expect(json.error?.code).toBe(ApiErrorCode.INTERNAL_ERROR);
  });
});
