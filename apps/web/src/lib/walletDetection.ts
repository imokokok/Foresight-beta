"use client";
import type { RefObject } from "react";

type WalletType = "metamask" | "coinbase" | "binance" | "okx";

interface EIP6963ProviderInfo {
  uuid?: string;
  name?: string;
  icon?: string;
  rdns?: string;
}

export type EIP6963AnnounceDetail = { info: EIP6963ProviderInfo; provider: any };

const discoveredProviders: Array<EIP6963AnnounceDetail> = [];
const providerTypeMap: WeakMap<any, WalletType> = new WeakMap();

function walletTypeFromInfo(info: EIP6963ProviderInfo): WalletType | null {
  const name = (info?.name || "").toLowerCase();
  const rdns = (info?.rdns || "").toLowerCase();
  if (name.includes("metamask") || rdns.includes("metamask")) return "metamask";
  if (name.includes("coinbase") || rdns.includes("coinbase")) return "coinbase";
  if (name.includes("binance") || rdns.includes("binance")) return "binance";
  if (name.includes("okx") || rdns.includes("okx")) return "okx";
  return null;
}

export function handleEIP6963Announce(event: CustomEvent<EIP6963AnnounceDetail> | any) {
  const detail = event?.detail as EIP6963AnnounceDetail;
  if (!detail?.provider) return;
  const exists = discoveredProviders.some((d) => d.provider === detail.provider);
  if (!exists) {
    discoveredProviders.push(detail);
  }
  const mapped = walletTypeFromInfo(detail.info);
  if (mapped) {
    providerTypeMap.set(detail.provider, mapped);
  }
}

export type WalletInfo = {
  type: WalletType;
  name: string;
  isAvailable: boolean;
  provider?: any;
  isGeneric?: boolean;
};

export function identifyWalletType(provider?: any): WalletType | null {
  const ethereum = (typeof window !== "undefined" ? (window as any).ethereum : undefined) as any;
  const p = provider || ethereum;
  if (!p) return null;

  const mapped = providerTypeMap.get(p as any);
  if (mapped) return mapped;

  try {
    if (
      p.isOkxWallet ||
      p.isOKExWallet ||
      p.isOKX ||
      (p.constructor &&
        (p.constructor.name === "OkxWalletProvider" ||
          p.constructor.name === "OKXWallet" ||
          p.constructor.name === "OkxWallet")) ||
      (typeof window !== "undefined" &&
        (p === (window as any).okxwallet ||
          p === (window as any).okex ||
          p === (window as any).OKXWallet ||
          p === (window as any).okxWallet))
    ) {
      return "okx";
    }

    if (
      p._metamask ||
      (p.isMetaMask && p.constructor && p.constructor.name === "MetaMaskInpageProvider") ||
      (p.isMetaMask && typeof p._metamask !== "undefined")
    ) {
      return "metamask";
    }

    if (
      p.isCoinbaseWallet ||
      p.isCoinbaseBrowser ||
      p.selectedProvider?.isCoinbaseWallet ||
      p.provider?.isCoinbaseWallet ||
      (p.constructor && p.constructor.name === "CoinbaseWalletProvider") ||
      p.qrUrl
    ) {
      return "coinbase";
    }

    if (
      p.isBinanceWallet ||
      p.isBinance ||
      p.bbcSignTx ||
      (p.constructor && p.constructor.name === "BinanceWalletProvider") ||
      (p.isMetaMask && !p._metamask && !p.isCoinbaseWallet && !p.isOkxWallet)
    ) {
      return "binance";
    }

    if (typeof p.host === "string") {
      const host = p.host.toLowerCase();
      if (host.includes("metamask")) return "metamask";
      if (host.includes("coinbase")) return "coinbase";
      if (host.includes("binance")) return "binance";
      if (host.includes("okx")) return "okx";
    }

    if (typeof p.name === "string") {
      const name = p.name.toLowerCase();
      if (name.includes("metamask")) return "metamask";
      if (name.includes("coinbase")) return "coinbase";
      if (name.includes("binance")) return "binance";
      if (name.includes("okx")) return "okx";
    }
  } catch {}

  if (
    typeof window !== "undefined" &&
    ((window as any).BinanceChain === p || (window as any).BinanceChain)
  ) {
    return "binance";
  }
  if (
    typeof window !== "undefined" &&
    ((window as any).coinbaseWalletExtension === p || (window as any).coinbaseWalletExtension)
  ) {
    return "coinbase";
  }
  if (
    typeof window !== "undefined" &&
    ((window as any).okxwallet === p || (window as any).okxwallet)
  ) {
    return "okx";
  }

  if (!provider && ethereum?.providers) {
    for (const pr of ethereum.providers) {
      const m = providerTypeMap.get(pr);
      if (m) return m;
      if (pr._metamask && pr.isMetaMask) return "metamask";
      if (pr.isCoinbaseWallet) return "coinbase";
      if (pr.isMetaMask && !pr._metamask && !pr.isCoinbaseWallet) return "binance";
    }
  }

  return null;
}

export function detectWallets(): WalletInfo[] {
  const ethereum: any = typeof window !== "undefined" ? (window as any).ethereum : undefined;
  let hasMM = false;
  let hasCB = false;
  let hasBN = false;
  let hasOKX = false;

  if (ethereum?.providers) {
    ethereum.providers.forEach((provider: any) => {
      const t = identifyWalletType(provider);
      if (t === "metamask") hasMM = true;
      else if (t === "coinbase") hasCB = true;
      else if (t === "binance") hasBN = true;
      else if (t === "okx") hasOKX = true;
    });
  }

  if (discoveredProviders.length > 0) {
    for (const d of discoveredProviders) {
      const mapped = providerTypeMap.get(d.provider) || walletTypeFromInfo(d.info);
      if (mapped === "metamask") hasMM = true;
      else if (mapped === "coinbase") hasCB = true;
      else if (mapped === "binance") hasBN = true;
      else if (mapped === "okx") hasOKX = true;
    }
  }

  if (typeof window !== "undefined" && (window as any).BinanceChain) hasBN = true;
  if (typeof window !== "undefined" && (window as any).coinbaseWalletExtension) hasCB = true;

  if (
    typeof window !== "undefined" &&
    ((window as any).okxwallet ||
      (window as any).okex ||
      (window as any).OKXWallet ||
      (window as any).okxWallet)
  ) {
    hasOKX = true;
  }

  if (!ethereum?.providers && ethereum) {
    const t = identifyWalletType(ethereum);
    if (t === "metamask") hasMM = true;
    else if (t === "coinbase") hasCB = true;
    else if (t === "binance") hasBN = true;
    else if (t === "okx") hasOKX = true;
    if (ethereum.isBinanceWallet) hasBN = true;
  }

  const wallets: WalletInfo[] = [
    { type: "metamask", name: "MetaMask", isAvailable: hasMM, provider: null },
    { type: "coinbase", name: "Coinbase Wallet", isAvailable: hasCB, provider: null },
    { type: "binance", name: "Binance Wallet", isAvailable: hasBN, provider: null },
    { type: "okx", name: "OKX Wallet", isAvailable: hasOKX, provider: null },
  ];

  const uniqueWallets = wallets.reduce((acc: WalletInfo[], current) => {
    const exists = acc.find((w) => w.type === current.type);
    if (!exists) {
      acc.push(current);
    }
    return acc;
  }, []);

  return uniqueWallets;
}

export function getActiveRawProvider(providerRef: RefObject<any>): any {
  if (providerRef.current) return providerRef.current;
  if (typeof window === "undefined") return null;
  const w: any = window as any;
  return w.ethereum || w.BinanceChain || null;
}
