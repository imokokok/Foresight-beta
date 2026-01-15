import { NextRequest } from "next/server";
import { ethers } from "ethers";
import { supabaseAdmin } from "@/lib/supabase.server";
import type { Database } from "@/lib/database.types";
import {
  getSessionAddress,
  getProxyWalletConfig,
  normalizeAddress,
  logApiError,
} from "@/lib/serverUtils";
import {
  deriveProxyWalletAddress,
  resolveSaltNonce,
  encodeSafeInitializer,
  computeSafeCounterfactualAddress,
} from "@/lib/safeUtils";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { getConfiguredChainId, getConfiguredRpcUrl } from "@/lib/runtimeConfig";

type DeploymentStatus = "deployed" | "not_deployed" | "unknown";

async function resolveDeploymentStatus(
  provider: ethers.JsonRpcProvider,
  address: string
): Promise<DeploymentStatus> {
  try {
    const code = await provider.getCode(address);
    if (code && code !== "0x") return "deployed";
    return "not_deployed";
  } catch {
    return "unknown";
  }
}

export async function POST(req: NextRequest) {
  try {
    const baseAddrRaw = await getSessionAddress(req);
    const baseAddress = normalizeAddress(baseAddrRaw);
    if (!/^0x[a-f0-9]{40}$/.test(baseAddress)) {
      return ApiResponses.unauthorized("未登录或会话已过期");
    }

    const chainId = getConfiguredChainId();
    if (chainId !== 80002 && chainId !== 137) {
      return ApiResponses.badRequest("仅支持 Polygon Amoy (80002) 或 Polygon Mainnet (137)");
    }

    const proxyConfig = getProxyWalletConfig();
    if (!proxyConfig.ok) {
      return ApiResponses.internalError("Proxy wallet 配置错误", proxyConfig.error);
    }
    if (!proxyConfig.config) {
      return ApiResponses.badRequest("Proxy wallet 未启用");
    }

    const client = supabaseAdmin as any;
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
    const existingType = String(existing?.proxy_wallet_type || "")
      .trim()
      .toLowerCase();
    const isEmailCustody = existingType === "email";

    let existingProxyAddress =
      existing && existing.proxy_wallet_address
        ? normalizeAddress(existing.proxy_wallet_address)
        : "";

    const ownerEoa = baseAddress;
    const rpcUrl = getConfiguredRpcUrl(chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const smartAccountAddress =
      targetType === "safe" || targetType === "safe4337"
        ? await computeSafeCounterfactualAddress({
            provider,
            factoryAddress: proxyConfig.config.safeFactoryAddress || "",
            singletonAddress: proxyConfig.config.safeSingletonAddress || "",
            initializer: encodeSafeInitializer({
              ownerEoa,
              fallbackHandler: proxyConfig.config.safeFallbackHandlerAddress || ethers.ZeroAddress,
            }),
            saltNonce: resolveSaltNonce(ownerEoa, chainId),
          })
        : deriveProxyWalletAddress(ownerEoa, targetType);

    const deploymentStatus =
      targetType === "safe" || targetType === "safe4337"
        ? await resolveDeploymentStatus(provider, smartAccountAddress)
        : "unknown";

    if (existingProxyAddress && existingProxyAddress === smartAccountAddress) {
      return successResponse(
        {
          chain_id: chainId,
          owner_eoa: ownerEoa,
          smart_account_address: smartAccountAddress,
          deployment_status: deploymentStatus,
          address: smartAccountAddress,
          type: targetType,
        },
        "Proxy wallet already exists"
      );
    }

    if (!existing) {
      const insertPayload: Database["public"]["Tables"]["user_profiles"]["Insert"] = {
        wallet_address: ownerEoa,
        proxy_wallet_address: smartAccountAddress,
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
        proxy_wallet_address: smartAccountAddress,
        updated_at: now,
      };
      if (!isEmailCustody) {
        updatePayload.proxy_wallet_type = targetType;
      }
      const { error: updateError } = await client
        .from("user_profiles")
        .update(updatePayload)
        .eq("wallet_address", ownerEoa);
      if (updateError) {
        return ApiResponses.databaseError("Failed to update user profile", updateError.message);
      }
    }

    return successResponse(
      {
        chain_id: chainId,
        owner_eoa: ownerEoa,
        smart_account_address: smartAccountAddress,
        deployment_status: deploymentStatus,
        address: smartAccountAddress,
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
