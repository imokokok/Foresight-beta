"use client";
import { ethers } from "ethers";
import type { WalletState } from "./useWalletConnection";

export async function multisigSign(
  rawProvider: any,
  walletState: WalletState,
  data?: {
    verifyingContract?: string;
    action?: string;
    nonce?: number;
  }
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    if (!rawProvider) return { success: false, error: "钱包 provider 不可用" };

    const browserProvider = new ethers.BrowserProvider(rawProvider);
    const signer = await browserProvider.getSigner();
    const address = await signer.getAddress();
    const net = await browserProvider.getNetwork();
    const chainIdNum = Number(net?.chainId?.toString?.() || walletState.chainId || "1");
    const verifyingContract =
      data?.verifyingContract ?? "0x0000000000000000000000000000000000000000";
    const nonce = data?.nonce ?? Date.now();
    const message = {
      action: data?.action ?? "multisig-approve",
      nonce,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const typedData = {
      domain: {
        name: "Foresight MultiSig",
        version: "1",
        chainId: chainIdNum,
        verifyingContract,
      },
      types: {
        Approve: [
          { name: "action", type: "string" },
          { name: "nonce", type: "uint256" },
          { name: "timestamp", type: "uint64" },
        ],
      },
      primaryType: "Approve",
      message,
    } as const;

    let signature: string;
    try {
      signature = await (rawProvider as any).request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData)],
      });
    } catch {
      try {
        signature = await signer.signMessage(JSON.stringify({ type: "Approve", ...message }));
      } catch (e) {
        return { success: false, error: (e as any)?.message || "签名失败" };
      }
    }
    return { success: true, signature };
  } catch (err: any) {
    return { success: false, error: err?.message || "多签签名失败" };
  }
}
