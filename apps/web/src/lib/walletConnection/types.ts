import type { WalletInfo } from "../walletDetection";

export type WalletType = "metamask" | "coinbase" | "binance" | "okx" | "kaia" | "trust";

export type WalletConnectResult =
  | {
      success: true;
      account: string;
      chainId: string | null;
      currentWalletType: WalletType | null;
      provider: any;
    }
  | { success: false; error: string };

export type { WalletInfo };
