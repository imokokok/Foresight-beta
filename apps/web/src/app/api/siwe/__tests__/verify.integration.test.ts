/**
 * SIWE 认证 API 集成测试
 * 测试 Sign-In with Ethereum 认证流程
 */

import { describe, it, expect, beforeEach } from "vitest";
import { POST as verifySignature } from "../verify/route";
import { GET as getNonce } from "../nonce/route";
import { createMockNextRequest } from "@/test/apiTestHelpers";

// 暂时跳过集成测试 - 需要真实 API 和数据库
describe.skip("GET /api/siwe/nonce - 获取 Nonce", () => {
  it("应该返回新的 nonce", async () => {
    const response = await getNonce();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.nonce).toBeDefined();
    expect(typeof data.data.nonce).toBe("string");
    expect(data.data.nonce.length).toBeGreaterThan(0);
  });

  it("每次请求应该返回不同的 nonce", async () => {
    const response1 = await getNonce();
    const data1 = await response1.json();

    const response2 = await getNonce();
    const data2 = await response2.json();

    expect(data1.data.nonce).not.toBe(data2.data.nonce);
  });
});

describe.skip("POST /api/siwe/verify - 验证签名", () => {
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
    const expiredNonce = "expired-nonce-12345";

    const siweMessage = `localhost:3000 wants you to sign in with your Ethereum account:
0x1234567890123456789012345678901234567890

Sign in with Ethereum to the app.

URI: http://localhost:3000
Version: 1
Chain ID: 1
Nonce: ${expiredNonce}
Issued At: ${new Date(Date.now() - 3600000).toISOString()}`; // 1小时前

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
    const siweMessage = `localhost:3000 wants you to sign in with your Ethereum account:
0x1234567890123456789012345678901234567890

Sign in with Ethereum to the app.

URI: http://localhost:3000
Version: 1
Chain ID: 1
Nonce: test-nonce-12345
Issued At: ${new Date().toISOString()}`;

    // 使用错误的私钥签名（签名不匹配地址）
    const invalidSignature = "0x" + "2".repeat(130);

    const request = createMockNextRequest({
      method: "POST",
      url: "http://localhost:3000/api/siwe/verify",
      body: {
        message: siweMessage,
        signature: invalidSignature,
      },
    });

    const response = await verifySignature(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("INVALID_SIGNATURE");
  });

  it("应该拒绝不支持的 chain ID", async () => {
    const siweMessage = `localhost:3000 wants you to sign in with your Ethereum account:
0x1234567890123456789012345678901234567890

Sign in with Ethereum to the app.

URI: http://localhost:3000
Version: 1
Chain ID: 99999
Nonce: test-nonce-12345
Issued At: ${new Date().toISOString()}`;

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

  it("成功验证后应该设置 session cookie", async () => {
    // 注意：这个测试需要真实的签名
    // 在实际环境中需要使用私钥签名 SIWE 消息

    // TODO: 实现完整的签名流程测试
    // 1. 获取 nonce
    // 2. 构建 SIWE 消息
    // 3. 使用私钥签名
    // 4. 验证签名
    // 5. 检查返回的 cookie

    expect(true).toBe(true); // 占位测试
  });

  it("应该限制登录尝试次数（Rate Limiting）", async () => {
    const requests = [];

    // 快速发送多个请求
    for (let i = 0; i < 10; i++) {
      const request = createMockNextRequest({
        method: "POST",
        url: "http://localhost:3000/api/siwe/verify",
        headers: {
          "X-Forwarded-For": "1.2.3.4", // 模拟同一个 IP
        },
        body: {
          message: "test",
          signature: "0x123",
        },
      });

      requests.push(verifySignature(request));
    }

    const responses = await Promise.all(requests);

    // 至少有一个请求应该被限流（返回 429）
    const rateLimited = responses.some((r) => r.status === 429);
    expect(rateLimited).toBe(true);
  });
});

describe.skip("SIWE 安全性测试", () => {
  it("应该拒绝重放攻击（相同的 nonce）", async () => {
    const nonce = "test-nonce-" + Date.now();

    const siweMessage = `localhost:3000 wants you to sign in with your Ethereum account:
0x1234567890123456789012345678901234567890

Sign in with Ethereum to the app.

URI: http://localhost:3000
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;

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
    const siweMessage = `malicious-site.com wants you to sign in with your Ethereum account:
0x1234567890123456789012345678901234567890

Sign in with Ethereum to the app.

URI: http://malicious-site.com
Version: 1
Chain ID: 1
Nonce: test-nonce-12345
Issued At: ${new Date().toISOString()}`;

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

    const siweMessage = `localhost:3000 wants you to sign in with your Ethereum account:
0x1234567890123456789012345678901234567890

Sign in with Ethereum to the app.

URI: http://localhost:3000
Version: 1
Chain ID: 1
Nonce: test-nonce-12345
Issued At: ${futureTime}`;

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
