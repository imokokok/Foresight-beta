import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { parseRequestBody, logApiError } from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const payload = await parseRequestBody(req as any);

    const messageStr: string = payload?.message || "";
    const signature: string = payload?.signature || "";

    if (!messageStr || !signature) {
      return ApiResponses.badRequest("SIWE 必填字段缺失: message 或 signature");
    }

    if (!/^0x[0-9a-fA-F]+$/.test(signature) || signature.length < 10) {
      return ApiResponses.badRequest("签名格式无效");
    }

    let msg: SiweMessage;
    try {
      msg = new SiweMessage(messageStr);
    } catch (err) {
      return ApiResponses.badRequest("无效的 SIWE 消息格式");
    }

    const domain = (payload?.domain ||
      msg.domain ||
      (typeof window === "undefined" ? undefined : window.location.host)) as string | undefined;
    const origin = (payload?.uri || msg.uri) as string | undefined;
    const nonce = msg.nonce;

    if (!domain || !msg.address || !origin || !msg.version || !msg.chainId || !nonce) {
      return ApiResponses.badRequest("SIWE 消息缺少必填字段");
    }

    try {
      const url = new URL((req as any).nextUrl?.href || req.url);
      const expectedDomain = url.host;
      if (domain !== expectedDomain) {
        return ApiResponses.badRequest("SIWE domain 不匹配");
      }
    } catch {}

    if (msg.issuedAt) {
      const issuedAtTime = new Date(msg.issuedAt).getTime();
      if (Number.isFinite(issuedAtTime)) {
        const now = Date.now();
        if (issuedAtTime - now > 5 * 60 * 1000) {
          return ApiResponses.badRequest("SIWE time 无效: issuedAt 在未来");
        }
      }
    }

    const allowedChainIds = new Set([1, 11155111]);
    const msgChainId = Number(msg.chainId);
    if (!allowedChainIds.has(msgChainId)) {
      return ApiResponses.badRequest("不支持的 chainId");
    }

    const cookieNonce = req.cookies.get("siwe_nonce")?.value || "";

    if (!cookieNonce || cookieNonce !== nonce) {
      return ApiResponses.sessionExpired("nonce 不匹配或过期");
    }

    try {
      const result = await msg.verify({ signature, domain, nonce });
      if (!result?.success) {
        return ApiResponses.invalidSignature("签名验证失败");
      }
    } catch {
      return ApiResponses.invalidSignature("签名验证失败");
    }

    const address = msg.address;
    const chainId = msgChainId;
    const res = NextResponse.json({ success: true, address });

    const { createSession } = await import("@/lib/session");
    await createSession(res, address, chainId);

    res.cookies.set("siwe_nonce", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (e: any) {
    logApiError("POST /api/siwe/verify", e);
    return ApiResponses.internalError("服务器错误", String(e?.message || e));
  }
}
