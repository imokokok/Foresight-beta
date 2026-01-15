import { SignJWT, jwtVerify } from "jose";

function resolveJwtSecret(): Uint8Array {
  const raw = (process.env.JWT_SECRET || "").trim();
  if (raw) return new TextEncoder().encode(raw);
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing JWT_SECRET");
  }
  return new TextEncoder().encode("your-secret-key-change-in-production");
}

const JWT_ISSUER = "foresight";
const JWT_AUDIENCE = "foresight-users";

export interface JWTPayload {
  address: string;
  chainId?: number;
  issuedAt: number;
  sid?: string;
  tokenType?: "session" | "refresh" | "email_change" | "stepup" | "owner_migration" | "signup";
  [key: string]: unknown;
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
  expiresIn: number = 7 * 24 * 60 * 60,
  options?: {
    sessionId?: string;
    tokenType?: "session" | "refresh" | "email_change" | "stepup" | "owner_migration" | "signup";
    extra?: Record<string, unknown>;
  }
): Promise<string> {
  const payload: JWTPayload = {
    ...(options?.extra ? options.extra : {}),
    address: address.toLowerCase(),
    chainId,
    issuedAt: Math.floor(Date.now() / 1000),
    ...(options?.sessionId ? { sid: options.sessionId } : {}),
    ...(options?.tokenType ? { tokenType: options.tokenType } : {}),
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(resolveJwtSecret());

  return token;
}

/**
 * 验证 JWT Token
 * @param token JWT Token
 * @returns 解码后的 payload 或 null
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, resolveJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return payload as unknown as JWTPayload;
  } catch (error) {
    const code = (error as any)?.code;
    if (
      code !== "ERR_JWS_INVALID" &&
      code !== "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" &&
      code !== "ERR_JWT_EXPIRED" &&
      code !== "ERR_JWT_CLAIM_VALIDATION_FAILED"
    ) {
      console.error("JWT verification failed:", error);
    }
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
  chainId?: number,
  options?: { sessionId?: string }
): Promise<string> {
  // 刷新 token 有效期 30 天
  return createToken(address, chainId, 30 * 24 * 60 * 60, {
    tokenType: "refresh",
    sessionId: options?.sessionId,
  });
}

/**
 * 从 Token 中提取地址（不验证有效性，仅解码）
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));

    return payload as JWTPayload;
  } catch {
    return null;
  }
}
