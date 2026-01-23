"use client";

import { useCallback } from "react";
import { detectWallets, identifyWalletType } from "../walletDetection";

export function useWalletProviderDetection() {
  const findProviderByType = useCallback((walletType: string) => {
    if (typeof window === "undefined") return null;

    const ethereum: any = (window as any).ethereum;
    const allDetected = detectWallets();

    // 先从已检测到的钱包中查找
    const discovered = allDetected.find((d) => d.type === walletType && d.provider);
    if (discovered?.provider) {
      return discovered.provider;
    }

    // 从 ethereum.providers 中查找
    if (ethereum?.providers) {
      for (const provider of ethereum.providers) {
        const t = identifyWalletType(provider);
        if (walletType === "metamask" && t === "metamask") {
          return provider;
        }
        if (walletType === "coinbase" && t === "coinbase") {
          return provider;
        }
        if (walletType === "okx" && t === "okx") {
          return provider;
        }
        if (walletType === "binance" && (t === "binance" || provider.isBinanceWallet)) {
          return provider;
        }
      }
    }

    // 特殊钱包类型的直接检测
    if (walletType === "binance" && (window as any).BinanceChain) {
      return (window as any).BinanceChain;
    }
    if (walletType === "coinbase" && (window as any).coinbaseWalletExtension) {
      return (window as any).coinbaseWalletExtension;
    }
    if (walletType === "okx") {
      if ((window as any).okxwallet) return (window as any).okxwallet;
      if ((window as any).okex) return (window as any).okex;
      if ((window as any).OKXWallet) return (window as any).OKXWallet;
      if ((window as any).okxWallet) return (window as any).okxWallet;
    }
    if (walletType === "kaia" && (window as any).klaytn) {
      const klaytn = (window as any).klaytn;
      // 处理 Kaia 钱包的特殊 request 方法
      if (typeof klaytn.request !== "function" && typeof klaytn.enable === "function") {
        return {
          ...klaytn,
          request: async (args: { method: string; params?: any[] }) => {
            if (args.method === "eth_requestAccounts" || args.method === "klay_requestAccounts") {
              return await klaytn.enable();
            }
            if (typeof klaytn.request === "function") {
              return klaytn.request(args);
            }
            return new Promise((resolve, reject) => {
              if (typeof klaytn.sendAsync !== "function") {
                reject(new Error("Provider does not support request"));
                return;
              }
              klaytn.sendAsync(
                {
                  method: args.method,
                  params: args.params || [],
                },
                (err: any, result: any) => {
                  if (err) reject(err);
                  else resolve(result?.result);
                }
              );
            });
          },
        };
      }
      return klaytn;
    }
    if (walletType === "trust") {
      if ((window as any).trustwallet) return (window as any).trustwallet;
      if (ethereum && (ethereum as any).isTrust) return ethereum;
    }

    return null;
  }, []);

  const getDefaultProvider = useCallback(() => {
    if (typeof window === "undefined") return null;
    const ethereum: any = (window as any).ethereum;
    return (
      ethereum ||
      (window as any).BinanceChain ||
      (window as any).klaytn ||
      (window as any).trustwallet
    );
  }, []);

  return {
    findProviderByType,
    getDefaultProvider,
  };
}
