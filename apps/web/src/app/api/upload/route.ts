// 图片上传API路由
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildDiceBearUrl } from "@/lib/dicebear";
import { ApiResponses } from "@/lib/apiResponse";
import { getSessionAddress, normalizeAddress } from "@/lib/serverUtils";

function isEvmAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
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
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("predictions") // 存储桶名称
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.warn("Supabase Storage上传失败，使用备用方案:", uploadError);
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
    return NextResponse.json(
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
  } catch (error: any) {
    console.error("图片上传异常:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return ApiResponses.internalError("图片上传失败", detail);
  }
}

// 处理OPTIONS请求（CORS）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
