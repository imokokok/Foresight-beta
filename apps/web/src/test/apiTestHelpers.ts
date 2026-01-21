/**
 * API 测试工具类
 * 用于简化 API 集成测试的编写
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * 创建模拟的 NextRequest
 */
export function createMockNextRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
}): NextRequest {
  const {
    method = "GET",
    url = "http://localhost:3000",
    headers = {},
    body,
    cookies = {},
  } = options;

  const request = new NextRequest(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  // 添加 cookies
  Object.entries(cookies).forEach(([key, value]) => {
    request.cookies.set(key, value);
  });

  return request;
}

/**
 * API 测试客户端
 */
export class ApiTestClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl;
    this.headers = {
      "Content-Type": "application/json",
    };
  }

  /**
   * 设置认证 token
   */
  setAuthToken(token: string) {
    this.headers["Authorization"] = `Bearer ${token}`;
  }

  /**
   * 设置 Cookie
   */
  setCookie(cookie: string) {
    this.headers["Cookie"] = cookie;
  }

  /**
   * GET 请求
   */
  async get(path: string, options?: RequestInit) {
    return this.request("GET", path, undefined, options);
  }

  /**
   * POST 请求
   */
  async post(path: string, body?: any, options?: RequestInit) {
    return this.request("POST", path, body, options);
  }

  /**
   * PUT 请求
   */
  async put(path: string, body?: any, options?: RequestInit) {
    return this.request("PUT", path, body, options);
  }

  /**
   * DELETE 请求
   */
  async delete(path: string, options?: RequestInit) {
    return this.request("DELETE", path, undefined, options);
  }

  /**
   * 通用请求方法
   */
  private async request(method: string, path: string, body?: any, options?: RequestInit) {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: { ...this.headers, ...options?.headers },
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    let data;
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data,
      ok: response.ok,
    };
  }

  /**
   * 清除认证信息
   */
  clearAuth() {
    delete this.headers["Authorization"];
    delete this.headers["Cookie"];
  }
}

/**
 * 测试数据清理工具
 */
export class TestDataCleaner {
  private itemsToClean: Array<{ table: string; id: string }> = [];

  /**
   * 注册需要清理的数据
   */
  register(table: string, id: string) {
    this.itemsToClean.push({ table, id });
  }

  /**
   * 清理所有注册的数据
   */
  async cleanup() {
    // 这里应该连接数据库进行清理
    // 暂时只是记录日志
    for (const item of this.itemsToClean) {
      console.log(`[Test Cleanup] Cleaning ${item.table}:${item.id}`);
      // TODO: 实际的数据库清理逻辑
      // await supabase.from(item.table).delete().eq('id', item.id);
    }
    this.itemsToClean = [];
  }
}

/**
 * Mock 签名工具（用于测试订单签名）
 */
export function createMockSignature(orderData: any): string {
  // 这是一个简化的 mock 签名
  // 实际测试中应该使用真实的签名逻辑
  const data = JSON.stringify(orderData);
  return `0x${Buffer.from(data).toString("hex").slice(0, 130)}`;
}

/**
 * 等待异步操作
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试函数（用于处理异步操作）
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        await waitFor(delay * Math.pow(backoff, attempt - 1));
      }
    }
  }

  throw lastError!;
}

/**
 * 创建测试用的用户数据
 */
export function createTestUser(overrides: Partial<any> = {}) {
  return {
    id: `test-user-${Date.now()}`,
    username: "test_user",
    wallet_address: "0x1234567890123456789012345678901234567890",
    email: "test@example.com",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 创建测试用的订单数据
 */
export function createTestOrder(overrides: Partial<any> = {}) {
  return {
    marketId: "test-market-1",
    side: "BUY",
    outcome: "YES",
    price: 0.5,
    size: 100,
    salt: Date.now(),
    signer: "0x1234567890123456789012345678901234567890",
    expiry: Math.floor(Date.now() / 1000) + 86400, // 24小时后过期
    ...overrides,
  };
}

/**
 * 创建测试用的预测事件数据
 */
export function createTestPrediction(overrides: Partial<any> = {}) {
  return {
    id: `test-prediction-${Date.now()}`,
    title: "Test Prediction Event",
    description: "This is a test prediction event",
    category: "test",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后
    min_stake: 10,
    max_stake: 1000,
    status: "active",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 断言辅助函数
 */
export const assertions = {
  /**
   * 断言响应状态码
   */
  assertStatus(response: any, expectedStatus: number) {
    if (response.status !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, got ${response.status}. Response: ${JSON.stringify(response.data)}`
      );
    }
  },

  /**
   * 断言响应包含字段
   */
  assertHasField(obj: any, field: string) {
    if (!(field in obj)) {
      throw new Error(
        `Expected object to have field "${field}", but it doesn't. Object: ${JSON.stringify(obj)}`
      );
    }
  },

  /**
   * 断言数组不为空
   */
  assertNotEmpty(arr: any[]) {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error(`Expected non-empty array, got: ${JSON.stringify(arr)}`);
    }
  },

  /**
   * 断言值相等
   */
  assertEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  },
};
