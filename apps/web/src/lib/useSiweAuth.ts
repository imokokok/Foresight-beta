"use client";

import { ethers } from "ethers";
import { t, formatTranslation } from "./i18n";

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

      const nonceRes = await fetch("/api/siwe/nonce", { method: "GET" });
      if (!nonceRes.ok) {
        console.error("[SIWE] Nonce API failed:", nonceRes.status, nonceRes.statusText);
        return {
          success: false,
          error: formatTranslation(t("errors.wallet.nonceFetchFailed"), {
            status: nonceRes.status,
          }),
        };
      }
      const nonceJson = await nonceRes.json().catch(() => null);
      const nonce: string = nonceJson?.nonce;
      if (!nonce) {
        console.error("[SIWE] Nonce response invalid:", nonceJson);
        return { success: false, error: t("errors.wallet.nonceInvalid") };
      }

      const { SiweMessage } = await import("siwe");
      const chainIdNum = Number(net?.chainId?.toString?.() || params.chainIdHex || "1");

      const statement = "Sign in to Foresight";

      const message = new SiweMessage({
        domain: typeof window !== "undefined" ? window.location.host : "localhost",
        address,
        statement,
        uri: typeof window !== "undefined" ? window.location.origin : "http://localhost",
        version: "1",
        chainId: Number.isFinite(chainIdNum) ? chainIdNum : 1,
        nonce,
      });
      const prepared = message.prepareMessage();

      let signature: string;
      try {
        signature = await signer.signMessage(prepared);
      } catch (signErr: any) {
        if (signErr?.code === 4001 || signErr?.code === "ACTION_REJECTED") {
          return { success: false, error: t("errors.wallet.signatureRejected") };
        }
        if (typeof (rawProvider as any)?.request === "function") {
          try {
            signature = await (rawProvider as any).request({
              method: "personal_sign",
              params: [prepared, address],
            });
          } catch (fallbackErr: any) {
            if (fallbackErr?.code === 4001 || fallbackErr?.code === "ACTION_REJECTED") {
              return { success: false, error: t("errors.wallet.signatureRejected") };
            }
            try {
              signature = await (rawProvider as any).request({
                method: "personal_sign",
                params: [address, prepared],
              });
            } catch {
              return { success: false, error: t("errors.wallet.signatureFailed") };
            }
          }
        } else {
          return { success: false, error: t("errors.wallet.signatureFailed") };
        }
      }

      const verifyRes = await fetch("/api/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prepared,
          signature,
          domain: typeof window !== "undefined" ? window.location.host : undefined,
          uri: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson?.success) {
        return {
          success: false,
          error: verifyJson?.message || verifyJson?.detail || t("errors.wallet.verifyFailed"),
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
