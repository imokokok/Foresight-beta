import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

const JWT_ISSUER = 'foresight';
const JWT_AUDIENCE = 'foresight-users';

export interface JWTPayload {
  address: string;
  chainId?: number;
  issuedAt: number;
}

/**
 * 创建 JWT Token
 * @param address 用户地址
 * @param chainId 链 ID
 * @param expiresIn 过期时间（秒），默认 7 天
 */
export async function createToken(
  address: string,
  chainId?: number,
  expiresIn: number = 7 * 24 * 60 * 60 // 7 天
): Promise<string> {
  const payload: JWTPayload = {
    address: address.toLowerCase(),
    chainId,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(JWT_SECRET);

  return token;
}

/**
 * 验证 JWT Token
 * @param token JWT Token
 * @returns 解码后的 payload 或 null
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return payload as unknown as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * 创建刷新 Token（有效期更长）
 * @param address 用户地址
 * @param chainId 链 ID
 */
export async function createRefreshToken(
  address: string,
  chainId?: number
): Promise<string> {
  // 刷新 token 有效期 30 天
  return createToken(address, chainId, 30 * 24 * 60 * 60);
}

/**
 * 从 Token 中提取地址（不验证有效性，仅解码）
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    return payload as JWTPayload;
  } catch {
    return null;
  }
}

