import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function withNoStore<T>(res: NextResponse<T>) {
  try {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
  } catch {}
  return res;
}

function buildChallengeMessage(params: { domain: string; nonce: string }) {
  const domain = String(params.domain || "").trim() || "localhost";
  const nonce = String(params.nonce || "").trim();
  return `${domain} wants you to sign in to Foresight.\n\nNonce: ${nonce}`;
}

export async function GET(req: NextRequest) {
  const nonce = randomBytes(16).toString("hex");
  const domain = (() => {
    try {
      return String(req.nextUrl?.host || "");
    } catch {
      return "";
    }
  })();
  const message = buildChallengeMessage({ domain, nonce });

  const res = NextResponse.json({ nonce, message });
  res.cookies.set("auth_challenge_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return withNoStore(res);
}
