"use client";

export async function requestWalletPermissions(
  provider: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!provider || typeof provider.request !== "function") {
      return { success: false, error: "钱包 provider 不可用" };
    }
    try {
      await provider.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      try {
        await provider.request({ method: "eth_requestAccounts" });
      } catch {}
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "权限请求失败" };
  }
}
