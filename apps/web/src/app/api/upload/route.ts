// 图片上传API路由
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
import { buildDiceBearUrl } from "@/lib/dicebear";
import { ApiResponses } from "@/lib/apiResponse";
import { getSessionAddress, logApiError, normalizeAddress } from "@/lib/serverUtils";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";

function isEvmAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function resolveAllowedOrigins(request: NextRequest): Set<string> {
  const allowed = new Set<string>();
  try {
    allowed.add(request.nextUrl.origin);
  } catch {}
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {}
  }
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }
  return allowed;
}

function getAllowedOriginHeader(request: NextRequest): string | null {
  const origin = String(request.headers.get("origin") || "").trim();
  if (!origin) return null;
  return resolveAllowedOrigins(request).has(origin) ? origin : null;
}

function guessFileExt(file: File) {
  const rawName = String(file?.name || "");
  const nameExt = rawName.includes(".") ? rawName.split(".").pop() || "" : "";
  const ext = nameExt.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (ext) return ext;
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return byMime[String(file?.type || "").toLowerCase()] || "bin";
}

export async function POST(request: NextRequest) {
  try {
    const allowedOrigin = getAllowedOriginHeader(request);
    if (request.headers.get("origin") && !allowedOrigin) {
      return ApiResponses.forbidden("Origin not allowed");
    }
    // 验证用户是否已登录（钱包地址）
    const formData = await request.formData();
    const sessAddrRaw = await getSessionAddress(request);
    const sessAddr = normalizeAddress(String(sessAddrRaw || ""));
    if (!sessAddr) {
      return ApiResponses.unauthorized("请先连接钱包登录");
    }
    if (!isEvmAddress(sessAddr)) {
      return ApiResponses.unauthorized("无效的钱包地址格式");
    }

    const walletAddressRaw = String(formData.get("walletAddress") || "");
    const walletAddress = walletAddressRaw ? normalizeAddress(walletAddressRaw) : "";
    const file = formData.get("file") as File;

    if (walletAddress && walletAddress !== sessAddr) {
      return ApiResponses.forbidden("walletAddress mismatch");
    }

    const ip = getIP(request);
    const rl = await checkRateLimit(
      `upload:${sessAddr.toLowerCase()}:${ip || "unknown"}`,
      RateLimits.strict,
      "upload_image"
    );
    if (!rl.success) {
      return ApiResponses.rateLimit("上传过于频繁，请稍后再试");
    }

    // 验证文件
    if (!file) {
      return ApiResponses.invalidParameters("请选择要上传的图片文件");
    }

    // 验证文件类型
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return ApiResponses.invalidParameters("只支持 JPEG、PNG、WebP 和 GIF 格式的图片");
    }

    // 验证文件大小（最大5MB）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return ApiResponses.invalidParameters("图片文件大小不能超过5MB");
    }

    // 生成唯一的文件名
    const timestamp = Date.now();
    const fileExtension = guessFileExt(file);
    const fileName = `predictions/${sessAddr}/${timestamp}.${fileExtension}`;

    // 将文件转换为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 尝试上传到Supabase Storage
    let publicUrl: string;

    try {
      if (!supabaseAdmin) {
        throw new Error("Service key not configured");
      }
      const { error: uploadError } = await supabaseAdmin.storage
        .from("predictions") // 存储桶名称
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        logApiError("POST /api/upload storage upload failed", uploadError);
        // 如果存储桶不存在，使用备用方案：生成基于标题的图片
        throw new Error("Storage bucket not available");
      }

      // 获取公开的图片URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from("predictions")
        .getPublicUrl(fileName);

      if (!publicUrlData.publicUrl) {
        throw new Error("Failed to get public URL");
      }

      publicUrl = publicUrlData.publicUrl;
    } catch (storageError) {
      const seed = `${walletAddress}-${Date.now()}`;
      publicUrl = buildDiceBearUrl(seed, "&size=256&backgroundColor=b6e3f4,c0aede,d1d4f9");
    }

    // 返回成功响应
    const res = NextResponse.json(
      {
        success: true,
        data: {
          fileName: fileName,
          publicUrl: publicUrl,
          fileSize: file.size,
          contentType: file.type,
        },
        message: "图片上传成功",
      },
      { status: 201 }
    );
    if (allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      res.headers.set("Vary", "Origin");
    }
    return res;
  } catch (error: any) {
    logApiError("POST /api/upload unhandled error", error);
    const detail = error instanceof Error ? error.message : String(error);
    const res = ApiResponses.internalError(
      "图片上传失败",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
    const allowedOrigin = getAllowedOriginHeader(request);
    if (allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      res.headers.set("Vary", "Origin");
    }
    return res;
  }
}

// 处理OPTIONS请求（CORS）
export async function OPTIONS(request: NextRequest) {
  const allowedOrigin = getAllowedOriginHeader(request);
  if (request.headers.get("origin") && !allowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
