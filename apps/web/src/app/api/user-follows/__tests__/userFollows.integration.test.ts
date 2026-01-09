import { describe, it, expect, vi } from "vitest";
import { ApiErrorCode } from "@/types/api";

describe("user-follows API", () => {
  describe("GET /api/user-follows", () => {
    it("returns empty follows when client is not configured", async () => {
      vi.resetModules();
      vi.doMock("@/lib/supabase", () => ({
        supabaseAdmin: null,
        getClient: () => null,
      }));

      const { GET } = await import("../route");

      const req = new Request(
        "http://localhost:3000/api/user-follows?address=0xabc0000000000000000000000000000000000000"
      );
      const res = await GET(req as any);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error?.code).toBe(ApiErrorCode.INTERNAL_ERROR);

      vi.resetModules();
    });
  });

  describe("GET /api/user-follows/counts", () => {
    it("returns INTERNAL_ERROR when supabase is not configured", async () => {
      vi.resetModules();
      vi.doMock("@/lib/supabase", () => ({
        supabaseAdmin: null,
        getClient: () => null,
      }));

      const { GET } = await import("../counts/route");

      const req = new Request(
        "http://localhost:3000/api/user-follows/counts?address=0xabc0000000000000000000000000000000000000"
      );
      const res = await GET(req as any);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error?.code).toBe(ApiErrorCode.INTERNAL_ERROR);

      vi.resetModules();
    });

    it("returns 400 when address is invalid", async () => {
      vi.resetModules();
      vi.doMock("@/lib/supabase", () => ({
        supabaseAdmin: {},
        getClient: () => null,
      }));

      const { GET } = await import("../counts/route");

      const req = new Request("http://localhost:3000/api/user-follows/counts?address=abc");
      const res = await GET(req as any);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error?.code).toBe(ApiErrorCode.VALIDATION_ERROR);

      vi.resetModules();
    });
  });

  describe("GET /api/user-follows/followers-users", () => {
    it("returns empty users list when there are no followers", async () => {
      vi.resetModules();
      vi.doMock("@/lib/supabase", () => ({
        supabaseAdmin: {
          from: (table: string) => {
            if (table === "user_follows") {
              return {
                select: () => ({
                  eq: () => ({
                    range: async () => ({ data: [], error: null, count: 0 }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          },
        },
        getClient: () => null,
      }));

      const { GET } = await import("../followers-users/route");

      const req = new Request(
        "http://localhost:3000/api/user-follows/followers-users?address=0xabc0000000000000000000000000000000000000"
      );
      const res = await GET(req as any);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data?.users)).toBe(true);
      expect(json.data.users.length).toBe(0);

      vi.resetModules();
    });
  });

  describe("GET /api/user-follows/user", () => {
    it("returns followed=false when there is no follow row", async () => {
      vi.resetModules();
      vi.doMock("@/lib/supabase", () => ({
        supabaseAdmin: {
          from: (table: string) => {
            if (table === "user_follows") {
              return {
                select: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          },
        },
        getClient: () => null,
      }));

      const { GET } = await import("../user/route");

      const req = new Request(
        "http://localhost:3000/api/user-follows/user?targetAddress=0xabc0000000000000000000000000000000000000&followerAddress=0xdef0000000000000000000000000000000000000"
      );
      const res = await GET(req as any);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data?.followed).toBe(false);

      vi.resetModules();
    });
  });
});
