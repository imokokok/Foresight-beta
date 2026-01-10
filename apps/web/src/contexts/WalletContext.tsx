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
  const authCheckingRef = React.useRef(false);
  const siweLoggingInRef = React.useRef(false);

  // 检查当前认证状态（带防重复）
  const checkAuth = useCallback(async () => {
    // 防止重复调用
    if (authCheckingRef.current) return;
    authCheckingRef.current = true;
    try {
      const res = await fetch("/api/auth/me", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data?.address) {
          setIsAuthenticated(true);
          setAuthAddress(data.address);
          return;
        }
      }
      setIsAuthenticated(false);
      setAuthAddress(null);
    } catch {
      setIsAuthenticated(false);
      setAuthAddress(null);
    } finally {
      authCheckingRef.current = false;
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

  // 初始化时检查认证状态（仅执行一次）
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (walletState.account && rawProvider) {
      refreshBalance(walletState.account);
    }
  }, [walletState.account, walletState.chainId, rawProvider, refreshBalance]);

  const normalizedAccount = walletState.account ? normalizeAddress(walletState.account) : null;
  const normalizedAuthAddress = authAddress ? normalizeAddress(authAddress) : null;

  useEffect(() => {
    checkAuth();
  }, [walletState.account, walletState.chainId, checkAuth]);

  useEffect(() => {
    if (!walletState.account) return;
    if (!isAuthenticated || !normalizedAuthAddress) return;
    if (normalizedAccount && normalizedAccount !== normalizedAuthAddress) {
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
  }, [walletState.account, isAuthenticated, normalizedAccount, normalizedAuthAddress]);

  const disconnectWalletWithLogout = useCallback(async () => {
    try {
      await fetch("/api/siwe/logout", { method: "POST" });
    } catch {}
    setIsAuthenticated(false);
    setAuthAddress(null);
    await disconnectWallet();
  }, [disconnectWallet]);

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
    normalizedAccount,
    // SIWE 认证状态
    isAuthenticated,
    authAddress,
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
