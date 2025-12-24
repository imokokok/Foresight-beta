"use client";
import { ethers } from "ethers";

type Params = {
  providerRef: React.RefObject<any>;
  account: string | null;
  chainIdHex?: string | null;
};

export function useSiweAuth(params: Params) {
  const siweLogin = async (): Promise<{ success: boolean; address?: string; error?: string }> => {
    try {
      const rawProvider =
        params.providerRef.current ||
        (typeof window !== "undefined"
          ? (window as any).ethereum || (window as any).BinanceChain
          : null);
      if (!rawProvider) {
        return { success: false, error: "钱包 provider 不可用" };
      }

      const browserProvider = new ethers.BrowserProvider(rawProvider);
      const signer = await browserProvider.getSigner();
      const signerAddress = await signer.getAddress().catch(() => null);
      const net = await browserProvider.getNetwork();
      const address = signerAddress || params.account;
      if (!address) return { success: false, error: "请先连接钱包" };

      const nonceRes = await fetch("/api/siwe/nonce", { method: "GET" });
      const nonceJson = await nonceRes.json();
      const nonce: string = nonceJson?.nonce;
      if (!nonce) return { success: false, error: "无法获取 nonce" };

      const { SiweMessage } = await import("siwe");
      const chainIdNum = Number(net?.chainId?.toString?.() || params.chainIdHex || "1");
      const message = new SiweMessage({
        domain: typeof window !== "undefined" ? window.location.host : "localhost",
        address,
        statement: "Welcome to Foresight! Sign to connect.",
        uri: typeof window !== "undefined" ? window.location.origin : "http://localhost",
        version: "1",
        chainId: Number.isFinite(chainIdNum) ? chainIdNum : 1,
        nonce,
      });
      const prepared = message.prepareMessage();

      let signature: string;
      try {
        signature = await signer.signMessage(prepared);
      } catch {
        if (typeof (rawProvider as any)?.request === "function") {
          try {
            signature = await (rawProvider as any).request({
              method: "personal_sign",
              params: [prepared, address],
            });
          } catch {
            signature = await (rawProvider as any).request({
              method: "personal_sign",
              params: [address, prepared],
            });
          }
        } else {
          return { success: false, error: "签名失败" };
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
        return { success: false, error: verifyJson?.message || "签名验证失败" };
      }

      return { success: true, address };
    } catch (err: any) {
      return { success: false, error: err?.message || "SIWE 登录失败" };
    }
  };

  return { siweLogin };
}
