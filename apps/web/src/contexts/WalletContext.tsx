"use client";
import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  useWalletConnection,
  type WalletConnectResult,
  type WalletState,
  type WalletType,
} from "../lib/useWalletConnection";
import {
  detectWallets,
  identifyWalletType,
  type WalletInfo,
  getActiveRawProvider,
} from "../lib/walletDetection";
import { useWalletBalance } from "../lib/useWalletBalance";
import { useSiweAuth } from "../lib/useSiweAuth";
import { requestWalletPermissions as requestWalletPermissionsImpl } from "../lib/walletPermissions";
import { multisigSign as multisigSignImpl } from "../lib/walletMultisig";
import { switchNetwork as switchNetworkImpl } from "../lib/walletNetwork";
import { formatAddress, normalizeAddress } from "../lib/cn";
import { t } from "../lib/i18n";
import { useAuthOptional } from "@/contexts/AuthContext";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isBinanceWallet?: boolean;
      providers?: any[];
    };
    coinbaseWalletExtension?: any;
    BinanceChain?: any;
  }
}

interface WalletContextType extends WalletState {
  connectWallet: (walletType?: WalletType) => Promise<void>;
  connectWalletWithResult: (walletType?: WalletType) => Promise<WalletConnectResult>;
  disconnectWallet: () => Promise<void>;
  formatAddress: (addr: string) => string;
  detectWallets: () => WalletInfo[];
  identifyWalletType: (provider?: any) => WalletType | null;
  siweLogin: () => Promise<{ success: boolean; address?: string; error?: string }>;
  requestWalletPermissions: () => Promise<{ success: boolean; error?: string }>;
  multisigSign: (data?: {
    verifyingContract?: string;
    action?: string;
    nonce?: number;
  }) => Promise<{ success: boolean; signature?: string; error?: string }>;
  refreshBalance: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  balanceEth: string | null;
  balanceLoading: boolean;
  provider: any;
  normalizedAccount: string | null;
  // SIWE 认证状态
  isAuthenticated: boolean;
  authAddress: string | null;
  checkAuth: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const auth = useAuthOptional();
  const {
    walletState,
    connectWallet,
    connectWalletWithResult,
    disconnectWallet,
    currentProviderRef,
    handleChainChanged,
  } = useWalletConnection();

  const rawProvider = getActiveRawProvider(currentProviderRef);

  const { balanceEth, balanceLoading, refreshBalance } = useWalletBalance({
    account: walletState.account,
    rawProvider,
    chainIdHex: walletState.chainId,
  });

  const { siweLogin: siweLoginBase } = useSiweAuth({
    providerRef: currentProviderRef,
    account: walletState.account,
    chainIdHex: walletState.chainId,
  });

  // SIWE 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authAddress, setAuthAddress] = useState<string | null>(null);
  const authRequestIdRef = React.useRef(0);
  const siweLoggingInRef = React.useRef(false);

  // 检查当前认证状态（最后一次调用胜出，避免竞态导致状态回滚）
  const checkAuth = useCallback(async () => {
    const requestId = (authRequestIdRef.current += 1);
    try {
      const res = await fetch("/api/auth/me", { method: "GET" });
      if (requestId !== authRequestIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (data?.address) {
          setIsAuthenticated(true);
          setAuthAddress(data.address);
          return;
        }
      }
      if (siweLoggingInRef.current) return;
      setIsAuthenticated(false);
      setAuthAddress(null);
    } catch {
      if (requestId !== authRequestIdRef.current) return;
      if (siweLoggingInRef.current) return;
      setIsAuthenticated(false);
      setAuthAddress(null);
    }
  }, []);

  const siweLogin = useCallback(async () => {
    if (isAuthenticated && authAddress) {
      return { success: true, address: authAddress };
    }
    if (siweLoggingInRef.current) {
      return { success: false, error: t("errors.wallet.loggingIn") };
    }
    siweLoggingInRef.current = true;
    try {
      authRequestIdRef.current += 1;
      const result = await siweLoginBase();
      if (result.success && result.address) {
        setIsAuthenticated(true);
        setAuthAddress(result.address);
      }
      return result;
    } finally {
      siweLoggingInRef.current = false;
    }
  }, [siweLoginBase, isAuthenticated, authAddress]);

  useEffect(() => {
    if (walletState.account && rawProvider) {
      refreshBalance(walletState.account);
    }
  }, [walletState.account, walletState.chainId, rawProvider, refreshBalance]);

  const normalizedWalletAccount = walletState.account
    ? normalizeAddress(walletState.account)
    : null;
  const normalizedSessionAccount =
    auth?.user?.id && typeof auth.user.id === "string" ? normalizeAddress(auth.user.id) : null;
  const normalizedAuthAddress = authAddress ? normalizeAddress(authAddress) : null;
  const effectiveAccount =
    normalizedWalletAccount || normalizedSessionAccount || normalizedAuthAddress || null;
  const effectiveAuthAddress = normalizedSessionAccount || normalizedAuthAddress || null;
  const effectiveIsAuthenticated = Boolean(normalizedSessionAccount || isAuthenticated);

  useEffect(() => {
    checkAuth();
  }, [walletState.account, walletState.chainId, checkAuth]);

  useEffect(() => {
    if (!walletState.account) return;
    const expected = effectiveAuthAddress;
    if (!expected) return;
    if (normalizedWalletAccount && normalizedWalletAccount !== expected) {
      void (async () => {
        try {
          await fetch("/api/siwe/logout", { method: "POST" });
        } catch {
        } finally {
          setIsAuthenticated(false);
          setAuthAddress(null);
        }
      })();
    }
  }, [walletState.account, normalizedWalletAccount, effectiveAuthAddress]);

  const disconnectWalletWithLogout = useCallback(async () => {
    try {
      if (auth?.signOut) {
        await auth.signOut();
      } else {
        await fetch("/api/siwe/logout", { method: "POST" });
      }
    } catch {}
    setIsAuthenticated(false);
    setAuthAddress(null);
    await disconnectWallet();
  }, [disconnectWallet, auth]);

  const requestWalletPermissions = async (): Promise<{ success: boolean; error?: string }> => {
    return requestWalletPermissionsImpl(rawProvider);
  };

  const multisigSign = async (data?: {
    verifyingContract?: string;
    action?: string;
    nonce?: number;
  }): Promise<{ success: boolean; signature?: string; error?: string }> => {
    return multisigSignImpl(rawProvider, walletState, data);
  };

  const switchNetwork = async (chainId: number) => {
    await switchNetworkImpl(rawProvider, chainId);

    if (!rawProvider) return;

    try {
      const chainIdHex = await rawProvider.request({ method: "eth_chainId" });
      handleChainChanged(chainIdHex);
      const accounts = await rawProvider.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) {
        await refreshBalance(accounts[0]);
      }
    } catch {}
  };

  const contextValue: WalletContextType = {
    ...walletState,
    account: effectiveAccount,
    balanceEth,
    balanceLoading,
    connectWallet,
    connectWalletWithResult,
    disconnectWallet: disconnectWalletWithLogout,
    formatAddress,
    detectWallets,
    identifyWalletType,
    siweLogin,
    requestWalletPermissions,
    multisigSign,
    refreshBalance: () => refreshBalance(),
    switchNetwork,
    provider: rawProvider,
    normalizedAccount: effectiveAccount,
    // SIWE 认证状态
    isAuthenticated: effectiveIsAuthenticated,
    authAddress: effectiveAuthAddress,
    checkAuth,
  };

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
