"use client";

import { useCallback } from "react";

const LOGOUT_FLAG = "fs_wallet_logged_out";

export function useWalletDisconnect() {
  const disconnectWallet = useCallback(
    async (currentProvider: any, removeListeners: () => void) => {
      try {
        if (currentProvider) {
          try {
            if (typeof currentProvider.disconnect === "function") {
              await currentProvider.disconnect();
            } else if (typeof currentProvider.request === "function") {
              try {
                await currentProvider.request({
                  method: "wallet_revokePermissions",
                  params: [{ eth_accounts: {} }],
                });
              } catch {
                try {
                  await currentProvider.request({
                    method: "wallet_requestPermissions",
                    params: [{ eth_accounts: {} }],
                  });
                } catch {}
              }
            }
          } catch {}

          try {
            const ethereum: any = typeof window !== "undefined" ? (window as any).ethereum : null;
            if (ethereum?.providers && Array.isArray(ethereum.providers)) {
              for (const pr of ethereum.providers) {
                if (typeof pr?.request === "function") {
                  try {
                    await pr.request({
                      method: "wallet_revokePermissions",
                      params: [{ eth_accounts: {} }],
                    });
                  } catch {}
                }
                if (typeof pr?.disconnect === "function") {
                  try {
                    await pr.disconnect();
                  } catch {}
                }
              }
            } else if (ethereum && typeof ethereum.request === "function") {
              try {
                await ethereum.request({
                  method: "wallet_revokePermissions",
                  params: [{ eth_accounts: {} }],
                });
              } catch {}
            }
          } catch {}

          removeListeners();
        }

        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("lastWalletType");
            localStorage.removeItem("walletconnect");
            localStorage.removeItem("WALLETCONNECT_DEEPLINK_CHOICE");
            localStorage.removeItem("-walletlink:https://www.walletlink.org:version");
            localStorage.removeItem("-walletlink:https://www.walletlink.org:session:id");
            localStorage.removeItem("-walletlink:https://www.walletlink.org:session:secret");
            localStorage.removeItem("-walletlink:https://www.walletlink.org:session:linked");
            localStorage.removeItem("coinbaseWallet.version");
            sessionStorage.removeItem("metamask.selectedAddress");
            sessionStorage.removeItem("binance.selectedAddress");
            sessionStorage.removeItem("okx.selectedAddress");
          } catch {}
        }

        if (typeof window !== "undefined") {
          sessionStorage.setItem(LOGOUT_FLAG, "true");
        }
      } catch {}
    },
    []
  );

  return {
    disconnectWallet,
  };
}
