"use client";

import { ethers } from "ethers";
import { t, formatTranslation } from "./i18n";

const nonceCache = {
  value: null as { nonce: string; message: string } | null,
  expiresAt: 0,
  inFlight: null as Promise<{ nonce: string; message: string }> | null,
};

function waitMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(res: Response): number | null {
  const retryAfter = res.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
  }

  const resetIso = res.headers.get("X-RateLimit-Reset");
  if (resetIso) {
    const resetAt = new Date(resetIso).getTime();
    if (Number.isFinite(resetAt)) {
      const delta = resetAt - Date.now();
      if (delta > 0) return Math.ceil(delta);
    }
  }

  return null;
}

async function fetchNonce(): Promise<{ nonce: string; message: string }> {
  const now = Date.now();
  if (nonceCache.value && nonceCache.expiresAt > now) {
    return nonceCache.value;
  }

  if (nonceCache.inFlight) {
    return nonceCache.inFlight;
  }

  nonceCache.inFlight = (async () => {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch("/api/auth/challenge/nonce", {
        method: "GET",
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const nonce = typeof json?.nonce === "string" ? String(json.nonce) : "";
        const message = typeof json?.message === "string" ? String(json.message) : "";
        if (nonce && message) {
          nonceCache.value = { nonce, message };
          nonceCache.expiresAt = Date.now() + 30_000;
          return { nonce, message };
        }
        throw { status: res.status };
      }

      if (res.status === 429 && attempt < maxAttempts - 1) {
        const retryMs = getRetryAfterMs(res);
        const fallbackMs = Math.min(2000 * Math.pow(2, attempt), 8000);
        await waitMs(retryMs ?? fallbackMs);
        continue;
      }

      throw { status: res.status };
    }

    throw { status: 429 };
  })();

  try {
    return await nonceCache.inFlight;
  } finally {
    nonceCache.inFlight = null;
  }
}

type Params = {
  providerRef: React.RefObject<any>;
  account: string | null;
  chainIdHex?: string | null;
};

export function useSiweAuth(params: Params) {
  const siweLogin = async (): Promise<{ success: boolean; address?: string; error?: string }> => {
    try {
      const rawProvider = params.providerRef.current;
      if (!rawProvider) {
        return { success: false, error: t("errors.wallet.notDetected") };
      }

      const browserProvider = new ethers.BrowserProvider(rawProvider);
      const signer = await browserProvider.getSigner();
      const signerAddress = await signer.getAddress().catch(() => null);
      const net = await browserProvider.getNetwork();
      const address = signerAddress || params.account;
      if (!address) return { success: false, error: t("errors.wallet.connectFirst") };

      let nonce: string;
      let messageToSign: string;
      try {
        const res = await fetchNonce();
        nonce = res.nonce;
        messageToSign = res.message;
      } catch (e: any) {
        const status = typeof e?.status === "number" ? e.status : undefined;
        if (status === 429) {
          return { success: false, error: t("errors.api.429.description") };
        }
        if (status) {
          return {
            success: false,
            error: formatTranslation(t("errors.wallet.nonceFetchFailed"), {
              status,
            }),
          };
        }
        return { success: false, error: t("errors.wallet.nonceInvalid") };
      }

      const chainIdNum = Number(net?.chainId?.toString?.() || params.chainIdHex || "1");

      let signature: string;
      try {
        signature = await signer.signMessage(messageToSign);
      } catch (signErr: any) {
        if (signErr?.code === 4001 || signErr?.code === "ACTION_REJECTED") {
          return { success: false, error: t("errors.wallet.signatureRejected") };
        }
        if (typeof (rawProvider as any)?.request === "function") {
          try {
            signature = await (rawProvider as any).request({
              method: "personal_sign",
              params: [messageToSign, address],
            });
          } catch (fallbackErr: any) {
            if (fallbackErr?.code === 4001 || fallbackErr?.code === "ACTION_REJECTED") {
              return { success: false, error: t("errors.wallet.signatureRejected") };
            }
            try {
              signature = await (rawProvider as any).request({
                method: "personal_sign",
                params: [address, messageToSign],
              });
            } catch {
              return { success: false, error: t("errors.wallet.signatureFailed") };
            }
          }
        } else {
          return { success: false, error: t("errors.wallet.signatureFailed") };
        }
      }

      let verifyRes: Response | null = null;
      let verifyJson: any = null;
      try {
        verifyRes = await fetch("/api/auth/challenge/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            address,
            signature,
            nonce,
            chainId: Number.isFinite(chainIdNum) ? chainIdNum : undefined,
          }),
        });
        verifyJson = await verifyRes.json().catch(() => null);
      } catch {
        return { success: false, error: t("errors.wallet.verifyFailed") };
      } finally {
        nonceCache.value = null;
        nonceCache.expiresAt = 0;
      }
      if (!verifyRes) {
        return { success: false, error: t("errors.wallet.verifyFailed") };
      }
      if (!verifyRes.ok || !verifyJson?.success) {
        return {
          success: false,
          error:
            verifyJson?.error?.message ||
            verifyJson?.message ||
            verifyJson?.detail ||
            t("errors.wallet.verifyFailed"),
        };
      }

      return { success: true, address };
    } catch (err: any) {
      console.error("[SIWE] Login error:", err);
      return { success: false, error: err?.message || t("errors.wallet.loginError") };
    }
  };

  return { siweLogin };
}
