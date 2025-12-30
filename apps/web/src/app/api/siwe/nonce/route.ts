import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET() {
  // 使用 crypto 生成安全的随机 nonce
  const nonce = randomBytes(16).toString("hex");

  const res = NextResponse.json({ nonce });
  // 将 nonce 放入 HttpOnly Cookie，供校验使用
  res.cookies.set("siwe_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 分钟有效
  });
  return res;
}
