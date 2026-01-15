import { NextRequest } from "next/server";
import { ApiResponses, proxyJsonResponse } from "@/lib/apiResponse";
import { getGaslessConfig, getRelayerBaseUrl, logApiEvent, logApiError } from "@/lib/serverUtils";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { getSession, hasValidStepUp, isTrustedDevice } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase.server";
import { getChainAddresses } from "@/lib/runtimeConfig";

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const limitResult = await checkRateLimit(ip, RateLimits.moderate, "aa_userop_submit_ip");
    if (!limitResult.success) {
      return ApiResponses.rateLimit("Too many requests");
    }

    const gasless = getGaslessConfig();
    if (!gasless.ok) {
      return ApiResponses.internalError("Gasless 配置错误", gasless.error);
    }
    if (!gasless.config.enabled) {
      return ApiResponses.badRequest("AA 未启用");
    }

    const session = await getSession(req);
    const owner = typeof session?.address === "string" ? String(session.address).toLowerCase() : "";
    if (!owner) {
      return ApiResponses.unauthorized("未登录或会话已过期");
    }
    const stepOk = (await hasValidStepUp(req, owner)) || (await isTrustedDevice(req, owner));
    if (!stepOk) {
      return ApiResponses.forbidden("需要二次验证后才能执行该操作");
    }

    const relayerBase = getRelayerBaseUrl();
    if (!relayerBase) {
      return ApiResponses.internalError("Relayer 未配置");
    }

    const rawBody = await req.json();
    let userOp = rawBody.userOp;
    const userOpHash = rawBody.userOpHash;
    const chainIdRaw = rawBody?.chainId ?? rawBody?.chain_id;
    const chainId = Number(chainIdRaw);

    // Auto-build UserOp from calls if provided
    if (!userOp && Array.isArray(rawBody.calls) && rawBody.calls.length > 0) {
      const { buildUserOpFromCalls } = await import("@/lib/aa/userOpBuilder");
      try {
        userOp = await buildUserOpFromCalls(chainId, owner, rawBody.calls);
      } catch (err: any) {
        return ApiResponses.badRequest("Failed to build UserOp: " + err.message);
      }
    }

    const addresses = getChainAddresses(
      Number.isFinite(chainId) && chainId > 0 ? chainId : undefined
    );
    const entryPointAddress =
      typeof addresses?.entryPoint === "string" ? String(addresses.entryPoint) : "";
    if (!entryPointAddress) {
      return ApiResponses.internalError("EntryPoint 未配置");
    }

    // 检查用户是否为邮箱托管模式
    const client = supabaseAdmin as any;
    if (!client) {
      return ApiResponses.internalError("Supabase 未配置");
    }
    const { data: profile } = await client
      .from("user_profiles")
      .select("proxy_wallet_type")
      .eq("wallet_address", owner)
      .maybeSingle();

    let signature = rawBody.signature;

    // 如果是邮箱托管用户，且请求中未提供签名（或者签名为空），则尝试进行托管签名
    const proxyWalletType =
      profile && typeof (profile as any).proxy_wallet_type === "string"
        ? String((profile as any).proxy_wallet_type)
        : "";
    if (proxyWalletType === "email" && (!signature || signature === "0x")) {
      const adminKey = String(
        process.env.RELAYER_ADMIN_KEY ||
          process.env.RELAYER_ADMIN_API_KEY ||
          process.env.RELAYER_API_KEY ||
          ""
      ).trim();
      const signHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (adminKey) signHeaders["X-API-KEY"] = adminKey;

      // 请求 Relayer 进行托管签名
      const signUrl = new URL("/aa/custodial/sign", relayerBase);
      const signRes = await fetch(signUrl.toString(), {
        method: "POST",
        headers: signHeaders,
        body: JSON.stringify({
          userOp,
          userOpHash,
          owner,
        }),
      });

      if (!signRes.ok) {
        return ApiResponses.internalError("托管签名失败");
      }

      const signData = await signRes.json();
      if (signData.success && signData.signature) {
        signature = signData.signature;
        // 更新 userOp 中的签名
        if (userOp) {
          userOp.signature = signature;
        }
      }
    }

    const aaKey = String(
      process.env.RELAYER_AA_API_KEY ||
        process.env.RELAYER_API_KEY ||
        process.env.RELAYER_ADMIN_KEY ||
        ""
    ).trim();
    const aaHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (aaKey) aaHeaders["X-API-KEY"] = aaKey;

    const relayerUrl = new URL("/aa/userop/submit", relayerBase);
    const relayerRes = await fetch(relayerUrl.toString(), {
      method: "POST",
      headers: aaHeaders,
      body: JSON.stringify({
        owner,
        userOp: userOp || rawBody, // 兼容旧格式
        signature, // 传递可能更新后的签名
        entryPointAddress,
        ...gasless.config,
      }),
    });
    return proxyJsonResponse(relayerRes, {
      successMessage: "ok",
      errorMessage: "Relayer request failed",
      onResult: async ({ ok, status, json }) => {
        if (ok) return;
        const raw = json && typeof json === "object" ? (json as any) : {};
        const message = String(raw?.error?.message || raw?.message || "Relayer request failed");
        const code = raw?.error?.code || raw?.code;
        await logApiEvent("aa_userop_submit_failed", {
          owner: owner.slice(0, 10),
          status,
          code: typeof code === "string" ? code.slice(0, 64) : "",
          message: message.slice(0, 300),
        });
      },
    });
  } catch (e: any) {
    try {
      const session = await getSession(req);
      const owner =
        typeof session?.address === "string" ? String(session.address).toLowerCase() : "";
      await logApiEvent("aa_userop_submit_exception", {
        owner: owner ? owner.slice(0, 10) : "",
        message: String(e?.message || e).slice(0, 300),
      });
    } catch {}
    logApiError("POST /api/aa/userop/submit", e);
    return ApiResponses.internalError(
      "Failed to submit user operation",
      process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
    );
  }
}
