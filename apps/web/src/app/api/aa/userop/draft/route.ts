import { NextRequest } from "next/server";
import { ApiResponses, proxyJsonResponse } from "@/lib/apiResponse";
import { getGaslessConfig, getRelayerBaseUrl, logApiEvent, logApiError } from "@/lib/serverUtils";
import { checkRateLimit, getIP, RateLimits } from "@/lib/rateLimit";
import { getSession, hasValidStepUp, isTrustedDevice } from "@/lib/session";
import { getChainAddresses } from "@/lib/runtimeConfig";

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const limitResult = await checkRateLimit(ip, RateLimits.moderate, "aa_userop_draft_ip");
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

    const rawBody = await req.text();
    const bodyObj = (() => {
      try {
        return rawBody ? (JSON.parse(rawBody) as any) : {};
      } catch {
        return {};
      }
    })();
    const chainIdRaw = bodyObj?.chainId ?? bodyObj?.chain_id;
    const chainId = Number(chainIdRaw);
    const addresses = getChainAddresses(
      Number.isFinite(chainId) && chainId > 0 ? chainId : undefined
    );
    const entryPointAddress =
      typeof addresses?.entryPoint === "string" ? String(addresses.entryPoint) : "";
    if (!entryPointAddress) {
      return ApiResponses.internalError("EntryPoint 未配置");
    }

    const apiKey = String(
      process.env.RELAYER_AA_API_KEY ||
        process.env.RELAYER_API_KEY ||
        process.env.RELAYER_ADMIN_KEY ||
        ""
    ).trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-KEY"] = apiKey;

    const relayerUrl = new URL("/aa/userop/draft", relayerBase);
    const relayerRes = await fetch(relayerUrl.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner,
        ...(bodyObj || {}),
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
        await logApiEvent("aa_userop_draft_failed", {
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
      await logApiEvent("aa_userop_draft_exception", {
        owner: owner ? owner.slice(0, 10) : "",
        message: String(e?.message || e).slice(0, 300),
      });
    } catch {}
    logApiError("POST /api/aa/userop/draft", e);
    return ApiResponses.internalError(
      "Failed to draft user operation",
      process.env.NODE_ENV === "development" ? String(e?.message || e) : undefined
    );
  }
}
