import { NextRequest } from "next/server";
import { ethers } from "ethers";
import type { Database } from "@/lib/database.types";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { parseRequestBody, logApiError, normalizeAddress } from "@/lib/serverUtils";
import { getSession, hasValidStepUp, isTrustedDevice } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { getConfiguredChainId, getConfiguredRpcUrl } from "@/lib/runtimeConfig";

const SENTINEL_OWNERS = "0x0000000000000000000000000000000000000001";

function isEthAddress(addr: string) {
  return /^0x[a-f0-9]{40}$/.test(normalizeAddress(String(addr || "")));
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const rl = await checkRateLimit(ip || "unknown", RateLimits.moderate, "owner-migration");
    if (!rl.success) return ApiResponses.rateLimit("请求过于频繁");

    const session = await getSession(req);
    const address =
      typeof session?.address === "string" ? String(session.address).toLowerCase() : "";
    if (!address || !isEthAddress(address)) return ApiResponses.unauthorized("未认证或会话已过期");

    const stepOk = (await hasValidStepUp(req, address)) || (await isTrustedDevice(req, address));
    if (!stepOk) {
      return ApiResponses.forbidden("需要二次验证后才能迁移 owner");
    }

    const payload = await parseRequestBody(req);
    const newOwnerRaw = typeof payload?.newOwner === "string" ? payload.newOwner : "";
    const newOwner = normalizeAddress(newOwnerRaw).toLowerCase();
    if (!newOwner || !isEthAddress(newOwner))
      return ApiResponses.invalidParameters("newOwner 无效");
    if (newOwner === address)
      return ApiResponses.invalidParameters("newOwner 不能与当前 owner 相同");

    const chainId = getConfiguredChainId();
    if (chainId !== 80002 && chainId !== 137) {
      return ApiResponses.badRequest("仅支持 Polygon Amoy (80002) 或 Polygon Mainnet (137)");
    }
    const rpcUrl = getConfiguredRpcUrl(chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const admin = supabaseAdmin as any;
    if (!admin) return ApiResponses.internalError("Missing service key");

    const { data: profRaw, error: profErr } = await admin
      .from("user_profiles")
      .select("wallet_address,proxy_wallet_address,proxy_wallet_type")
      .eq("wallet_address", address)
      .maybeSingle();
    if (profErr) return ApiResponses.databaseError("Failed to load user profile", profErr.message);

    const prof = (profRaw || null) as Pick<
      Database["public"]["Tables"]["user_profiles"]["Row"],
      "wallet_address" | "proxy_wallet_address" | "proxy_wallet_type"
    > | null;

    const safeAddress = normalizeAddress(String(prof?.proxy_wallet_address || "")).toLowerCase();
    const safeType = String(prof?.proxy_wallet_type || "")
      .trim()
      .toLowerCase();
    if (!safeAddress || !isEthAddress(safeAddress)) {
      return ApiResponses.notFound("未找到智能账户地址，请先创建 AA 钱包");
    }
    if (safeType !== "safe" && safeType !== "safe4337") {
      return ApiResponses.badRequest("当前账号不是 Safe 类型，无法迁移 owner");
    }

    const code = await provider.getCode(safeAddress);
    if (!code || code === "0x") {
      return ApiResponses.badRequest("智能账户尚未部署，无法迁移 owner");
    }

    const safe = new ethers.Contract(
      safeAddress,
      [
        "function getOwners() view returns (address[])",
        "function getThreshold() view returns (uint256)",
        "function swapOwner(address prevOwner, address oldOwner, address newOwner)",
      ],
      provider
    );

    const ownersRaw: string[] = await safe.getOwners();
    const owners = Array.isArray(ownersRaw)
      ? ownersRaw.map((o) => normalizeAddress(String(o || "")).toLowerCase()).filter(Boolean)
      : [];
    const oldIdx = owners.findIndex((o) => o === address);
    if (oldIdx < 0) return ApiResponses.forbidden("当前会话地址不是 Safe owner");
    if (owners.includes(newOwner))
      return ApiResponses.invalidParameters("newOwner 已经是 Safe owner");

    const thresholdRaw = await safe.getThreshold();
    const threshold =
      typeof thresholdRaw === "bigint" ? thresholdRaw : BigInt(String(thresholdRaw || "0"));
    if (threshold <= 0n) return ApiResponses.internalError("Safe threshold 无效");

    const prevOwner = oldIdx === 0 ? SENTINEL_OWNERS : owners[oldIdx - 1];
    const iface = safe.interface;
    const data = iface.encodeFunctionData("swapOwner", [prevOwner, address, newOwner]);

    return successResponse(
      {
        chainId,
        safeAddress,
        oldOwner: address,
        newOwner,
        prevOwner,
        threshold: threshold.toString(),
        to: safeAddress,
        value: "0",
        operation: 0,
        data,
      },
      "Owner migration prepared"
    );
  } catch (e) {
    const error = e as Error;
    logApiError("POST /api/aa/owner-migration", error);
    const detail = String(error?.message || error);
    return ApiResponses.internalError(
      "Failed to prepare owner migration",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
