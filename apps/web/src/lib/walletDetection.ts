"use client";
import type { RefObject } from "react";

type WalletType = "metamask" | "coinbase" | "binance" | "okx" | "kaia" | "trust";

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
  if (
    name.includes("kaia") ||
    name.includes("kaikas") ||
    rdns.includes("kaia") ||
    rdns.includes("kaikas")
  )
    return "kaia";
  if (name.includes("trust") || rdns.includes("trust")) return "trust";
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
  const klaytn = typeof window !== "undefined" ? (window as any).klaytn : undefined;
  const p = provider || ethereum || klaytn;
  if (!p) return null;

  const mapped = providerTypeMap.get(p as any);
  if (mapped) return mapped;

  try {
    if (
      (klaytn && (p === klaytn || klaytn.isKaikas || p.isKaikas || p.isKaia)) ||
      (typeof p.networkVersion === "string" &&
        (p as any).selectedAddress &&
        ((p as any).isKaikas || (p as any).isKaia))
    ) {
      return "kaia";
    }

    if (
      (p as any).isTrust ||
      (typeof window !== "undefined" && (window as any).trustwallet === p)
    ) {
      return "trust";
    }

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
      p.isMetaMask &&
      !p.isBitKeep &&
      !p.isBlockWallet &&
      !p.isMathWallet &&
      !p.isOkxWallet &&
      !p.isOKExWallet &&
      !p.isOKX &&
      !p.isTrust &&
      !p.isCoinbaseWallet &&
      !p.isBinance &&
      !p.isKuCoinWallet &&
      !p.isRabby
    ) {
      return "metamask";
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
      if (host.includes("kaia") || host.includes("kaikas")) return "kaia";
      if (host.includes("trust")) return "trust";
    }

    if (typeof p.name === "string") {
      const name = p.name.toLowerCase();
      if (name.includes("metamask")) return "metamask";
      if (name.includes("coinbase")) return "coinbase";
      if (name.includes("binance")) return "binance";
      if (name.includes("okx")) return "okx";
      if (name.includes("kaia") || name.includes("kaikas")) return "kaia";
      if (name.includes("trust")) return "trust";
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
  if (
    typeof window !== "undefined" &&
    ((window as any).klaytn === p || (window as any).klaytn?.isKaikas)
  ) {
    return "kaia";
  }
  if (
    typeof window !== "undefined" &&
    ((window as any).trustwallet === p || (window as any).ethereum?.isTrust)
  ) {
    return "trust";
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
  const klaytn: any = typeof window !== "undefined" ? (window as any).klaytn : undefined;
  const providerByType: Partial<Record<WalletType, any>> = {};

  if (ethereum?.providers) {
    ethereum.providers.forEach((provider: any) => {
      const t = identifyWalletType(provider);
      if (t && !providerByType[t]) {
        providerByType[t] = provider;
      }
    });
  }

  if (discoveredProviders.length > 0) {
    for (const d of discoveredProviders) {
      const mapped = providerTypeMap.get(d.provider) || walletTypeFromInfo(d.info);
      if (mapped && !providerByType[mapped]) {
        providerByType[mapped] = d.provider;
      }
    }
  }

  if (typeof window !== "undefined" && (window as any).BinanceChain && !providerByType.binance) {
    providerByType.binance = (window as any).BinanceChain;
  }
  if (
    typeof window !== "undefined" &&
    (window as any).coinbaseWalletExtension &&
    !providerByType.coinbase
  ) {
    providerByType.coinbase = (window as any).coinbaseWalletExtension;
  }
  if (
    klaytn &&
    (klaytn.isKaikas || typeof klaytn.networkVersion === "string") &&
    !providerByType.kaia
  ) {
    providerByType.kaia = klaytn;
  }
  if (typeof window !== "undefined" && (window as any).trustwallet && !providerByType.trust) {
    providerByType.trust = (window as any).trustwallet;
  }
  if (typeof window !== "undefined" && (window as any).ethereum?.isTrust && !providerByType.trust) {
    providerByType.trust = (window as any).ethereum;
  }

  if (
    typeof window !== "undefined" &&
    ((window as any).okxwallet ||
      (window as any).okex ||
      (window as any).OKXWallet ||
      (window as any).okxWallet)
  ) {
    if (!providerByType.okx) {
      providerByType.okx =
        (window as any).okxwallet ||
        (window as any).okex ||
        (window as any).OKXWallet ||
        (window as any).okxWallet;
    }
  }

  if (!ethereum?.providers && ethereum) {
    const t = identifyWalletType(ethereum);
    if (t && !providerByType[t]) {
      providerByType[t] = ethereum;
    }
    if (ethereum.isBinanceWallet && !providerByType.binance) {
      providerByType.binance = ethereum;
    }
  }

  const wallets: WalletInfo[] = [
    {
      type: "metamask",
      name: "MetaMask",
      isAvailable: !!providerByType.metamask,
      provider: providerByType.metamask || null,
    },
    {
      type: "coinbase",
      name: "Coinbase Wallet",
      isAvailable: !!providerByType.coinbase,
      provider: providerByType.coinbase || null,
    },
    {
      type: "binance",
      name: "Binance Wallet",
      isAvailable: !!providerByType.binance,
      provider: providerByType.binance || null,
    },
    {
      type: "okx",
      name: "OKX Wallet",
      isAvailable: !!providerByType.okx,
      provider: providerByType.okx || null,
    },
    {
      type: "kaia",
      name: "Kaia Wallet",
      isAvailable: !!providerByType.kaia,
      provider: providerByType.kaia || null,
    },
    {
      type: "trust",
      name: "Trust Wallet",
      isAvailable: !!providerByType.trust,
      provider: providerByType.trust || null,
    },
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
  return null;
}
