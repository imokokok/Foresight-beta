import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { getClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import {
  getSessionAddress,
  getProxyWalletConfig,
  normalizeAddress,
  logApiError,
} from "@/lib/serverUtils";
import { ApiResponses, successResponse } from "@/lib/apiResponse";

function deriveProxyWalletAddress(baseAddress: string, proxyType: string) {
  const seed = `foresight-proxy:${proxyType}:${baseAddress.toLowerCase()}`;
  const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
  const body = hash.slice(-40);
  return normalizeAddress(`0x${body}`);
}

export async function POST(req: NextRequest) {
  try {
    const baseAddrRaw = await getSessionAddress(req);
    const baseAddress = normalizeAddress(baseAddrRaw);
    if (!baseAddress) {
      return ApiResponses.unauthorized("未登录或会话已过期");
    }

    const proxyConfig = getProxyWalletConfig();
    if (!proxyConfig.ok) {
      return ApiResponses.internalError("Proxy wallet 配置错误", proxyConfig.error);
    }
    if (!proxyConfig.config) {
      return ApiResponses.badRequest("Proxy wallet 未启用");
    }

    const client = getClient() as any;
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }

    const { data: rawExisting, error: queryError } = await client
      .from("user_profiles")
      .select("wallet_address, proxy_wallet_address, proxy_wallet_type, created_at, updated_at")
      .eq("wallet_address", baseAddress)
      .maybeSingle();

    if (queryError) {
      return ApiResponses.databaseError("Failed to load user profile", queryError.message);
    }

    const existing = rawExisting as Database["public"]["Tables"]["user_profiles"]["Row"] | null;
    const now = new Date().toISOString();
    const targetType = proxyConfig.config.type;

    let existingProxyAddress =
      existing && existing.proxy_wallet_address
        ? normalizeAddress(existing.proxy_wallet_address)
        : "";

    if (existingProxyAddress && existing?.proxy_wallet_type === targetType) {
      return successResponse(
        {
          address: existingProxyAddress,
          type: targetType,
        },
        "Proxy wallet already exists"
      );
    }

    const proxyAddress = deriveProxyWalletAddress(baseAddress, targetType);

    if (!existing) {
      const insertPayload: Database["public"]["Tables"]["user_profiles"]["Insert"] = {
        wallet_address: baseAddress,
        proxy_wallet_address: proxyAddress,
        proxy_wallet_type: targetType,
        created_at: now,
        updated_at: now,
      };
      const { error: insertError } = await client.from("user_profiles").insert(insertPayload);
      if (insertError) {
        return ApiResponses.databaseError("Failed to create user profile", insertError.message);
      }
    } else {
      const updatePayload: Database["public"]["Tables"]["user_profiles"]["Update"] = {
        proxy_wallet_address: proxyAddress,
        proxy_wallet_type: targetType,
        updated_at: now,
      };
      const { error: updateError } = await client
        .from("user_profiles")
        .update(updatePayload)
        .eq("wallet_address", baseAddress);
      if (updateError) {
        return ApiResponses.databaseError("Failed to update user profile", updateError.message);
      }
    }

    return successResponse(
      {
        address: proxyAddress,
        type: targetType,
      },
      "Proxy wallet ready"
    );
  } catch (e: any) {
    logApiError("POST /api/wallets/proxy", e);
    const detail = String(e?.message || e);
    return ApiResponses.internalError(
      "Failed to prepare proxy wallet",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
