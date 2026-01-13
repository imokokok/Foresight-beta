// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { webcrypto } from "crypto";
import { createMockNextRequest } from "@/test/apiTestHelpers";
import { POST } from "../route";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

describe("POST /api/auth/email-session", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 400 because route is deprecated", async () => {
    const req = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/auth/email-session",
      body: {},
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });
});
