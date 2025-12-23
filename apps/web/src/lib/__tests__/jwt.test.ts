// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "crypto";
import { createToken, verifyToken, createRefreshToken, decodeToken } from "../jwt";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

describe("JWT Token Management", () => {
  const testAddress = "0x1234567890123456789012345678901234567890";
  const testChainId = 11155111;

  describe("createToken", () => {
    it("should create a valid JWT token", async () => {
      const token = await createToken(testAddress, testChainId);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT 有3个部分
    });

    it("should create token with normalized address", async () => {
      const token = await createToken(testAddress.toUpperCase(), testChainId);
      const payload = await verifyToken(token);

      expect(payload?.address).toBe(testAddress.toLowerCase());
    });

    it("should include chainId in payload", async () => {
      const token = await createToken(testAddress, testChainId);
      const payload = await verifyToken(token);

      expect(payload?.chainId).toBe(testChainId);
    });

    it("should create token with custom expiry", async () => {
      const shortExpiry = 60; // 60 seconds
      const token = await createToken(testAddress, testChainId, shortExpiry);

      expect(token).toBeDefined();

      // Token should be valid immediately
      const payload = await verifyToken(token);
      expect(payload).not.toBeNull();
    });
  });

  describe("verifyToken", () => {
    it("should verify valid token", async () => {
      const token = await createToken(testAddress, testChainId);
      const payload = await verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.address).toBe(testAddress.toLowerCase());
      expect(payload?.chainId).toBe(testChainId);
      expect(payload?.issuedAt).toBeDefined();
    });

    it("should reject invalid token", async () => {
      const invalidToken = "invalid.token.string";
      const payload = await verifyToken(invalidToken);

      expect(payload).toBeNull();
    });

    it("should reject tampered token", async () => {
      const token = await createToken(testAddress, testChainId);
      const tamperedToken = token.slice(0, -10) + "tampered12";

      const payload = await verifyToken(tamperedToken);

      expect(payload).toBeNull();
    });
  });

  describe("createRefreshToken", () => {
    it("should create refresh token with longer expiry", async () => {
      const refreshToken = await createRefreshToken(testAddress, testChainId);

      expect(refreshToken).toBeDefined();

      const payload = await verifyToken(refreshToken);
      expect(payload).not.toBeNull();
      expect(payload?.address).toBe(testAddress.toLowerCase());
    });
  });

  describe("decodeToken", () => {
    it("should decode token without verification", () => {
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHgxMjM0IiwiaXNzdWVkQXQiOjEyMzQ1Njc4OTB9.fake";
      const payload = decodeToken(token);

      expect(payload).toBeDefined();
      expect(payload?.address).toBe("0x1234");
    });

    it("should return null for invalid token format", () => {
      const invalidToken = "not.a.valid.jwt.token";
      const payload = decodeToken(invalidToken);

      expect(payload).toBeNull();
    });
  });
});
