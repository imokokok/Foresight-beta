/**
 * SIWE 认证 API 集成测试
 * 测试 Sign-In with Ethereum 认证流程
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Wallet } from "ethers";
import { SiweMessage } from "siwe";
import { POST as verifySignature } from "../verify/route";
import { GET as getNonce } from "../nonce/route";
import { middleware as rateLimitMiddleware } from "@/middleware";
import { createMockNextRequest } from "@/test/apiTestHelpers";

vi.mock("@/lib/session", () => {
  return {
    createSession: vi.fn(async (response: any, address: string) => {
      response.cookies.set("fs_session", JSON.stringify({ address }), {
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }),
  };
});

const TEST_ADDRESS = "0x1234567890123456789012345678901234567890";
const TEST_DOMAIN = "localhost:3000";
const TEST_URI = "http://localhost:3000";

function buildSiweMessage(options: {
  nonce: string;
  chainId?: number;
  domain?: string;
  issuedAt?: string;
}) {
  const msg = new SiweMessage({
    domain: options.domain ?? TEST_DOMAIN,
    address: TEST_ADDRESS,
    statement: "Sign in with Ethereum to the app.",
    uri: TEST_URI,
    version: "1",
    chainId: options.chainId ?? 1,
    nonce: options.nonce,
    issuedAt: options.issuedAt ?? new Date().toISOString(),
  });
  return msg.prepareMessage();
}

describe("GET /api/siwe/nonce - 获取 Nonce", () => {
  it("应该返回新的 nonce", async () => {
    const response = await getNonce();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nonce).toBeDefined();
    expect(typeof data.nonce).toBe("string");
    expect(data.nonce.length).toBeGreaterThan(0);
  });

  it("每次请求应该返回不同的 nonce", async () => {
    const response1 = await getNonce();
    const data1 = await response1.json();

    const response2 = await getNonce();
    const data2 = await response2.json();

    expect(data1.nonce).not.toBe(data2.nonce);
  });
});

describe("POST /api/siwe/verify - 验证签名", () => {
  it("应该拒绝缺少必填字段的请求", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        // 缺少 message 和 signature
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.message).toContain("必填");
  });

  it("应该拒绝无效的签名格式", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: "Test message",
        signature: "invalid-signature", // 不是有效的十六进制签名
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.message).toContain("签名");
  });

  it("应该拒绝无效的 SIWE 消息格式", async () => {
    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: "Invalid SIWE message format",
        signature: "0x" + "1".repeat(130),
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("应该验证 SIWE 消息的必填字段", async () => {
    // SIWE 消息应该包含：domain, address, statement, uri, version, chainId, nonce
    const incompleteSiweMessage = `localhost:3000 wants you to sign in with your Ethereum account:
0x1234567890123456789012345678901234567890

Sign in with Ethereum`;
    // 缺少 URI, version, chainId, nonce 等字段

    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: incompleteSiweMessage,
        signature: "0x" + "1".repeat(130),
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("应该拒绝过期的 nonce", async () => {
    const expiredNonce = "expired12345";
    const siweMessage = buildSiweMessage({
      nonce: expiredNonce,
      issuedAt: new Date(Date.now() - 3600000).toISOString(),
    });

    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: siweMessage,
        signature: "0x" + "1".repeat(130),
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    // 应该拒绝过期或无效的 nonce
    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("应该拒绝不匹配的签名和地址", async () => {
    const nonce = "testnonce12345";
    const siweMessage = buildSiweMessage({
      nonce,
    });

    const invalidSignature = "0x" + "2".repeat(130);

    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: siweMessage,
        signature: invalidSignature,
      },
      cookies: {
        siwe_nonce: nonce,
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("INVALID_SIGNATURE");
  });

  it("应该拒绝不支持的 chain ID", async () => {
    const siweMessage = buildSiweMessage({
      nonce: "testnonce12345",
      chainId: 99999,
    });

    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: siweMessage,
        signature: "0x" + "1".repeat(130),
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.message).toContain("chain");
  });

  it("应该允许受支持的多链 chain ID", async () => {
    const nonceResponse = await getNonce();
    const nonceData = await nonceResponse.json();
    const nonce = nonceData.nonce;

    const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

    const supportedChainIds = [1, 11155111, 137, 80002, 56, 8217, 1001];

    for (const chainId of supportedChainIds) {
      const siwe = new SiweMessage({
        domain: TEST_DOMAIN,
        address: wallet.address,
        statement: "Sign in with Ethereum to the app.",
        uri: TEST_URI,
        version: "1",
        chainId,
        nonce,
        issuedAt: new Date().toISOString(),
      });

      const messageToSign = siwe.prepareMessage();
      const signature = await wallet.signMessage(messageToSign);

      const request = createMockNextRequest({
        method: "POST",
        url: "http://localhost:3000/api/siwe/verify",
        body: {
          message: messageToSign,
          signature,
        },
        cookies: {
          siwe_nonce: nonce,
        },
      });

      const response = await verifySignature(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.address.toLowerCase()).toBe(wallet.address.toLowerCase());
    }
  });

  it("成功验证后应该设置 session cookie", async () => {
    const nonceResponse = await getNonce();
    const nonceData = await nonceResponse.json();
    const nonce = nonceData.nonce;

    const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const siwe = new SiweMessage({
      domain: TEST_DOMAIN,
      address: wallet.address,
      statement: "Sign in with Ethereum to the app.",
      uri: TEST_URI,
      version: "1",
      chainId: 1,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const messageToSign = siwe.prepareMessage();
    const signature = await wallet.signMessage(messageToSign);

    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: messageToSign,
        signature,
      },
      cookies: {
        siwe_nonce: nonce,
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.address.toLowerCase()).toBe(wallet.address.toLowerCase());

    const sessionCookie = response.cookies.get("fs_session");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeDefined();
  });

  it("应该限制登录尝试次数（Rate Limiting）", async () => {
    const requests: Promise<Response | undefined>[] = [];

    for (let i = 0; i < 10; i++) {
      const request = createMockNextRequest({
        method: "POST",
        url: "http://localhost:3000/api/siwe/verify",
        headers: {
          "X-Forwarded-For": "1.2.3.4",
        },
        body: {
          message: "test",
          signature: "0x123",
        },
      });

      requests.push(rateLimitMiddleware(request as any) as any);
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.some((r) => r && r.status === 429);
    expect(rateLimited).toBe(true);
  });
});

describe("SIWE 安全性测试", () => {
  it("应该拒绝重放攻击（相同的 nonce）", async () => {
    const nonce = String(Date.now());
    const siweMessage = buildSiweMessage({
      nonce,
    });

    const request1 = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: siweMessage,
        signature: "0x" + "1".repeat(130),
      },
    });

    // 第一次尝试
    await verifySignature(request1);

    // 使用相同的 nonce 再次尝试（重放攻击）
    const request2 = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: siweMessage,
        signature: "0x" + "1".repeat(130),
      },
    });

    const response = await verifySignature(request2);
    const data = await response.json();

    // 应该拒绝重放攻击
    expect(response.status).toBe(401);
    expect(data.error.message).toContain("nonce");
  });

  it("应该验证域名匹配", async () => {
    const siweMessage = buildSiweMessage({
      nonce: "testnonce12345",
      domain: "malicious-site.com",
    });

    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: siweMessage,
        signature: "0x" + "1".repeat(130),
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    // 应该拒绝域名不匹配的消息
    expect(response.status).toBe(400);
    expect(data.error.message).toContain("domain");
  });

  it("应该验证时间戳有效性", async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1小时后
    const siweMessage = buildSiweMessage({
      nonce: "testnonce12345",
      issuedAt: futureTime,
    });

    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: siweMessage,
        signature: "0x" + "1".repeat(130),
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    // 应该拒绝未来时间的消息
    expect(response.status).toBe(400);
    expect(data.error.message).toContain("time");
  });
});
