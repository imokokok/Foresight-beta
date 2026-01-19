// @vitest-environment node
import { describe, it, expect } from "vitest";
import { webcrypto } from "crypto";
import { NextResponse } from "next/server";
import { createToken, verifyToken, createRefreshToken, decodeToken } from "../jwt";
import { clearSession, createSession, getSession, setStepUpCookie } from "../session";
import { getSessionAddress } from "../serverUtils";
import { createMockNextRequest } from "../../test/apiTestHelpers";

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

  describe("Session helpers", () => {
    it("getSession should read payload from fs_session", async () => {
      const token = await createToken(testAddress, testChainId);
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/me",
        cookies: { fs_session: token },
      });

      const payload = await getSession(req);
      expect(payload?.address).toBe(testAddress.toLowerCase());
      expect(payload?.chainId).toBe(testChainId);
    });

    it("getSession should fall back to fs_refresh when fs_session missing", async () => {
      const refreshToken = await createRefreshToken(testAddress, testChainId);
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/auth/me",
        cookies: { fs_refresh: refreshToken },
      });

      const payload = await getSession(req);
      expect(payload?.address).toBe(testAddress.toLowerCase());
      expect(payload?.chainId).toBe(testChainId);
    });

    it("getSessionAddress should fall back to fs_refresh when fs_session missing", async () => {
      const refreshToken = await createRefreshToken(testAddress, testChainId);
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/forum/vote",
        cookies: { fs_refresh: refreshToken },
      });

      const addr = await getSessionAddress(req);
      expect(addr).toBe(testAddress.toLowerCase());
    });

    it("getSessionAddress should prefer fs_session over fs_refresh", async () => {
      const sessionAddr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const refreshAddr = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      const sessionToken = await createToken(sessionAddr, testChainId);
      const refreshToken = await createRefreshToken(refreshAddr, testChainId);
      const req = createMockNextRequest({
        url: "http://localhost:3000/api/forum/vote",
        cookies: { fs_session: sessionToken, fs_refresh: refreshToken },
      });

      const addr = await getSessionAddress(req);
      expect(addr).toBe(sessionAddr);
    });
  });

  describe("Cookie domain resolution", () => {
    it("should set cookie domain for production subdomains", async () => {
      const prevEnv = {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      };
      (process.env as any).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_APP_URL = "https://foresight4.xyz";
      try {
        const req = createMockNextRequest({
          url: "https://app.foresight4.xyz/api/siwe/verify",
        });
        const res = NextResponse.json({ ok: true });
        await createSession(res, testAddress, testChainId, { req, authMethod: "test" });
        await setStepUpCookie(res, testAddress, testChainId, { req, purpose: "login" });

        const sessionCookie = res.cookies.get("fs_session");
        const refreshCookie = res.cookies.get("fs_refresh");
        const stepupCookie = res.cookies.get("fs_stepup");

        expect(sessionCookie?.domain).toBe(".foresight4.xyz");
        expect(refreshCookie?.domain).toBe(".foresight4.xyz");
        expect(stepupCookie?.domain).toBe(".foresight4.xyz");

        clearSession(res, req);
        const clearedSessionCookie = res.cookies.get("fs_session");
        const clearedRefreshCookie = res.cookies.get("fs_refresh");
        const clearedStepupCookie = res.cookies.get("fs_stepup");

        expect(clearedSessionCookie?.domain).toBe(".foresight4.xyz");
        expect(clearedRefreshCookie?.domain).toBe(".foresight4.xyz");
        expect(clearedStepupCookie?.domain).toBe(".foresight4.xyz");
        expect(clearedSessionCookie?.value).toBe("");
        expect(clearedRefreshCookie?.value).toBe("");
        expect(clearedStepupCookie?.value).toBe("");
      } finally {
        (process.env as any).NODE_ENV = prevEnv.NODE_ENV;
        process.env.NEXT_PUBLIC_APP_URL = prevEnv.NEXT_PUBLIC_APP_URL;
      }
    });

    it("should not set cookie domain when request host mismatches app root", async () => {
      const prevEnv = {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      };
      (process.env as any).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_APP_URL = "https://foresight4.xyz";
      try {
        const req = createMockNextRequest({
          url: "https://evil.example.com/api/siwe/verify",
        });
        const res = NextResponse.json({ ok: true });
        await createSession(res, testAddress, testChainId, { req, authMethod: "test" });

        const sessionCookie = res.cookies.get("fs_session");
        expect(sessionCookie?.domain).toBeUndefined();
      } finally {
        (process.env as any).NODE_ENV = prevEnv.NODE_ENV;
        process.env.NEXT_PUBLIC_APP_URL = prevEnv.NEXT_PUBLIC_APP_URL;
      }
    });
  });
});
