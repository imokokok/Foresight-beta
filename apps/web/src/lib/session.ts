import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createToken, verifyToken, createRefreshToken, type JWTPayload } from './jwt';

const SESSION_COOKIE_NAME = 'fs_session';
const REFRESH_COOKIE_NAME = 'fs_refresh';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * 创建会话并设置 Cookie
 */
export async function createSession(
  response: NextResponse,
  address: string,
  chainId?: number
): Promise<void> {
  const token = await createToken(address, chainId);
  const refreshToken = await createRefreshToken(address, chainId);

  // 设置访问 token（7天）
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60, // 7 天
  });

  // 设置刷新 token（30天）
  response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60, // 30 天
  });
}

/**
 * 从请求中获取会话
 */
export async function getSession(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return await verifyToken(token);
}

/**
 * 从服务端组件获取会话（使用 cookies()）
 */
export async function getSessionFromCookies(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return await verifyToken(token);
}

/**
 * 尝试刷新会话
 */
export async function refreshSession(
  req: NextRequest,
  response: NextResponse
): Promise<boolean> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return false;
  }

  const payload = await verifyToken(refreshToken);

  if (!payload) {
    return false;
  }

  // 创建新的访问 token
  await createSession(response, payload.address, payload.chainId);

  return true;
}

/**
 * 清除会话
 */
export function clearSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });

  response.cookies.set(REFRESH_COOKIE_NAME, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * 验证请求是否已认证
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ authenticated: true; session: JWTPayload } | { authenticated: false; error: string }> {
  const session = await getSession(req);

  if (!session) {
    return {
      authenticated: false,
      error: '未认证或会话已过期',
    };
  }

  return {
    authenticated: true,
    session,
  };
}

/**
 * 验证会话地址是否匹配
 */
export async function verifySessionAddress(
  req: NextRequest,
  expectedAddress: string
): Promise<boolean> {
  const session = await getSession(req);

  if (!session) {
    return false;
  }

  return session.address.toLowerCase() === expectedAddress.toLowerCase();
}

