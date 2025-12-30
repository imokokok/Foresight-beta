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
        return { success: false, error: "未检测到钱包，请安装钱包插件" };
      }

      const browserProvider = new ethers.BrowserProvider(rawProvider);
      const signer = await browserProvider.getSigner();
      const signerAddress = await signer.getAddress().catch(() => null);
      const net = await browserProvider.getNetwork();
      const address = signerAddress || params.account;
      if (!address) return { success: false, error: "请先连接钱包" };

      const nonceRes = await fetch("/api/siwe/nonce", { method: "GET" });
      if (!nonceRes.ok) {
        console.error("[SIWE] Nonce API failed:", nonceRes.status, nonceRes.statusText);
        return { success: false, error: `获取 nonce 失败 (${nonceRes.status})` };
      }
      const nonceJson = await nonceRes.json().catch(() => null);
      const nonce: string = nonceJson?.nonce;
      if (!nonce) {
        console.error("[SIWE] Nonce response invalid:", nonceJson);
        return { success: false, error: "无法获取 nonce，请刷新页面重试" };
      }

      const { SiweMessage } = await import("siwe");
      const chainIdNum = Number(net?.chainId?.toString?.() || params.chainIdHex || "1");
      
      // 使用简单的 statement，避免翻译函数可能带来的问题
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
        // 用户拒绝签名
        if (signErr?.code === 4001 || signErr?.code === "ACTION_REJECTED") {
          return { success: false, error: "你取消了签名请求" };
        }
        if (typeof (rawProvider as any)?.request === "function") {
          try {
            signature = await (rawProvider as any).request({
              method: "personal_sign",
              params: [prepared, address],
            });
          } catch (fallbackErr: any) {
            if (fallbackErr?.code === 4001 || fallbackErr?.code === "ACTION_REJECTED") {
              return { success: false, error: "你取消了签名请求" };
            }
            try {
              signature = await (rawProvider as any).request({
                method: "personal_sign",
                params: [address, prepared],
              });
            } catch {
              return { success: false, error: "签名失败，请重试" };
            }
          }
        } else {
          return { success: false, error: "签名失败，请重试" };
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
          error: verifyJson?.message || verifyJson?.detail || "验证失败，请重试",
        };
      }

      return { success: true, address };
    } catch (err: any) {
      console.error("[SIWE] Login error:", err);
      return { success: false, error: err?.message || "登录过程出错，请重试" };
    }
  };

  return { siweLogin };
}
